import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'

let _s3: S3Client | null = null

function getS3Client(): S3Client {
  if (_s3) return _s3
  const region = process.env.AWS_REGION
  if (!region) throw new Error('AWS_REGION env var is not set')
  _s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  return _s3
}

function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME
  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME env var is not set')
  return bucket
}

export interface UploadArtifactParams {
  runId: string
  testName: string
  artifactType: 'screenshot' | 'video' | 'trace'
  fileName: string
  fileBuffer: Buffer
  contentType: string
  metadata?: Record<string, unknown>
}

export interface UploadedArtifact {
  storageUrl: string
  storagePath: string
  fileName: string
  fileSize: number
  contentType: string
}

export async function ensureBucketExists(): Promise<void> {
  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: getBucketName() }))
  } catch (err: unknown) {
    const code = (err as { name?: string })?.name
    if (code === 'NoSuchBucket' || code === 'NotFound') {
      throw new Error(`S3 bucket "${getBucketName()}" does not exist. Create it manually via AWS Console or Terraform.`)
    }
    throw err
  }
}

async function uploadWithRetry(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: getBucketName(),
          Key: storagePath,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'max-age=3600',
        })
      )
      return
    } catch (err) {
      if (attempt === maxRetries) throw err
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`[S3Storage] Retry ${attempt}/${maxRetries} after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

export async function uploadArtifact(params: UploadArtifactParams): Promise<UploadedArtifact> {
  const { runId, testName, artifactType, fileName, fileBuffer, contentType } = params

  const testHash = createHash('sha256').update(testName || 'unknown').digest('hex').substring(0, 12)
  const storagePath = `${runId}/${testHash}/${artifactType}/${fileName}`

  console.log(`[S3Storage] Uploading ${fileName} (${fileBuffer.length} bytes) to ${storagePath}`)

  await uploadWithRetry(storagePath, fileBuffer, contentType)

  console.log(`[S3Storage] Successfully uploaded ${fileName}`)

  // Generate a short-lived presigned URL for immediate pipeline use
  const storageUrl = await getArtifactSignedUrl(storagePath, 3600) // 1 hour

  return {
    storageUrl,
    storagePath,
    fileName,
    fileSize: fileBuffer.length,
    contentType,
  }
}

export async function uploadArtifactsBatch(
  artifacts: UploadArtifactParams[]
): Promise<UploadedArtifact[]> {
  const results = await Promise.allSettled(artifacts.map(artifact => uploadArtifact(artifact)))

  const uploaded: UploadedArtifact[] = []
  const errors: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      uploaded.push(result.value)
    } else {
      errors.push(`${artifacts[index].fileName}: ${result.reason}`)
    }
  })

  if (errors.length > 0) {
    console.warn('[S3Storage] Some artifacts failed to upload:', errors)
  }

  return uploaded
}

export async function deleteArtifactsForRun(runId: string): Promise<void> {
  const listResult = await getS3Client().send(
    new ListObjectsV2Command({ Bucket: getBucketName(), Prefix: `${runId}/`, MaxKeys: 1000 })
  )

  const objects = listResult.Contents
  if (!objects || objects.length === 0) return

  await getS3Client().send(
    new DeleteObjectsCommand({
      Bucket: getBucketName(),
      Delete: {
        Objects: objects.map(obj => ({ Key: obj.Key! })),
        Quiet: true,
      },
    })
  )
}

export async function getArtifactSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: getBucketName(), Key: storagePath }),
    { expiresIn }
  )
}
