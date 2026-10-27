import assert from 'node:assert/strict';
import {normalizeOrder,orderChangeSummary,orderStatusLabels} from './orders-v1-service.mjs';
const base={productName:'PUR 631',specification:'透明',quantity:20,unit:'KG',
 supplierName:'測試供應商',requesterUid:'u1',orderedByUid:'',orderDate:'',
 dueDate:'2026-11-05',arrivedQuantity:0,status:'PENDING',note:''};
assert.equal(normalizeOrder(base).status,'PENDING');
assert.equal(orderStatusLabels.RECEIVED,'已完成');
assert.throws(()=>normalizeOrder({...base,quantity:0}),/INVALID_ORDER_FIELDS/);
assert.throws(()=>normalizeOrder({...base,arrivedQuantity:3}),/ARRIVED_QUANTITY_REQUIRES/);
assert.throws(()=>normalizeOrder({...base,status:'RECEIVED',arrivedQuantity:10}),/RECEIVED_REQUIRES/);
assert.throws(()=>normalizeOrder({...base,status:'PARTIAL',arrivedQuantity:0}),/PARTIAL_REQUIRES/);
assert.throws(()=>normalizeOrder({...base,status:'PENDING',orderDate:'2026-11-01'}),/PENDING_CANNOT/);
assert.equal(normalizeOrder({...base,status:'PARTIAL',arrivedQuantity:4,orderDate:'2026-10-27',orderedByUid:'u1'}).arrivedQuantity,4);
assert.equal(normalizeOrder({...base,status:'RECEIVED',arrivedQuantity:20,orderDate:'2026-10-27',orderedByUid:'u1'}).arrivedQuantity,20);
const diff=orderChangeSummary(base,{...base,status:'ORDERED',orderDate:'2026-10-27'});
assert.deepEqual(diff.map(x=>x.field),['orderDate','status']);
console.log('ORDERS_V1_VALIDATION_AND_AUDIT_DIFF_PASS');


assert.throws(()=>normalizeOrder({...base,status:'ORDERED'}),/ORDERED_REQUIRES_DATE_AND_ACTOR/);
