# AWS Manual Setup: Cognito + S3 Migration

Complete this guide **before** deploying any code changes. Steps are ordered so dependencies are created first.

---

## Prerequisites

- AWS Console access with permissions to create Cognito User Pools, S3 buckets, SES identities, and IAM users
- Your sender email domain (e.g. `healix.ai`) — needed for SES
- Vercel project access to update environment variables

---

## Step 1 — Create a Cognito User Pool

1. Go to **AWS Console → Cognito → User pools → Create user pool**
2. **Sign-in options:** Select **Email** only
3. **Password policy:**
   - Minimum length: 8
   - Require: uppercase, lowercase, numbers (customize to match your current policy)
4. **Multi-factor authentication:** Select **No MFA** (add later if needed)
5. **User account recovery:** Email only
6. **Self-service sign-up:** Enable (allows users to register themselves)
7. **Required attributes:** Select `email` (standard). Optionally add `name` for full name.
8. **Email provider:** Choose **Send email with Cognito** for now (change to SES in Step 2)
9. **User pool name:** e.g. `healix-users`
10. **App type:** Select **Confidential client**
11. **App client name:** e.g. `healix-webapp`
12. **Client secret:** **Generate a client secret** (required — webapp uses server-side auth)
13. **Auth flows:** Enable the following (deselect everything else):
    - `ALLOW_USER_PASSWORD_AUTH`
    - `ALLOW_REFRESH_TOKEN_AUTH`
14. **Token expiration:**
    - Access token: `60` minutes (default)
    - Refresh token: `30` days
    - ID token: `60` minutes
15. Complete creation.

**Note down (you will need these as env vars):**
- User Pool ID (format: `us-east-1_xxxxxxxxx`)
- App Client ID
- App Client Secret
- AWS Region

---

## Step 2 — Configure Amazon SES for Email Delivery

> Cognito's built-in email is limited to 50 emails/day. SES is required for production.

### 2a — Verify your sender domain in SES

1. Go to **AWS Console → SES → Verified identities → Create identity**
2. Choose **Domain**
3. Enter your domain (e.g. `healix.ai`)
4. SES provides DNS records (DKIM CNAME records) — add these to your DNS registrar
5. Wait for status to show **Verified** (usually a few minutes after DNS propagation)

### 2b — Request production access (SES sandbox removal)

By default SES is in sandbox mode and can only send to verified email addresses.

1. Go to **SES → Account dashboard → Request production access**
2. Fill in the form:
   - Use case: Transactional (user verification and password reset emails)
   - Expected volume: your estimate
3. Submit and wait for approval — **typically 24–48 hours**

### 2c — Link SES to Cognito

1. Go to **Cognito → Your user pool → Messaging → Edit**
2. Under **Email**, select **Send email with Amazon SES**
3. **SES Region:** same region as Cognito
4. **FROM email address:** your verified SES identity (e.g. `no-reply@healix.ai`)
5. **FROM sender name:** e.g. `Healix`
6. Save changes

---

## Step 3 — Customize Cognito Email Templates

1. Go to **Cognito → Your user pool → Messaging → Email templates**
2. Edit the **Verification message** (sent on signup):
   - Subject: e.g. `Verify your Healix account`
   - Body: Include `{####}` where the 6-digit code will appear
   - Example body:
     ```
     Welcome to Healix!

     Your verification code is: {####}

     This code expires in 24 hours.
     ```
3. Edit the **Password reset message**:
   - Subject: e.g. `Reset your Healix password`
   - Body: Include `{####}` for the reset code
   - Example body:
     ```
     You requested a password reset for your Healix account.

     Your reset code is: {####}

     If you did not request this, you can ignore this email.
     ```

---

## Step 4 — Create an S3 Bucket

1. Go to **AWS Console → S3 → Create bucket**
2. **Bucket name:** e.g. `healix-test-artifacts` (must be globally unique)
3. **AWS Region:** Same region as Cognito
4. **Object Ownership:** ACLs disabled (recommended)
5. **Block Public Access:** Enable all four options (all public access blocked)
6. **Versioning:** Disabled (not needed)
7. **Encryption:** SSE-S3 (default — no extra cost)
8. Complete creation.

### 4a — Configure a Lifecycle Rule (Cost Control)

1. Go to your new bucket → **Management → Lifecycle rules → Create lifecycle rule**
2. **Rule name:** e.g. `expire-old-artifacts`
3. **Scope:** Apply to all objects
4. **Lifecycle rule actions:** Check **Expire current versions of objects**
5. **Days after object creation:** e.g. `90` (delete artifacts older than 90 days)
6. Save.

### 4b — Configure CORS (if artifacts are served directly from S3 URLs in the browser)

If the 307 redirect from `/api/artifacts` hits the browser directly, add a CORS rule:

