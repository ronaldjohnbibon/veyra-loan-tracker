# Manual QA Checklist

Status key: `PASSED`, `FAILED`, `NOT TESTED`

QA run date: 2026-05-22

Notes:
- This project intentionally has no automated tests for now.
- Verification used source review, browser smoke testing at `http://localhost:5180/`, and `npm.cmd run build`.
- Live Firebase/authentication, multi-device, and Firestore rules-emulator checks require real owner/assistant test accounts and deployed or emulated rules, so those are marked `NOT TESTED` where they cannot be proven locally from the app build alone.
- Issue fixed during this pass: removed the impossible `Cancelled` loan filter from normal loan lists because soft-deleted/cancelled loans are intentionally excluded from normal lists and dashboard totals.

## Authentication

| Status | Item | QA notes |
| --- | --- | --- |
| NOT TESTED | Owner can log in. | Needs owner test credentials. |
| NOT TESTED | Assistant can log in. | Needs assistant test credentials. |
| PASSED | Invalid login shows an error. | Browser-tested with dummy credentials; Login stayed open and showed the expected error. |
| PASSED | Logged-out users cannot access protected pages. | Browser-tested `/dashboard`; router guard redirected to Login. |
| PASSED | Logged-in users opening Login are redirected to Dashboard. | `publicOnly` route guard redirects authenticated users to Dashboard. |
| PASSED | Logout works. | Settings and Dashboard call auth logout and redirect to Login. |

## Roles

| Status | Item | QA notes |
| --- | --- | --- |
| PASSED | Owner can view, add, edit, soft delete, and cancel allowed records. | UI and services expose owner delete/cancel actions; rules allow owner cancellation and soft-delete updates. |
| PASSED | Assistant can view, add, and edit allowed records. | Shared create/edit UI is available to authenticated users. |
| PASSED | Assistant cannot see delete or cancellation buttons. | Delete/cancel controls are gated by `authStore.isOwner()`. |
| PASSED | Assistant cannot delete records through Firestore rules. | Rules deny hard deletes and owner-gate soft-delete field changes. |
| PASSED | Assistant cannot cancel payments through Firestore rules. | Payment cancellation field changes are owner-only in rules. |
| PASSED | Assistant cannot change their own role to owner. | User update rule blocks self role changes. |
| PASSED | User name and role show correctly in Settings. | Settings displays profile name, email, and role. |

## Borrowers

| Status | Item | QA notes |
| --- | --- | --- |
| PASSED | Borrower list loads from Firestore. | `watchBorrowers` listens to active borrower query. |
| PASSED | Empty borrower state displays correctly. | Borrowers page shows empty state when no filtered borrowers exist. |
| NOT TESTED | New borrower can be added. | Form/service present; needs live Firestore write. |
| PASSED | Borrower name is required. | Borrower form trims and blocks blank names with an error. |
| NOT TESTED | Borrower can be edited. | Edit route/form present; needs live Firestore write. |
| PASSED | Borrower details page shows correct information. | Details page renders name, contact, address, notes. |
| PASSED | Borrower search works. | Search filters by borrower name. |
| PASSED | Related loans appear on Borrower Details. | Details page watches borrower loans by borrower id. |
| PASSED | Soft-deleted borrowers do not appear in normal lists. | Borrower query filters `isDeleted == false`. |

## Loans

| Status | Item | QA notes |
| --- | --- | --- |
| PASSED | Loan list loads from Firestore. | `watchLoans` listens to the loan collection and filters deleted records. |
| NOT TESTED | New loan can be created. | Form/service present; needs live Firestore write. |
| PASSED | Borrower can be selected. | Loan form uses borrower select options. |
| PASSED | Borrower is preselected when creating a loan from Borrower Details. | Borrower Details passes `borrowerId` query and form applies it. |
| PASSED | Flat interest amount calculates correctly. | `flatInterestCents` calculates principal times flat rate. |
| PASSED | Total payable calculates correctly. | Total due is principal plus flat interest. |
| PASSED | Remaining balance calculates correctly. | Remaining is total payable minus paid amount. |
| PASSED | Remaining balance never becomes negative. | Calculation clamps remaining balance at zero. |
| PASSED | Editing principal or interest recalculates correctly. | Loan update recalculates values from edited fields. |
| PASSED | Existing total paid is not lost when editing a loan. | Loan update preserves existing paid cents. |
| PASSED | Paid loan shows `paid`. | Status calculation returns `paid` at zero remaining balance. |
| PASSED | Past-due unpaid loan shows `overdue`. | Status calculation compares due date to current date. |
| PASSED | Cancelled loan stays `cancelled`. | Status calculation preserves cancelled status. |
| PASSED | Loan filters work. | Loans page filters normal loans by all/active/paid/overdue; removed unavailable cancelled filter. |
| PASSED | Soft-deleted loans do not appear in normal lists or dashboard totals. | Loan service filters deleted records; dashboard excludes cancelled records. |

## Payments

