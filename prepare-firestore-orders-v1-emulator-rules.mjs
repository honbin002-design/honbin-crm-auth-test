// Emulator only: never reads or writes live Firebase.
import './prepare-firestore-task-v5-emulator-rules.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const path='.test-rules/firestore.emulator.rules';
const base=readFileSync(path,'utf8');
const anchor='match /tasks/{taskId} {';
if(base.split(anchor).length!==2)throw Error('TASK_RULES_ANCHOR_NOT_UNIQUE');
const fragment=readFileSync('firestore-orders-v1-REVIEW-ONLY.rules','utf8');
const result=base.replace(anchor,()=>fragment+'\n'+anchor);
writeFileSync(path,result);
console.log('SYNTHETIC_ORDERS_V1_EMULATOR_RULES_READY');
