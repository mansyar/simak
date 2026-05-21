# Track 3.1 — Assignment Creation (Instructor) Specification

## 1. Overview

This track implements the assignment creation and monitoring flow for instructors. Instructors will be able to:

1. View a list of their created assignments.
2. Use a multi-step wizard to create a new assignment: select an assignment template, enter the title, description, and soft final deadline, and select one or more students.
3. Automatically instantiate the assignment, individual student mappings, and the sequential checkpoint checklist for each student (with the first checkpoint `unlocked` and the rest `locked`).
4. Monitor student progress from a central assignment detail dashboard.

---

## 2. User Roles & Access Control

- **Access Guard**: All instructor routes `/instructor/*` are guarded by the layout guard `requireRole(['instructor'])`.
- **Ownership**: Instructors can only view and manage assignments they created.

---

## 3. Functional Requirements

### 3.1 Assignment Listing Page (`/instructor/assignments`)

- **Route**: `/instructor/assignments`
- **Features**:
  - Displays a paginated card-based or table list of assignments created by the logged-in instructor (20 items per page).
  - Search input to filter assignments by title (case-insensitive). persist in URL search params `?q=search_query`.
  - Displays key info: Title, Template Type, Number of Assigned Students, Final Deadline, and Created Date.
  - "Create Assignment" button linking to `/instructor/assignments/new`.
  - Loading skeleton state for async data fetching.

### 3.2 Assignment Creation Wizard (`/instructor/assignments/new`)

- **Route**: `/instructor/assignments/new`
- **Wizard Steps**:
  1. **Select Template**:
     - Fetches active templates (similar to Track 2.2).
     - Allows selecting a template with an interactive preview of its checkpoints.
  2. **Fill Details**:
     - Form fields: Title (text, required), Description (textarea, optional), Final Deadline (date picker, required).
  3. **Select Students**:
     - A searchable multi-select combobox/popover displaying students' names and emails.
     - Fetches only users with the `student` role (excluding soft-deleted users).
     - Allows adding/removing students dynamically from the selection.
  4. **Confirm & Create**:
     - Displays a summary of the template, assignment details, and selected students.
     - "Create Assignment" button to submit the form.
- **Form Validation**:
  - Uses `React Hook Form` + `Zod` validation.
  - Title: String, min 3 characters, max 100 characters.
  - Final Deadline: Date, must be in the future.
  - Selected Students: Array of strings (student IDs), minimum 1 student required.
  - Selected Template: Number (template ID), required.

### 3.3 Server-Side CRUD Functions (`src/server/assignments.server.ts`)

- **`createAssignment`**:
  - Validates input using a Zod schema `CreateAssignmentSchema`.
  - Verifies that the requester is an authenticated user with the `instructor` role.
  - Executes a database transaction:
    1. Inserts the main assignment record into the `assignments` table, referencing the template and setting the `instructorId` to the current user's ID.
    2. For each selected student:
       - Inserts a mapping row into the `assignment_students` table.
       - Retrieves checkpoints from the selected template (ordered by sequence).
       - Inserts corresponding checkpoint instances into the `checkpoints` table for this assignment-student combination:
         - **Gating/State**: The first checkpoint (order = 1) is initialized to `unlocked`.
         - **Subsequent Checkpoints**: All checkpoints with order > 1 are initialized to `locked`.
         - **Thresholds**: Copies `minConsultations` from the template checkpoint definition.
         - **Due Dates**: No initial checkpoint due dates are set (left as null by default).
- **`listInstructorAssignments`**:
  - Fetches paginated assignments for the logged-in instructor.
  - Supports full-text search by title.
- **`getAssignmentDetail`**:
  - Fetches the details of a specific assignment.
  - Returns the assignment metadata along with all assigned students, their current active checkpoint, and their overall progress percentage.

### 3.4 Assignment Detail Page (`/instructor/assignments/$id`)

- **Route**: `/instructor/assignments/$id`
- **Features**:
  - Shows assignment details: Title, Description, Template, Final Deadline.
  - **Student Progress Table**:
    - Lists all assigned students.
    - Shows their overall progress (e.g. "2 / 5 Passed", 40%).
    - Shows the name and state of their current active checkpoint (the first non-passed checkpoint).
    - Status badges for each checkpoint (Passed, Submitted, Under Review, Revise, Unlocked, Locked).
  - Navigation back to `/instructor/assignments`.

---

## 4. Non-Functional & UI Requirements

- **i18n Support**: Full English (`en`) and Indonesian (`id`) translations for all headers, form fields, placeholders, tooltips, validation messages, and loading skeletons.
- **Responsive Layout**: Designed mobile-first using Tailwind CSS. Multi-select combobox adapts to mobile screens.
- **Aesthetic Excellence**: Vibrant and premium card layout, clear progress indicator widgets, and smooth micro-animations for wizard transitions.

---

## 5. Out of Scope

- Submitting files for checkpoints (Track 4.1).
- Reviewing submissions (Track 5.1).
- Group assignments (collaborative student progress) (v2).
- Manual/automatic setting of individual checkpoint due dates during creation (defaulting to null as per user preference).
