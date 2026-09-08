# Leave workflow reliability

This branch is not production-certified. Do not merge or deploy until CI, database integration tests, and a campus acceptance test pass.

## Lifecycle

Request coverage creates one leave and one request per scheduled period in the inclusive date range. A substitute accepts an individual period. Only after every linked period has an accepted substitute can the teacher submit the reason. HOD reviews submitted leaves; Principal reviews HOD-approved leaves. Final approval posts the balance in the same MongoDB transaction. Rejections require a reason. Date range and leave type are immutable after coverage creation; request a new leave to change them.

## Database requirements

MongoDB must support multi-document transactions (replica set or sharded cluster). A standalone MongoDB server is not sufficient. Ensure indexes are created before enabling writes. Check existing data for duplicate substitute assignments and duplicate leave-period requests before building the new unique indexes. Do not delete historical records automatically.

The User.workflowRevision field serializes concurrent coverage creation and substitute acceptance for a teacher. The SubstituteRequest unique indexes protect accepted teacher/date/period assignments. The leave balance model retains its existing unique teacher/year index. Existing leave records must be audited before migration: legacy single-period leaves, missing linked requests, old approval statuses, and previously deducted balances cannot safely be inferred or rewritten automatically.

## Verification

Run `npm ci && npm test` in backend and `npm ci && npm run build` in frontend. Run database integration tests against a disposable replica set, including two simultaneous acceptances, two simultaneous overlapping leave creations, simultaneous claims of different requests by the same substitute, rollback on failed approval, repeated final approval, and cross-year balance posting. Test the complete teacher → substitute → HOD → Principal journey with real accounts and a multi-day timetable.

## Policy decisions still required

The current balance logic charges calendar days and uses the existing half-year totals. Campus policy must define holidays, weekends, half-days, leave-type-specific balances, privileged leave usage, and cross-year rules before production use. The current same-class eligibility rule is inherited from the existing timetable workflow. Confirm whether department, subject qualification, and timetable changes should further restrict substitutes. There is no cancellation/reassignment workflow yet; rejected coverage remains historical and should be handled through an explicit audited cancellation policy.