1. Go to bucket → **Permissions → Cross-origin resource sharing (CORS) → Edit**
2. Paste:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["https://your-app-domain.com"],
    "ExposeHeaders": []
  }
]
```
3. Replace `your-app-domain.com` with your actual app domain.

---

## Step 5 — Create an IAM User for the Webapp

> Create one IAM user with both Cognito and S3 permissions.

### 5a — Create the IAM policy

1. Go to **IAM → Policies → Create policy**
2. Switch to **JSON** and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CognitoAuth",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:InitiateAuth",
        "cognito-idp:SignUp",
        "cognito-idp:ConfirmSignUp",
        "cognito-idp:GlobalSignOut",
        "cognito-idp:ForgotPassword",
        "cognito-idp:ConfirmForgotPassword",
        "cognito-idp:AdminGetUser"
      ],
      "Resource": "arn:aws:cognito-idp:REGION:ACCOUNT_ID:userpool/USER_POOL_ID"
    },
    {
      "Sid": "S3Artifacts",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

3. Replace `REGION`, `ACCOUNT_ID`, `USER_POOL_ID`, and `YOUR_BUCKET_NAME` with your actual values.
4. **Policy name:** e.g. `healix-webapp-policy`
5. Save.

### 5b — Create the IAM user

1. Go to **IAM → Users → Create user**
2. **User name:** e.g. `healix-webapp`
3. **Permissions:** Attach the policy you just created (`healix-webapp-policy`)
4. Complete creation.

### 5c — Generate access keys

1. Go to the user → **Security credentials → Access keys → Create access key**
2. Use case: **Application running outside AWS**
3. **Download the CSV** or copy the Access Key ID and Secret Access Key immediately (you cannot view the secret again).

---

## Step 6 — Set Environment Variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `AWS_REGION` | e.g. `us-east-1` | Same region for Cognito + S3 |
| `COGNITO_USER_POOL_ID` | e.g. `us-east-1_xxxxxxxxx` | From Step 1 |
| `COGNITO_CLIENT_ID` | From Step 1 | App client ID |
| `COGNITO_CLIENT_SECRET` | From Step 1 | App client secret |
| `AWS_S3_BUCKET_NAME` | e.g. `healix-test-artifacts` | From Step 4 |
| `AWS_ACCESS_KEY_ID` | From Step 5c | |
| `AWS_SECRET_ACCESS_KEY` | From Step 5c | Mark as sensitive |

**Remove these Supabase auth variables** (keep `DATABASE_URL`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 7 — Migrate Existing Users

Choose one option:

### Option A — Force password reset (simpler, ~2–4 hours)

Best when: small user base or internal users who can be notified.

1. Export users from Supabase:
   - Go to Supabase dashboard → Authentication → Users → Export
   - Or run: `SELECT id, email, raw_user_meta_data->>'full_name' as full_name FROM auth.users;`
2. Format as a CSV per [Cognito import schema](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-using-import-tool-csv-header.html). Required columns: `cognito:username`, `email`, `email_verified`, `cognito:mfa_enabled`
3. Go to **Cognito → User pool → Users → Import users** and upload the CSV
4. Imported users get status `RESET_REQUIRED` — they must set a new password on first login
5. Send an email to all users explaining the migration and asking them to log in and reset their password

**Critical:** After Cognito assigns new `sub` UUIDs to imported users, update the `profiles.id` column in your database to match. Run a mapping script that matches by email.

### Option B — Transparent migration Lambda (zero disruption, ~6–8 hours)

Best when: large or external-facing user base that cannot be disrupted.

1. Go to **Cognito → User pool → User pool properties → Add Lambda trigger**
2. Trigger type: **Authentication → User migration trigger**
3. Write a Lambda function that:
   - Receives a `triggerSource: UserMigration_Authentication` event
   - Calls Supabase auth to verify the user's credentials (via Supabase Admin API)
   - If valid, returns a user object for Cognito to create
4. Deploy the Lambda and attach it to the trigger
5. After a user successfully migrates (first login), they exist natively in Cognito
6. Run the profile ID mapping script after enough users have migrated, or on a rolling basis

---

## Step 8 — Migrate Existing Artifacts (Optional)

Skip this if existing test run artifacts are disposable. Do this if you need historical artifacts to remain accessible.

1. Write a migration script that:
   - Reads all rows from `test_artifacts` where `storage_path` is not null
   - Downloads each file from Supabase Storage using the service role key
   - Uploads to S3 at the same `storage_path` key
   - Updates `storage_path` in the DB row (no change needed if key format is the same)
2. Run during a low-traffic window
3. Verify a sample of artifacts load correctly in the dashboard after migration
4. Decommission the Supabase `test-artifacts` bucket after confirming migration is complete

---

## Checklist Summary

- [ ] Cognito User Pool created with correct auth flows and token expiry
- [ ] SES domain verified + DNS records added
- [ ] SES sandbox removal requested (wait for approval)
- [ ] SES linked to Cognito for email delivery
- [ ] Verification and password reset email templates customized
- [ ] S3 bucket created (private, same region as Cognito)
- [ ] S3 lifecycle rule configured
- [ ] S3 CORS configured if needed
- [ ] IAM policy created with Cognito + S3 permissions
- [ ] IAM user created and access keys generated
- [ ] All env vars set in Vercel (new AWS vars added, Supabase auth vars removed)
- [ ] User migration completed (Option A or B)
- [ ] Artifact migration run (if needed)
- [ ] Code deployed and all auth flows tested end-to-end
