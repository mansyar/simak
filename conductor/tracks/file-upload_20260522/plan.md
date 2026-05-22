# Implementation Plan: Track 4.1 — File Upload & Submission (Student)

## Phase 1: R2 Storage Client & Presigned URL Generation

- [ ] Task: Write tests for R2 storage client
  - [ ] Test: `getR2Client()` returns null when R2 env vars are missing (dev fallback)
  - [ ] Test: `getR2Client()` returns configured S3 client when env vars are present
  - [ ] Test: `generatePresignedUploadUrl()` returns a URL string
  - [ ] Test: `generatePresignedDownloadUrl()` returns a URL string
  - [ ] Test: Dev fallback mock generates valid-looking presigned URLs
- [ ] Task: Implement R2 storage client (`src/lib/storage.ts`)
  - [ ] Create `getR2Client()` — lazy singleton, returns null if env vars missing (dev fallback)
  - [ ] Create `createStorageService()` — wraps S3 client with presigned URL generation
  - [ ] Create `generatePresignedUploadUrl({ key, contentType })` — PUT URL, 5min expiry
  - [ ] Create `generatePresignedDownloadUrl({ key })` — GET URL, 1hr expiry
  - [ ] Create dev fallback: in-memory mock that logs operations when R2 not configured
- [ ] Task: Conductor - User Manual Verification 'R2 Storage Client & Presigned URL Generation' (Protocol in workflow.md)

## Phase 2: Server Functions for Submissions

- [ ] Task: Write tests for submission server functions
  - [ ] Test: `submitCheckpoint` Zod schema validation (valid/invalid inputs)
  - [ ] Test: `submitCheckpoint` rejects upload to locked checkpoint
  - [ ] Test: `submitCheckpoint` transitions `unlocked` → `submitted` on first upload
  - [ ] Test: `submitCheckpoint` rejects upload to already-submitted checkpoint (no revise)
  - [ ] Test: `submitCheckpoint` transitions `revise` → `unlocked` on resubmit
  - [ ] Test: Version auto-increment: first upload = v1, resubmit = v2
  - [ ] Test: `listSubmissions` returns all versions for a checkpoint
  - [ ] Test: `getSubmissionDetail` returns single submission record
  - [ ] Test: `getPresignedUploadUrl` server function calls storage service
  - [ ] Test: `getPresignedDownloadUrl` server function calls storage service
  - [ ] Test: `confirmUpload` creates DB record with correct file metadata
  - [ ] Test: Ownership guard — student A cannot list/submit for student B's checkpoints
- [ ] Task: Implement server functions (`src/server/submissions.ts`, `src/server/submissions.server.ts`)
  - [ ] Create `src/server/submissions.ts` — client-safe stubs + Zod schemas
    - [ ] `SubmitCheckpointSchema` — checkpointId, fileKey, fileName, fileSize
    - [ ] `ListSubmissionsSchema` — checkpointId
    - [ ] `GetSubmissionDetailSchema` — submissionId
  - [ ] Create `src/server/submissions.server.ts` — server-only handlers
    - [ ] `submitCheckpointHandler` — validates state, enforces ownership, inserts record, updates checkpoint state
    - [ ] `listSubmissionsHandler` — lists all versions for a checkpoint with ownership check
    - [ ] `getSubmissionDetailHandler` — single submission with ownership check
  - [ ] Create `src/server/files.ts` — presigned URL server functions
    - [ ] `getPresignedUploadUrl` — validates checkpoint state, generates PUT URL
    - [ ] `getPresignedDownloadUrl` — validates ownership, generates GET URL
    - [ ] `confirmUpload` — records file metadata in DB after client uploads to R2
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
- [ ] Add i18n translation keys
  - [ ] English (en.json): file uploader labels, validation messages, submission history headers, status labels
  - [ ] Indonesian (id.json): matching translation keys
- [ ] Task: Conductor - User Manual Verification 'Checkpoint Submission Page & Components' (Protocol in workflow.md)

## Phase 4: Integration & Final Verification

- [ ] Task: Run full test suite and verify coverage >80%
- [ ] Task: Run TypeScript typecheck (`pnpm typecheck`)
- [ ] Task: Run linter (`pnpm lint`)
- [ ] Task: Conductor - User Manual Verification 'Integration & Final Verification' (Protocol in workflow.md)
