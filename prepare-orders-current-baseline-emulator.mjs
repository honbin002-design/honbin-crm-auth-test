// Synthetic emulator only. Mirrors the observed bridge + push + owner-price baseline.
import './prepare-firestore-task-v5-bridge-emulator-rules.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {mergeOrdersRules} from './firestore-orders-safe-merge.mjs';
const file='.test-rules/firestore.emulator.rules';
let baseline=readFileSync(file,'utf8');
const prices=readFileSync('firestore-owner-supplier-price-REVIEW-ONLY.rules','utf8');
const last=baseline.lastIndexOf('\n  }');
assert(last>0);
baseline=baseline.slice(0,last)+'\n'+prices+baseline.slice(last);
const orders=readFileSync('firestore-orders-v1-REVIEW-ONLY.rules','utf8');
const result=mergeOrdersRules(baseline,orders);
assert(result.exactOriginalPreserved);
assert.throws(()=>mergeOrdersRules(result.merged,orders),/ORDERS_ALREADY_PRESENT/);
writeFileSync('.test-rules/current-baseline.rules',baseline);
writeFileSync(file,result.merged);
console.log('ORDERS_CURRENT_BASELINE_ADDITIVE_ONLY_PASS');