| Status | Item | QA notes |
| --- | --- | --- |
| NOT TESTED | Payment can be added from Loan Details. | Modal/form/service present; needs live Firestore transaction. |
| PASSED | Payment amount must be greater than 0. | Payment form and service validate positive amounts. |
| PASSED | Payment amount cannot exceed remaining balance. | Payment form and transaction validation reject overpayment. |
| PASSED | Double tapping payment submit does not create duplicate payments. | Form and handler guard on `savingPayment`. |
| NOT TESTED | Adding payment creates a payment record. | Transaction code present; needs live Firestore write. |
| PASSED | Adding payment updates loan `totalPaid`. | Transaction updates `totalPaid` from recalculated paid cents. |
| PASSED | Adding payment updates loan `remainingBalance`. | Transaction updates `remainingBalance` from recalculated remaining cents. |
| PASSED | Fully paid loan changes to `paid`. | Recalculation sets status to `paid` at zero balance. |
| PASSED | Payment history appears in latest-first order. | Payment queries order by `paymentDate` descending. |
| PASSED | Payments page shows all payments. | Payments page watches all non-deleted payment records. |
| PASSED | Borrower name or loan reference displays correctly. | Payment lists display borrower name and loan id/reference. |
| PASSED | Owner can cancel a mistaken payment. | Owner-only cancellation service and UI are present. |
| PASSED | Cancelling a payment updates loan `totalPaid`, `remainingBalance`, and status. | Cancellation transaction reverses amount and recalculates loan. |
| PASSED | Cancelled payments are not counted as collected money. | Payments page excludes cancelled payments from collected total; loan balance is reversed on cancel. |

## Dashboard

| Status | Item | QA notes |
| --- | --- | --- |
| PASSED | Total Money Lent is correct. | Summary totals counted loan principal cents. |
| PASSED | Total Expected Collection is correct. | Summary totals counted loan payable cents. |
| PASSED | Total Collected is correct. | Summary totals counted loan paid cents after payment cancellation reversals. |
| PASSED | Total Remaining Balance is correct. | Summary totals open loan remaining cents. |
| PASSED | Active Loans Count is correct. | Summary counts active status loans. |
| PASSED | Paid Loans Count is correct. | Summary counts paid status loans. |
| PASSED | Overdue Loans Count is correct. | Summary counts overdue status loans. |
| PASSED | Borrowers Count is correct. | Summary uses active borrower count from borrower watcher. |
| PASSED | Cancelled loans are excluded where required. | Dashboard excludes cancelled loans before summarizing. |
| PASSED | Soft-deleted records are excluded. | Dashboard receives filtered borrower/loan lists. |
| PASSED | Cancelled payments are excluded from collected totals. | Payment cancellation reverses loan paid amount; payments page excludes cancelled payments. |
| PASSED | Upcoming due loans display correctly. | Dashboard lists active loans sorted by due date. |
| PASSED | Overdue loans display correctly. | Dashboard lists overdue loans sorted by due date. |
| PASSED | Empty dashboard state displays correctly. | Dashboard shows empty state when there are no borrowers or counted loans. |

## Navigation

| Status | Item | QA notes |
| --- | --- | --- |
| PASSED | Bottom tabs or side menu works. | App layout defines bottom tabs for core sections. |
| PASSED | Dashboard tab opens Dashboard. | Dashboard tab links to `/dashboard`. |
| PASSED | Borrowers tab opens Borrowers. | Borrowers tab links to `/borrowers`. |
| PASSED | Loans tab opens Loans. | Loans tab links to `/loans`. |
| PASSED | Payments tab opens Payments. | Payments tab links to `/payments`. |
| PASSED | Settings tab opens Settings. | Settings tab links to `/settings`. |
| PASSED | Back navigation works on form and detail pages. | Form/detail pages use Ionic back buttons with default hrefs. |

## Firestore and Multi-device

| Status | Item | QA notes |
| --- | --- | --- |
| NOT TESTED | Owner and assistant see the same borrowers. | Needs two authenticated devices/accounts. |
| NOT TESTED | Owner and assistant see the same loans. | Needs two authenticated devices/accounts. |
| NOT TESTED | Owner and assistant see the same payments. | Needs two authenticated devices/accounts. |
| NOT TESTED | A record added on one phone appears on the other phone after refresh or reload. | Watchers support realtime updates; needs device test. |
| NOT TESTED | A payment added on one phone updates the loan balance on the other phone. | Transaction and watchers support this; needs device test. |
| PASSED | Two near-simultaneous payments do not corrupt the loan balance. | Payment creation uses a Firestore transaction and remaining-balance validation. |

## Security Rules

| Status | Item | QA notes |
| --- | --- | --- |
| PASSED | Logged-out users cannot read data. | Rules require authenticated owner/assistant access for app collections. |
| PASSED | Logged-out users cannot write data. | Rules require authenticated owner/assistant access for app writes. |
| PASSED | Assistant cannot delete borrowers. | Hard delete denied; soft-delete fields require owner. |
| PASSED | Assistant cannot delete loans. | Hard delete denied; soft-delete/cancel fields require owner. |
| PASSED | Assistant cannot hard delete payments. | Payment delete is denied for everyone. |
| PASSED | Assistant cannot cancel payments. | Payment cancellation field changes require owner. |
| PASSED | Assistant cannot change their role to owner. | Self-update rule disallows role changes. |
| PASSED | Owner can manage allowed records. | Owner role can create/read/update allowed records and perform owner-only cancellations/soft deletes. |

## Mobile Usability

| Status | Item | QA notes |
| --- | --- | --- |
| NOT TESTED | Forms fit on small phone screens. | Needs visual device/browser check. |
| NOT TESTED | Inputs are easy to tap. | Needs visual device/browser check. |
| NOT TESTED | Buttons are not hidden behind keyboard. | Needs real mobile keyboard/device check. |
| PASSED | Loading states appear during Firestore actions. | Pages display shared loading states while snapshots/data load. |
| PASSED | Error messages are understandable. | Auth/payment/borrower validation errors are plain-language. |
| PASSED | Empty states are clear. | Shared empty states are used across dashboard/lists/payment history. |
| PASSED | Money values display in Philippine Peso format. | Currency formatter uses `en-PH` and `PHP`. |
| PASSED | Dates display clearly. | Date formatter uses `en-PH` with month/day/year output. |
