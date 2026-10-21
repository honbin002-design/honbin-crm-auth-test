# 鴻繽記事與任務 TEST｜任務全員發布與延期流程施工規格（REVIEW ONLY）
Status: HISTORICAL PLAN with verified 2026-10-21 TEST checkpoint below. Project: honbin-crm-notes-spark.

## CURRENT CHECKPOINT (2026-10-21, Asia/Taipei) — supersedes historical "Current delivered" text below
- Authority: `honbin002-design/honbin-crm-auth-test`, branch `main`; independent TEST only. Never modify formal CRM, existing production notes, or other projects.
- V4 TEST is reported live by the existing workspace gate. Publisher-defined approved due dates, separate requested dates, and request/rejection history have already been implemented. Last reported cross-account acceptance: PASS; do not retest PASS/FROZEN just to repeat it.
- V5 Firestore rules remain **REVIEW ONLY / NOT DEPLOYED**, even though the synthetic emulator workflow passed. Strict V5 requires immutable `originalDueDate` on new extension requests and blocks task completion while an extension is pending.
- Workspace flag `TASK_V5_ORIGINAL_DUE_AUDIT_ENABLED=false` is deliberately held to preserve existing live V4 writes. **DO NOT publish strict V5 directly while that flag remains false**: V4-format extension requests could be rejected in the cutover window. Do not flip the client flag before a compatible server rule is published either.
- Frontend client guard now independently blocks completion during a pending extension; regression checks assert zero writes for the denied path. Commit `28268155`; 2026-10-21 Auth-only workflow PASS and GitHub Pages deployment PASS. The server-level guard still requires reviewed V5 rules before being claimed LIVE.
- Exact merge tool `firestore-task-v5-upgrade-review.html` safely compares a pasted CURRENT complete TEST rule set and preserves every non-task block verbatim. No complete live Firebase rules readback is available in this connector session.
- NEXT: design/verify a no-downtime V4→V5 compatibility bridge, read back actual currently deployed TEST rules in Firebase Console, run full emulator denials on the exact combined candidate, publish **TEST only** with authority confirmation, switch client audited writes only after live rule verification, and perform one positive/negative two-account live readback. Keep V4 operational until safe cutover. No additional accounts, fees, or PROD changes.
- Never equate GitHub Pages success or emulator PASS with live Firebase Rule publication.
Do not change formal CRM, deployed Firestore rules, existing tasks or historical data without reviewed TEST rules and server ACL tests.

## Requirements
- Every ACTIVE group member, including VIEWER, may create a group task. VIEWER remains read-only for SHARED NOTES. An approved Google identity alone is never sufficient; membership must be ACTIVE.
- All ACTIVE group members may list/read all tasks in their group, including completed tasks. Nonmembers/revoked members cannot read, create, request extension or approve.
- Store immutable createdBy UID and createdAt server timestamp. Render public nickname when present, otherwise verified account/email or identifiable UID; never pretend missing nickname is identity.
- Group task board: OPEN overdue, OPEN due within 3 calendar days (Taipei date), other OPEN, DONE archive. Never mutate task state merely by showing warnings.
- Due date is optional; no deadline means no expiry warning or extension request.
- Executor (assigned UID or eligible member for open task) can request a new due date and write a nonempty reason. The original due date remains effective while request is PENDING. One pending request per task at a time.
- Only the immutable original publisher UID can approve/reject the request. Publisher cannot silently change dueDate; approval must be tied to the exact request, must be atomic, must use server timestamp and leave an immutable audit trail.
- For a task published by the same person as executor, publisher still approves; the UI must show who is acting and retain audit, with optional owner policy to prevent self-approval if requested.
- On approval, new due date becomes effective, old due date remains in history. Rejection keeps old date. Completed tasks cannot request/approve extension.
- The task assignee and completion record cannot be overwritten. Preserve existing completed tasks unchanged.
- Free-only: in-app notices on page load/refresh now; iPhone background push remains disabled until a secure free sender exists. Never claim Safari page notifications work while app is closed.

## Security plan (not implemented/deployed)
1. Read back exact deployed TEST Firestore rules; preserve existing account approval, V4D notes, groups, invites, owner controls and all existing matches.
2. Design append-only extension request history, e.g. task-scoped immutable requests, with a single pending request and atomic publisher decision. Prove rules can enforce matching task state/request and prevent direct dueDate edits. Prefer getAfter or transaction-coupled checks only after emulator validation.
3. Extend task create allowlist for all ACTIVE members without expanding shared-note edit permissions. Verify server rejects unauthenticated, unapproved, nonmember, revoked, cross-group and forged createdBy.
4. Server denial tests: viewer cannot modify shared notes; non-assignee cannot complete or request; non-publisher cannot approve; no self-alteration of createdBy/completedBy/server timestamps; no direct deadline edits; no deleting task/history; no repeated approvals.
5. Backward compatibility for tasks created before extension feature, including optional missing audit fields.
6. Independent emulator tests + real TEST server positive/negative readback. Only then explicitly authorize and deploy rules. No PROD changes.

## Current delivered
- Existing tasks and VIEWER completion PASS; all-member task create and extension writes NOT YET ENABLED.
- Task board UI publisher display and due-date classification added in commit 196b93b; no Firestore rule changes.
