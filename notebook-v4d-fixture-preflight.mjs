import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('notebook-v4d-fixture-create.html','utf8');
assert.match(s,/v4d_test_/);
assert.match(s,/approvedAccounts/);
assert.match(s,/create/);
assert.match(s,/getDocFromServer/);
assert.ok(!s.includes('deleteDoc('));
console.log('V4D_SYNTHETIC_FIXTURE_CREATE_ONLY_PASS 5');
