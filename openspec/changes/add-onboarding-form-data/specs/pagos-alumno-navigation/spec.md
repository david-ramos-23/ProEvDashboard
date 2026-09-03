# Pagos Student Navigation Specification

## Purpose

Let an admin navigate from a payment row on the Pagos page directly to the corresponding
student's detail page, without leaving Pagos to search by name in Alumnos.

## Requirements

### Requirement: Student name in Pagos links to the student detail page

The system MUST render the student name in each Pagos row as a link to that student's detail page
when the row has a known associated student.

#### Scenario: Admin clicks a payment row's student name

- GIVEN the Pagos page listing payment rows, each associated with a student
- WHEN an admin clicks the student name in a payment row
- THEN the app navigates to `/admin/alumnos/:id` for that student's id
- (Verification: manual/Playwright)

### Requirement: Rows without a known student render safely

The system MUST NOT render a link pointing to an invalid destination for a payment row whose
associated student id is empty or unknown; the student name MUST still be visible as text.

#### Scenario: Payment row missing alumnoId

- GIVEN a payment row whose `alumnoId` is empty
- WHEN the Pagos page renders that row
- THEN the student name is shown as plain, non-navigable text
- AND no link pointing to an empty or malformed destination is rendered
- (Verification: manual/Playwright)

## Non-Requirements

- Editing payment or student data from the Pagos page.
- Bulk navigation or multi-select actions.
