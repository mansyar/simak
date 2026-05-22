# Implementation Plan: Track 4.1 — File Upload & Submission (Student)

## Phase 1: R2 Storage Client & Presigned URL Generation [checkpoint: e464bbe]

- [x] Task: Install R2 SDK dependencies [9002978]
  - [x] Run `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
  - [x] Verify import works by running `pnpm typecheck`
- [x] Task: Write tests for R2 storage client [bfc4446]
  - [x] Test: `getR2Client()` returns null when R2 env vars are missing (dev fallback)
  - [x] Test: `getR2Client()` returns configured S3 client when env vars are present
  - [x] Test: `generatePresignedUploadUrl()` returns a URL string
  - [x] Test: `generatePresignedDownloadUrl()` returns a URL string
  - [x] Test: Dev fallback mock generates valid-looking presigned URLs
  - [x] Test: `generateFileKey()` returns a string matching `submissions/{uuid}.{ext}` pattern
- [x] Task: Implement R2 storage client (`src/lib/storage.ts`) [bfc4446]
  - [ ] Create `generateFileKey({ extension })` — generates `submissions/{uuid}.{ext}` using `crypto.randomUUID()`
  - [ ] Create `getR2Client()` — lazy singleton, returns null if env vars missing (dev fallback)
  - [ ] Create `createStorageService()` — wraps S3 client with presigned URL generation
  - [ ] Create `generatePresignedUploadUrl({ key, contentType })` — PUT URL, 5min expiry
  - [ ] Create `generatePresignedDownloadUrl({ key })` — GET URL, 1hr expiry
  - [ ] Create dev fallback: in-memory mock that logs operations and returns fake URLs when R2 not configured
- [x] Task: Conductor - User Manual Verification 'R2 Storage Client & Presigned URL Generation' (Protocol in workflow.md) [e464bbe]

## Phase 2: Server Functions for Submissions

- [x] Task: Write tests for submission server functions [40dbf75]
  - [x] Test: `submitCheckpoint` Zod schema validation (valid/invalid inputs)
  - [x] Test: `submitCheckpoint` rejects upload to locked checkpoint
  - [x] Test: `submitCheckpoint` transitions `unlocked` → `submitted` on first upload
  - [x] Test: `submitCheckpoint` rejects upload to already-submitted checkpoint (no revise)
  - [x] Test: `submitCheckpoint` accepts upload from `revise` state and transitions to `submitted`
  - [x] Test: Version auto-increment: first upload = v1, second resubmit = v2, third = v3 (auto-calculated via `SELECT COALESCE(MAX(version),0)+1`)
  - [x] Test: `listSubmissions` returns all versions for a checkpoint, newest first
  - [x] Test: `getSubmissionDetail` returns single submission record with ownership check
  - [x] Test: `getPresignedUploadUrl` generates UUID file key, returns both key and presigned URL
  - [x] Test: `getPresignedDownloadUrl` validates ownership, calls storage service
  - [x] Test: Ownership guard — student A cannot list/submit/download for student B's checkpoints
- [x] Task: Implement server functions (`src/server/submissions.ts`, `src/server/submissions.server.ts`) [40dbf75]
  - [x] Create `src/server/submissions.ts` — client-safe stubs + Zod schemas
    - [x] `SubmitCheckpointSchema` — checkpointId, fileKey, fileName, fileSize
    - [x] `ListSubmissionsSchema` — checkpointId
    - [x] `GetSubmissionDetailSchema` — submissionId
  - [x] Create `src/server/submissions.server.ts` — server-only handlers
    - [x] `submitCheckpointHandler` — validates checkpoint is `unlocked` or `revise`, enforces ownership via assignmentStudents join, calculates version as `COALESCE(MAX(version),0)+1`, inserts submission record, transitions checkpoint state to `submitted`
    - [x] `listSubmissionsHandler` — lists all versions for a checkpoint with ownership check, ordered by version DESC
    - [x] `getSubmissionDetailHandler` — single submission with ownership check
  - [x] Create `src/server/files.ts` — presigned URL server functions
    - [x] `getPresignedUploadUrl` — validates checkpoint state (`unlocked` or `revise`), generates UUID file key via `generateFileKey()`, returns `{ uploadUrl, fileKey }` to the client
    - [x] `getPresignedDownloadUrl` — validates submission ownership, generates GET URL (1hr expiry)
- [ ] Task: Conductor - User Manual Verification 'Server Functions for Submissions' (Protocol in workflow.md)

## Phase 3: Checkpoint Submission Page & Components

- [ ] Task: Write tests for submission UI components
  - [ ] Test: FileUploader renders drag-and-drop zone with correct accept attribute
  - [ ] Test: FileUploader validates file type (rejects .png, accepts .pdf/.docx)
  - [ ] Test: FileUploader validates file size (>25MB shows error)
  - [ ] Test: FileUploader shows upload progress state
  - [ ] Test: FileUploader handles upload success and calls onSuccess callback
  - [ ] Test: FileUploader handles upload error with retry guidance
  - [ ] Test: FileList renders all submission versions with file info
  - [ ] Test: FileList shows download links for each version
  - [ ] Test: FileList shows empty state when no submissions exist
  - [ ] Test: SubmissionStatus shows review result (pass/revise) when available
  - [ ] Test: SubmissionStatus shows 'awaiting review' when no review yet
  - [ ] Test: Checkpoint submission page requires student role
  - [ ] Test: Checkpoint submission page shows 404 for invalid checkpoint IDs
- [ ] Task: Implement UI components
  - [ ] Create `src/components/files/file-uploader.tsx`
    - [ ] Drag-and-drop zone with visual feedback (hover, drag-over states)
    - [ ] Click-to-browse fallback
    - [ ] File type validation (.docx/.pdf only)
    - [ ] File size validation (max 25MB)
    - [ ] Upload progress indicator
    - [ ] Success/error states with retry guidance
  - [ ] Create `src/components/files/file-list.tsx`
    - [ ] Version history table/list: version number, file name, file size, upload date
    - [ ] Download button per row (calls `getPresignedDownloadUrl`)
    - [ ] Empty state when no submissions
  - [ ] Create `src/components/files/submission-status.tsx`
    - [ ] Shows latest review result (pass/revise) with instructor comment
    - [ ] Shows revision deadline when status is 'revise'
    - [ ] Shows 'awaiting review' when submitted but unreviewed
  - [ ] Create submission route page (`/student/assignments/$id/checkpoints/$checkpointId`)
    - [ ] Route file at `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx`
    - [ ] BeforeLoad guard: requireRole(['student'])
    - [ ] Loader: fetch checkpoint detail, submissions, latest review
    - [ ] Renders: FileUploader + FileList + SubmissionStatus
    - [ ] Back navigation to assignment detail
- [ ] Task: Update existing CheckpointCard to link to submission page
  - [ ] Wire the existing "Submit" button (shown when `state === 'unlocked'`) as a `<Link>` to `/student/assignments/$id/checkpoints/$checkpointId`
  - [ ] Add a "Resubmit" button when `state === 'revise'` linking to the same route
  - [ ] Add a "View Submission" link when `state === 'submitted'` or `state === 'under_review'` or `state === 'passed'`
- [ ] Add i18n translation keys
  - [ ] English (en.json): file uploader labels, validation messages, submission history headers, status labels, resubmit, view submission
  - [ ] Indonesian (id.json): matching translation keys
  - [ ] Run `pnpm generate:i18n` to regenerate TypeScript types
- [ ] Task: Conductor - User Manual Verification 'Checkpoint Submission Page & Components' (Protocol in workflow.md)

## Phase 4: Integration & Final Verification

- [ ] Task: Run full test suite and verify coverage >80%
- [ ] Task: Run TypeScript typecheck (`pnpm typecheck`)
- [ ] Task: Run linter (`pnpm lint`)
- [ ] Task: Verify build succeeds (`pnpm build`)
- [ ] Task: Document any deviations from spec in plan.md notes
- [ ] Task: Conductor - User Manual Verification 'Integration & Final Verification' (Protocol in workflow.md)
