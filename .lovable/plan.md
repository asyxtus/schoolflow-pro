# Plan — Registration & Structure Overhaul + Fixes

Tackling 8 items in one coordinated pass. Grouped by area.

## 1. Fee Structures & Registration Fees

**DB migration** — extend `fee_structures`:
- Add `kind` ('registration' | 'tuition' | 'other'), `installments` (int, default 1), `due_dates` (jsonb: `[{label, amount_fcfa, due_date}]`), `required_at_registration` (bool).

**Admissions flow** — when admitting an applicant (`admitApplicant`):
- After creating the student, auto-create `student_fees` invoices from every active fee structure for their class (registration + tuition installments, each with its own `due_date` from the structure).
- Show unpaid registration fees on the admit dialog; block "Admit" until registration fee is paid OR mark student as `pending_payment`.

**Finance UI** — Fee Structures tab:
- New "Structure builder" dialog: choose kind, add N installments with label + amount + deadline (date picker).
- Balances/Invoices tabs already surface `due_date`; add an "Overdue" filter chip.

## 2. Class-picker everywhere (no free-text)

Replace free-text class inputs with a dropdown fed from the live `classes` list (from `getClasses`) in:
- `admissions/new` (Desired class)
- `students/new` and student edit
- Admit-applicant dialog
- Timetable / Bulletin / Coefficient screens where a class is chosen
- Fee structure builder (class scoping)

## 3. Classes management

New route `/classes/manage` (also from Classes page "Manage"):
- Create / rename / archive class.
- Each class stores: name, level, sections[], default coefficients.
- Backed by new `classes` table (currently classes are derived from `students.class_name`). Migration seeds it from existing distinct class names so nothing breaks.

## 4. Subjects per class

New table `class_subjects` (class_id, subject, coefficient, teacher_id).
UI on the class detail page: add/remove subjects for that specific class.
Bulletin score entry filters subjects by the student's class.

## 5. Teachers, roles, and role-based access

**DB**:
- Extend `app_role` enum: `vice_principal, discipline_master, bursar, secretary, sports_master, dean_of_studies, counsellor, boarding_master` (some already exist — add missing ones).
- `user_roles` already supports multiple rows per user (multiple roles). Keep as-is.
- `teacher_subjects` table (teacher user_id ↔ class_subject_id).

**UI** — Settings › Users & Roles:
- "Add teacher" flow (invite + assign role(s) + subjects).
- Multi-select roles per user.
- Role-based sidebar: filter nav items by role (bursar → Finance/Reports; discipline_master → Attendance/Boarding; etc.).

## 6. Bug fixes

- **Library checkout can't select added book** — `getAvailableBooks` likely filters by `available_copies > 0`; new books have 0 copies until you add copies. Fix: also allow selecting a book and show its copies dropdown; or auto-create a copy when adding a book (add an "Initial copies" field on book create). Chosen: add "Initial copies" input on book creation + fix the selector to list all books that have ≥1 available copy.
- **Fulfil button does nothing** — `library/reservations` fulfil handler isn't wired; add `fulfilReservation` server fn (mark reservation `fulfilled`, create loan for the reserving student on first available copy) and invalidate queries on success.
- **Financial reports = Reports** — sidebar currently has two links pointing to overlapping routes. Remove the duplicate "Reports" entry (keep "Academic Reports" for bulletins/grades and "Financial Reports" for money), rename for clarity.

## Technical notes

- All new tables get GRANTs + RLS scoped by `school_id` and `has_role` / `can_manage_*` helpers.
- Migrations run first (single migration), then code changes.
- Role-gated sidebar reads current user's roles via a new `getMyRoles` server fn cached in QueryClient.

## Order of execution

1. Migration (classes, class_subjects, teacher_subjects, fee_structures extensions, new roles).
2. Fix duplicate Reports sidebar entry + library bugs (quick wins).
3. Classes management + subjects UI.
4. Class-picker rollout across forms.
5. Fee structure builder + auto-invoice on admission.
6. Teachers/roles UI + role-based sidebar filtering.

Reply "go" to proceed, or tell me which items to drop/reorder.