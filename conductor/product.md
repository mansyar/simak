# Initial Concept

SIMAK (Sistem Informasi dan Manajemen Akademik) — Help students and instructors track assignment progress through defined checkpoints with structured feedback cycles.

---

# Product Guide: SIMAK

## Project Overview

SIMAK (Sistem Informasi dan Manajemen Akademik) is a web-based academic information and management system designed for universities and schools. It enables instructors to assign structured assignments with sequential checkpoints, allows students to submit work for review, and facilitates structured feedback cycles.

## Core Problem

Students and instructors lack a centralized system to:
- Track assignment progress through staged checkpoints
- Provide and receive structured feedback on submissions
- Manage consultation sessions (Kartu Bimbingan)
- Automate deadline enforcement and escalation workflows

## Target Audience

- **Students** — Submit checkpoint work, track progress, log consultations
- **Instructors** — Create assignments, review submissions, verify consultations
- **Admins** — Manage users and assignment templates
- **SuperAdmin** — Seed the system, create Admin accounts

## Core Features

### MVP (v1)
- **Role-based access** — SuperAdmin, Admin, Instructor, Student roles with permission boundaries
- **Invitation-only registration** — No self-signup; accounts are created by admins with email-based password setup
- **Assignment templates** — Admin-defined templates with ordered checkpoint lists
- **Assignment management** — Instructors create assignments from templates, assign to students
- **Sequential checkpoints** — Students complete checkpoints in order; each unlocks only after the previous is passed
- **File submissions** — Upload .docx/.pdf files (max 25MB) to Cloudflare R2 via presigned URLs
- **Review workflow** — Instructors review submissions with Pass/Revise decisions, comments, and optional feedback files
- **Consultation tracking** — Students log sessions; instructors verify; minimum consultation thresholds gate checkpoint unlocks
- **In-app notifications** — Real-time alerts for submissions, reviews, revision requests, and deadline reminders
- **Deadline management** — Auto-locking overdue checkpoints, instructor override, SLA breach escalation (3-day review SLA)
- **Bilingual i18n** — Full English and Indonesian language support
- **Dark mode & responsive UI** — Light/dark themes, mobile-friendly, accessible (WCAG 2.1 AA)

## Success Metrics

- Instructors can complete the full assignment lifecycle: create → assign → review → provide feedback
- Students can navigate checkpoints sequentially with clear visibility of requirements and progress
- Consultation verification integrates seamlessly into the review gating logic
- Users can switch between English and Indonesian without friction

## Design Principles

- **Progressive disclosure** — Show students only the information they need at each stage
- **Trust but verify** — Students log consultations; instructors verify; gating respects verified counts only
- **Fair deadlines** — Late instructor reviews automatically extend student deadlines by the breach duration
- **Sequential by design** — Checkpoints enforce ordered completion; no skipping ahead
