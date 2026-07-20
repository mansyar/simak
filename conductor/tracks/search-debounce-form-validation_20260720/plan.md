<protect>
# Implementation Plan: Search Debounce & Form Validation

**Track ID:** search-debounce-form-validation
**Audit IDs:** UX-25, UX-26, UX-27, UX-28, UX-54, UX-56

## Phase 1: Debounce & Clear Filters [checkpoint: 184b0ba]

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `./spec.md` for requirements and acceptance criteria
    - [x] Read `conductor/workflow.md` for TDD lifecycle and checkpoint protocol

- [x] Task: Create `useDebouncedCallback` hook [22e0fb9]
    - [x] Write failing tests in `tests/unit/hooks/use-debounced-callback.test.ts` — verify: callback fires only after delay, re-call resets timer, cleanup clears timer on unmount
    - [x] Implement `src/hooks/use-debounced-callback.ts` (~15 lines: `setTimeout`/`clearTimeout`, `useRef` for timer, `useCallback` for stable reference)
    - [x] Run `pnpm test` — confirm tests pass
    - [x] Run `pnpm typecheck` and `pnpm lint` — confirm clean

- [x] Task: Apply debounce + clear button to 4 server-side search inputs [3c9aa8d]
    - [x] Write failing tests for `StudentAssignmentFilters` — verify: rapid typing (9 keystrokes) fires 1 `navigate()` call (not 9), X button clears search, X hidden when search empty
    - [x] Write failing tests for `UserFilters` — same assertions
    - [x] Write failing tests for `AssignmentFilters` — same assertions
    - [x] Write failing tests for `audit-log.tsx` — same assertions
    - [x] Add i18n key `common.clearSearch` (aria-label for X button) to `locales/en.json` and `locales/id.json`
    - [x] Run `pnpm generate:i18n`
    - [x] Implement: wrap `onSearchChange`/`handleSearchChange` with `useDebouncedCallback(fn, 300)` in all 4 components
    - [x] Implement: add conditional X icon button (`absolute right-2.5 top-2.5`, lucide-react `X`) to all 4 search input wrappers — visible only when `search !== ''`, `onClick` calls `onSearchChange('')`
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` — confirm clean

- [x] Task: Conductor - User Manual Verification 'Phase 1: Debounce & Clear Filters' (Protocol in workflow.md)

## Phase 2: Form Migration

- [x] Task: Read spec.md and workflow.md to refresh context
    - [x] Read `./spec.md` for requirements and acceptance criteria
    - [x] Read `conductor/workflow.md` for TDD lifecycle and checkpoint protocol

- [x] Task: Migrate ConsultationForm to react-hook-form + Zod [3e40f2e]
    - [x] Write failing tests — verify: empty `notes` shows error on blur, `sessionType: 'external'` with empty `externalConsultantName` shows error, valid submission calls `logConsultation`
    - [x] Add i18n keys for form error messages to `locales/en.json` and `locales/id.json`
    - [x] Run `pnpm generate:i18n`
    - [x] Implement: replace raw `useState` with `useForm` + `zodResolver(LogConsultationSchema)`, add `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` for each field, `onBlur` + `onSubmit` validation
    - [x] Run `pnpm test` — confirm tests pass
    - [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` — confirm clean

- [x] Task: Migrate ExtensionRequestForm to react-hook-form + Zod [bc345c5]
    - [x] Write failing tests — verify: `reason` < 10 chars shows error on blur, `duration` > `maxExtensionDays` shows error, valid submission calls `requestExtension`
    - [x] Add i18n keys for form error messages to `locales/en.json` and `locales/id.json`
    - [x] Run `pnpm generate:i18n`
    - [x] Implement: replace `useState` with `useForm` + `zodResolver(RequestExtensionSchema)`, add `FormField` components, `onBlur` + `onSubmit` validation
    - [x] Run `pnpm test` — confirm tests pass
    - [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` — confirm clean

- [x] Task: Migrate PasswordSection to react-hook-form + Zod [d5e6aff]
    - [x] Write failing tests — verify: mismatched `newPassword`/`confirmPassword` shows error on blur, `newPassword` < 8 chars shows error, valid submission calls `authClient.changePassword`
    - [x] Add i18n keys for password form error messages to `locales/en.json` and `locales/id.json`
    - [x] Run `pnpm generate:i18n`
    - [x] Implement: create local Zod schema (`currentPassword` required, `newPassword` min 8, `confirmPassword` must match via `.refine`), replace `useState` with `useForm` + `zodResolver`, add `FormField` components, `onBlur` + `onSubmit` validation
    - [x] Run `pnpm test` — confirm tests pass
    - [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` — confirm clean

- [~] Task: Conductor - User Manual Verification 'Phase 2: Form Migration' (Protocol in workflow.md)

## Phase 3: Upload Progress

- [ ] Task: Read spec.md and workflow.md to refresh context
    - [ ] Read `./spec.md` for requirements and acceptance criteria
    - [ ] Read `conductor/workflow.md` for TDD lifecycle and checkpoint protocol

- [ ] Task: Replace `fetch` with `XMLHttpRequest` + add upload progress bar
    - [ ] Write failing tests for `CheckpointSubmissionPage` — verify: `XMLHttpRequest` is used (not `fetch`), `xhr.upload.onprogress` updates progress state, progress value passed to `FileUploader`
    - [ ] Write failing tests for `FileUploader` — verify: `Progress` bar renders when `isUploading` + `uploadProgress` available, `Loader2` spinner shows as fallback when progress unavailable
    - [ ] Verify `@/components/ui/progress` exists; if not, add via shadcn/ui CLI (`pnpm dlx shadcn@latest add progress`)
    - [ ] Implement: replace `fetch(uploadUrl, { method: 'PUT', body: file })` with `XMLHttpRequest` in `CheckpointSubmissionPage`, add `xhr.upload.onprogress` handler computing `Math.round((loaded / total) * 100)`, store progress in state, pass `uploadProgress` prop to `FileUploader`
    - [ ] Implement: add `Progress` bar component to `FileUploader` when `isUploading` is true, keep `Loader2` spinner as fallback
    - [ ] Run `pnpm test` — confirm tests pass
    - [ ] Run `pnpm typecheck`, `pnpm lint` — confirm clean

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Upload Progress' (Protocol in workflow.md)
</protect>
