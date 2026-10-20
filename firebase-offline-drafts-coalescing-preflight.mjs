import assert from 'node:assert/strict';
import {makeDraftStore} from './firebase-offline-drafts.mjs';

// In-memory asynchronous IndexedDB double: validates commit ACK and ordering,
// never accesses Firebase, accounts, CRM, or a real browser database.
const records=new Map();
const operations=[];
const database={
  transaction(_name,_mode){
    const tx={oncomplete:null,onerror:null,onabort:null};
    tx.objectStore=()=>({
      put(record){
        const req={onsuccess:null,result:undefined};
        queueMicrotask(()=>{
          records.set(record.key,structuredClone(record));
          operations.push('put:'+record.content);
          req.onsuccess?.();
          tx.oncomplete?.();
        });
        return req;
      },
      get(key){
        const req={onsuccess:null,result:undefined};
        queueMicrotask(()=>{
          req.result=records.get(key);
          operations.push('get');
          req.onsuccess?.();
          tx.oncomplete?.();
        });
        return req;
      },
      delete(key){
        const req={onsuccess:null,result:undefined};
        queueMicrotask(()=>{
          records.delete(key);
          operations.push('delete');
          req.onsuccess?.();
          tx.oncomplete?.();
        });
        return req;
      }
    });
    return tx;
  }
};
const factory={open(){
  const req={result:database,onsuccess:null,onerror:null,onblocked:null};
  queueMicrotask(()=>req.onsuccess?.());
  return req;
}};
const store=makeDraftStore({factory,dbName:'unit-test'});
const ctx={uid:'owner_123',mode:'SHARED',groupId:'group_123'};
const snap=content=>({title:'TEST',content,active:null,pendingCreateId:null});

// A burst of keystrokes must commit only the newest queued snapshot.
// All 100 callers still await a real IndexedDB transaction completion.
await Promise.all(Array.from({length:100},(_,i)=>store.save(ctx,snap('text'+i))));
assert.equal(operations.filter(x=>x.startsWith('put:')).length,1);
assert.equal((await store.read(ctx)).content,'text99');

// A read is an ordering barrier: it must see the earlier snapshot,
// and a later save must not jump ahead of the read.
const first=store.save(ctx,snap('before-read'));
const middle=store.read(ctx);
const last=store.save(ctx,snap('after-read'));
await first;
assert.equal((await middle).content,'before-read');
await last;
assert.equal((await store.read(ctx)).content,'after-read');

// A removal is an ordering barrier: an older save cannot reappear later.
const older=store.save(ctx,snap('before-remove'));
const remove=store.remove(ctx);
const newer=store.save(ctx,snap('after-remove'));
await Promise.all([older,remove,newer]);
assert.equal((await store.read(ctx)).content,'after-remove');
await store.remove(ctx);
assert.equal(await store.read(ctx),null);

// Different scopes must remain independent.
const other={uid:'other_123',mode:'SHARED',groupId:'group_123'};
await store.save(other,snap('other-user'));
assert.equal(await store.read(ctx),null);
assert.equal((await store.read(other)).content,'other-user');
console.log('DRAFT_COALESCING_ORDER_AND_ISOLATION_PASS');
