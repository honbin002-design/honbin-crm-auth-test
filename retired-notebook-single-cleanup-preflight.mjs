import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync('retired-notebook-single-stale-invite-cleanup.mjs','utf8');
assert.equal(spawnSync(process.execPath,['--check','retired-notebook-single-stale-invite-cleanup.mjs'],{encoding:'utf8'}).status,0);
for(const marker of [
 "RETIRED_INVITE_SINGLE_CLEANUP_APPROVED",
 "getUserByEmail(OWNER)","matches.length!==1","activeEditors.length!==3",
 "oldInvites.length!==1","data.role!=='VIEWER'",
 "retired?.deleteState!=='DELETING'","invite?.status!=='PENDING'",
 "tx.update(item.inv.ref,{status:'REVOKED'})",
 "ACTIVE_PRIMARY_EDITOR_ROLE_PRESERVED_PASS",
 "NO_GROUP_NOTES_TASKS_OR_MEMBERS_MODIFIED_PASS"
])assert.ok(source.includes(marker),marker);
const writes=[...source.matchAll(/\btx\.(?:set|update|delete|create)\s*\(/g)].map(x=>x[0]);
assert.deepEqual(writes,['tx.update('],'exactly one status-only Firestore write');
assert.doesNotMatch(source,/\.collection\(['"]notes['"]\)|\.collection\(['"]tasks['"]\)|deleteDoc\(/);
console.log('SINGLE_RETIRED_NOTEBOOK_INVITE_ONLY_STATUS_CHANGE_STATIC_PASS');
