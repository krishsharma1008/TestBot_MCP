import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the entire AWS SDK modules
vi.mock('@aws-sdk/client-s3', () => {
  const send = vi.fn()
  return {
    S3Client: vi.fn(() => ({ send })),
    PutObjectCommand: vi.fn(args => ({ ...args, _type: 'PutObject' })),
    GetObjectCommand: vi.fn(args => ({ ...args, _type: 'GetObject' })),
    DeleteObjectsCommand: vi.fn(args => ({ ...args, _type: 'DeleteObjects' })),
    ListObjectsV2Command: vi.fn(args => ({ ...args, _type: 'ListObjectsV2' })),
    HeadBucketCommand: vi.fn(args => ({ ...args, _type: 'HeadBucket' })),
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}))

import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { uploadArtifact, deleteArtifactsForRun, getArtifactSignedUrl, ensureBucketExists } from './s3-storage'

const mockSend = vi.fn()
vi.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as never)
const mockGetSignedUrl = vi.mocked(getSignedUrl)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AWS_REGION = 'us-east-1'
  process.env.AWS_ACCESS_KEY_ID = 'test-key'
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
  process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
})

describe('uploadArtifact', () => {
  it('uploads to correct path and returns presigned URL', async () => {
    mockSend.mockResolvedValueOnce({}) // PutObject
    mockGetSignedUrl.mockResolvedValueOnce('https://s3.example.com/signed-url')

    const result = await uploadArtifact({
      runId: 'run-123',
      testName: 'My Test',
      artifactType: 'screenshot',
      fileName: 'test-failed.png',
      fileBuffer: Buffer.from('fake-image'),
      contentType: 'image/png',
    })

    expect(result.storagePath).toMatch(/^run-123\/[a-f0-9]{12}\/screenshot\/test-failed\.png$/)
    expect(result.storageUrl).toBe('https://s3.example.com/signed-url')
    expect(result.fileSize).toBe(10)
    expect(result.contentType).toBe('image/png')
  })

  it('retries on failure and succeeds on second attempt', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('transient error'))
      .mockResolvedValueOnce({})
    mockGetSignedUrl.mockResolvedValueOnce('https://s3.example.com/signed-url')

    const result = await uploadArtifact({
      runId: 'run-retry',
      testName: 'Retry Test',
      artifactType: 'video',
      fileName: 'video.webm',
      fileBuffer: Buffer.from('fake-video'),
      contentType: 'video/webm',
    })
    expect(result.fileName).toBe('video.webm')
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})

describe('getArtifactSignedUrl', () => {
  it('generates a fresh presigned URL for a given path', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://s3.example.com/fresh-url')
    const url = await getArtifactSignedUrl('run-123/abc/screenshot/img.png')
    expect(url).toBe('https://s3.example.com/fresh-url')
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
  })
})

describe('deleteArtifactsForRun', () => {
  it('lists objects then deletes them', async () => {
    mockSend
      .mockResolvedValueOnce({ Contents: [{ Key: 'run-del/a/screenshot/img.png' }, { Key: 'run-del/b/video/v.webm' }] })
      .mockResolvedValueOnce({})
    await deleteArtifactsForRun('run-del')
    expect(mockSend).toHaveBeenCalledTimes(2)
  })

  it('does nothing when no objects exist', async () => {
    mockSend.mockResolvedValueOnce({ Contents: undefined })
    await deleteArtifactsForRun('run-empty')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})

describe('ensureBucketExists', () => {
  it('resolves when bucket exists', async () => {
    mockSend.mockResolvedValueOnce({})
    await expect(ensureBucketExists()).resolves.toBeUndefined()
  })

  it('throws when bucket does not exist', async () => {
    const err = Object.assign(new Error('not found'), { name: 'NoSuchBucket' })
    mockSend.mockRejectedValueOnce(err)
    await expect(ensureBucketExists()).rejects.toThrow('does not exist')
  })
})
