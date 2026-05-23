# Track 4.1 — File Upload & Submission (Student)

## Overview

Students can upload `.docx`/`.pdf` files for unlocked checkpoints via a dedicated submission page. Files are uploaded directly to Cloudflare R2 through presigned URLs. Each upload creates a versioned submission record. Students can view their submission history and download previously submitted files.

## Route Structure

- `/student/assignments/$id/checkpoints/$checkpointId` — Dedicated checkpoint submission page with:
  - File upload zone (drag-and-drop)
  - Submission/version history list
  - Latest review result display

## Functional Requirements

### FR1: File Upload via Presigned URLs

- Server generates a UUID-based file key (`submissions/{uuid}.{ext}`) and returns it alongside a short-lived (5 min) presigned PUT URL
- Client uploads the file directly to R2 via the presigned URL using the provided key
- After successful upload, client calls `submitCheckpoint` to record the submission metadata in the database and transition the checkpoint state
- The file key is generated server-side to prevent key collisions and ensure traceability

### FR2: File Validation

- Accepted formats: `.docx` and `.pdf` only
- Maximum file size: 25MB
- **Client-side**: Accept attribute + JS `file.type` and `file.size` checks (covers typical user mistakes)
- **Server-side**: Validate file extension from the filename. Note: true MIME/content inspection is not possible with presigned URLs since the file goes directly from browser to R2 — the server never receives the file bytes. The R2 bucket may be configured with a bucket policy to restrict content types as an additional safeguard.
- Uploading to a locked checkpoint returns a server-side validation error (checked before presigned URL generation)

### FR3: Submission Versioning

- First upload creates version 1
- Each resubmission (after a `revise` decision) auto-increments version by 1
- All versions are immutable — resubmission creates a new row

### FR4: Checkpoint State Transitions

- `unlocked` → `submitted` on first successful upload
- `revise` → `submitted` on resubmit (the student uploads a file, which transitions the checkpoint directly from `revise` to `submitted` in a single operation)
- The `submitted` → `under_review` transition is triggered when instructor opens the submission (separate track, Track 5.1)

> **Note:** The TDD state machine shows `REVISE → UNLOCKED (loop)` as a conceptual step indicating the student is unblocked to upload again. In practice, since the upload happens immediately, the actual handler transitions directly from `revise` to `submitted`.

### FR5: Submission History & Download

- Students can view all versions of their submissions for a checkpoint
- Each version shows: file name, file size, upload timestamp, version number
- Each version has a download link (presigned GET URL, 1 hour validity)
- File downloads are ownership-gated: student A cannot access student B's files

### FR6: Review Status Display

- If the latest submission has a review, show the result (pass/revise), comment, and revision deadline
- If no review exists yet, show "Awaiting review"

## Non-Functional Requirements

- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Security**: Presigned URLs expire after 5 min (upload) / 1 hour (download)
- **R2 Client**: `@aws-sdk/s3-request-presigner` or native `fetch`-based approach for R2
- **Dev Fallback**: When R2 env vars are not configured, use an in-memory/localStorage mock for development
- **Error Handling**: R2 failures surface as upload errors with retry guidance

## Acceptance Criteria

- [ ] Upload zone accepts `.docx` and `.pdf` files only (rejects `.png`, `.exe`, etc.)
- [ ] File > 25MB shows a validation error before upload
- [ ] Uploading to an unlocked checkpoint changes its state to `submitted`
- [ ] Resubmitting after a `revise` creates a new version (version increments by 1)
- [ ] Version history shows all submissions with timestamps and download links
- [ ] Downloaded file matches the original uploaded content
- [ ] Uploading to a locked checkpoint returns a validation error
- [ ] Student A cannot see or download student B's submissions (even on same assignment)

## Out of Scope

- Instructor review workflow (Track 5.1)
- Feedback file upload
- PDF in-browser preview (v2)
- Group submissions (v2)
- Email notifications for submissions (v2)
- Orphan R2 file cleanup (stale presigned URLs where the client uploads to R2 but crashes before calling `submitCheckpoint` — storage impact is negligible for MVP; automated garbage collection deferred to v2)
