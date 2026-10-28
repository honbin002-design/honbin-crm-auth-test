import {orderService,orderStatusLabels,orderChangeSummary} from './orders-v1-service.mjs';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stamp=value=>value?.toDate?.().toLocaleString('zh-TW',{hour12:false})||'待確認';
const fieldLabels={productName:'品名',specification:'規格',quantity:'數量',unit:'單位',supplierName:'供應商',requesterUid:'建立人',orderedByUid:'訂貨人',orderDate:'訂貨日期',dueDate:'預計交期',arrivedQuantity:'已到貨數量',status:'狀態',note:'備註'};

const markup=`<style>
 :host{display:block;color:#20334d;font:inherit}*{box-sizing:border-box}
 button,input,select,textarea{font:inherit;color:inherit;border:1px solid #bdccdc;border-radius:10px;background:#fff;min-height:44px;padding:8px 11px}
 button{cursor:pointer}button:disabled{opacity:.55;cursor:default}.primary,.active{background:#205a9a;color:#fff;border-color:#205a9a}
 .toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;align-items:end}.toolbar label{display:grid;gap:3px}
 .toolbar select{width:100%}.filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:10px 0}
 .filters button{min-width:0}.search{width:100%}.status{margin:8px 0;color:#52657b;font-size:.9rem}.list{display:grid;gap:9px;margin:9px 0}
 .card,.detail{border:1px solid #d6e1ed;border-radius:12px;background:#fff;padding:12px}.card{width:100%;text-align:left;display:grid;gap:3px}
 .card strong{font-size:1rem}.meta{color:#52657b;font-size:.88rem;overflow-wrap:anywhere}.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
 .pill{font-size:.8rem;padding:3px 8px;border-radius:20px;background:#e7eff9;white-space:nowrap}.detail h2{font-size:1.1rem;margin:0 0 8px}
 .detail p{margin:5px 0;overflow-wrap:anywhere}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 .fields label{display:grid;gap:3px;min-width:0}.fields input,.fields select,.fields textarea{width:100%}.wide{grid-column:1/-1}
 .history{margin:7px 0 0;padding-left:19px;font-size:.88rem}.history li{padding:5px 0;border-bottom:1px solid #e7ecf2;overflow-wrap:anywhere}
 .hint{font-size:.85rem;color:#52657b}.empty{padding:12px 0}.error{color:#a33225}.more{margin:7px 0}
 [hidden]{display:none!important}@media(max-width:520px){.toolbar{grid-template-columns:1fr 1fr}.toolbar label{grid-column:1/-1}.toolbar button{min-width:0}.fields{grid-template-columns:1fr}}
 </style>
 <div class="toolbar"><label>共用群組<select id="group" aria-label="共用群組"></select></label><button id="refresh">重新整理</button><button id="new" class="primary">＋ 新增訂貨</button></div>
 <div class="filters" role="tablist" aria-label="訂貨狀態"><button class="active" data-filter="all">全部</button><button data-filter="done">已完成</button><button data-filter="open">未完成</button></div>
 <input id="search" class="search" aria-label="搜尋訂貨" placeholder="搜尋產品、供應商、訂貨人、備註">
 <p id="status" class="status" role="status"></p><div id="list" class="list"></div><button id="more" class="more" hidden>載入更多</button>
 <section id="detail" class="detail" hidden></section>
 <section id="editor" class="detail" hidden><h2 id="editTitle">新增訂貨</h2><form id="form"><div class="fields">
 <label>品名<input name="productName" maxlength="120" required></label><label>規格<input name="specification" maxlength="200"></label>
 <label>數量<input name="quantity" type="number" step="any" min="0.001" required></label><label>單位<input name="unit" maxlength="20" value="KG" required></label>
 <label>供應商<input name="supplierName" maxlength="120" required></label><label>訂貨狀態<select name="status"><option value="PENDING">待訂貨</option><option value="ORDERED">已訂貨</option><option value="PARTIAL">部分到貨</option><option value="RECEIVED">已完成</option></select></label>
 <label>訂貨日期<input name="orderDate" type="date"></label><label>預計交期<input name="dueDate" type="date"></label>
 <label>已到貨數量<input name="arrivedQuantity" type="number" step="any" min="0" value="0"></label>
 <label class="wide">備註<textarea name="note" rows="2" maxlength="2000"></textarea></label>
 </div><div class="actions"><button id="save" type="submit" class="primary">儲存</button><button id="cancel" type="button">取消</button></div></form></section>`;

export function mountOrdersWorkspace({container,db,sdk,auth,groups,listVerifiedGroups,onGroupReady}){
 if(!container||!auth?.currentUser||!groups)throw Error('ORDER_AUTH_REQUIRED');
 const root=container.shadowRoot||container.attachShadow({mode:'open'});
 root.innerHTML=markup;
 const $=id=>root.getElementById(id),svc=orderService({db,sdk,currentUid:()=>auth.currentUser?.uid});
 const owner=auth.currentUser.uid;
 let groupId='',items=[],cursor=null,hasMore=false,filter='all',epoch=0,loading=false,saving=false,editing=null,disposed=false;
 const names=new Map();
 const live=check=>!disposed&&auth.currentUser?.uid===owner&&check===epoch;
 const showStatus=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error)};
 const nameFor=async id=>{
  if(!id)return '—';if(names.has(id))return names.get(id);
  let name=id.slice(0,8)+'…';
  try{const snap=await sdk.getDocFromServer(sdk.doc(db,'profiles',id));if(snap.exists()&&snap.data().nickname)name=snap.data().nickname}catch{}
  names.set(id,name);return name;
 };
 function render(){
  const term=$('search').value.trim().toLocaleLowerCase('zh-Hant');
  const shown=items.filter(x=>[x.details.productName,x.details.specification,x.details.supplierName,x.details.note,names.get(x.updatedBy),names.get(x.details.orderedByUid),x.updatedBy]
   .join(' ').toLocaleLowerCase('zh-Hant').includes(term));
  $('list').innerHTML=shown.map(x=>`<button class="card" data-id="${escapeHtml(x.id)}"><span class="row"><strong>${escapeHtml(x.details.productName)}</strong><span class="pill">${escapeHtml(orderStatusLabels[x.details.status]||x.details.status)}</span></span><span class="meta">${escapeHtml(x.details.specification||'規格未填')} · ${escapeHtml(x.details.quantity)} ${escapeHtml(x.details.unit)} · ${escapeHtml(x.details.supplierName)}</span><span class="meta">預計交期 ${escapeHtml(x.details.dueDate||'—')} · ${escapeHtml(stamp(x.updatedAt))}</span></button>`).join('');
  if(!shown.length)$('list').innerHTML=`<p class="empty">${items.length?'沒有符合的訂貨':'尚無訂貨紀錄'}</p>`;
  $('more').hidden=!hasMore;
 }
 function clearView(){editing=null;$('detail').hidden=true;$('editor').hidden=true}
 async function load(reset=false){
  if(!groupId||disposed)return;
  if(loading&&!reset)return;
  if(reset){++epoch;items=[];cursor=null;hasMore=false;clearView();render()}
  const check=epoch,group=groupId;loading=true;$('more').disabled=true;showStatus('正在讀取訂貨……');
  try{
   const page=await svc.listPage(group,{cursor,size:30,tab:filter});
   if(!live(check)||group!==groupId)return;
   items.push(...page.items.filter(x=>!items.some(v=>v.id===x.id)));cursor=page.cursor;hasMore=page.hasMore;render();showStatus('');
   await Promise.all([...new Set(page.items.flatMap(x=>[x.updatedBy,x.details.orderedByUid]).filter(Boolean))].map(nameFor));
   if(live(check))render();
  }catch(error){if(live(check))showStatus('讀取失敗：'+String(error?.code||error?.message||error),true)}
  finally{if(live(check)){loading=false;$('more').disabled=false}}
 }
 async function showDetail(id){
  const item=items.find(x=>x.id===id);if(!item)return;
  clearView();editing=id;const check=epoch,group=groupId,d=item.details;
  $('detail').innerHTML=`<h2>${escapeHtml(d.productName)}</h2><p>${escapeHtml(d.specification||'—')} · ${escapeHtml(d.quantity)} ${escapeHtml(d.unit)}</p><p>供應商：${escapeHtml(d.supplierName)} · ${escapeHtml(orderStatusLabels[d.status])}</p><p>訂貨日期：${escapeHtml(d.orderDate||'—')} · 預計交期：${escapeHtml(d.dueDate||'—')}</p><p>已到貨：${escapeHtml(d.arrivedQuantity)} ${escapeHtml(d.unit)}</p><p>備註：${escapeHtml(d.note||'—')}</p><div class="actions"><button id="edit" class="primary">編輯</button><button id="closeDetail">返回清單</button></div><h3>異動紀錄</h3><ol id="history" class="history"><li>讀取中……</li></ol>`;
  $('detail').hidden=false;$('detail').scrollIntoView({block:'start',behavior:'smooth'});
  $('edit').onclick=()=>openEditor(id);$('closeDetail').onclick=clearView;
  try{
   const history=await svc.listHistory(group,id);if(!live(check)||editing!==id||group!==groupId)return;
   $('history').replaceChildren();
   for(const entry of history){
    const actor=await nameFor(entry.actorUid);if(!live(check)||editing!==id)return;
    const li=document.createElement('li');
    li.textContent=stamp(entry.changedAt)+'｜'+actor+'｜'+(entry.changes||orderChangeSummary(entry.before,entry.after)).map(c=>(fieldLabels[c.field]||c.field)+'：'+String(c.before??'（空）')+' → '+String(c.after??'（空）')).join('；');
    $('history').append(li);
   }
  }catch(error){if(live(check))$('history').textContent='歷史讀取失敗：'+String(error?.code||error?.message||error)}
 }
 function revealField(field){if($('editor').hidden||!field?.closest('form'))return;requestAnimationFrame(()=>field.scrollIntoView({block:'center',behavior:'smooth'}))}
 function openEditor(id=null){
  const item=items.find(x=>x.id===id);if(id&&!item)return;
  editing=id;const form=$('form');form.reset();
  for(const [key,value] of Object.entries(item?.details||{})){const field=form.elements.namedItem(key);if(field)field.value=value}
  if(!item){form.elements.namedItem('unit').value='KG';form.elements.namedItem('arrivedQuantity').value='0'}
  $('editTitle').textContent=item?'修改訂貨':'新增訂貨';$('detail').hidden=true;$('editor').hidden=false;
  const first=form.elements.namedItem('productName');
  if(!item){first.focus({preventScroll:true});revealField(first)}else $('editor').scrollIntoView({block:'start',behavior:'smooth'});
 }
 async function initialize(){
  let list;
  try{list=await (listVerifiedGroups?.()||groups.listGroupsFromServer())}
  catch(error){if(error?.code!=='permission-denied')throw error;await auth.currentUser?.getIdToken(true);list=await groups.listGroupsFromServer()}
  if(disposed||auth.currentUser?.uid!==owner)throw Error('ACCOUNT_CHANGED');
  $('group').replaceChildren();
  for(const group of list){const option=document.createElement('option');option.value=group.id;option.textContent=group.name;$('group').append(option)}
  groupId=list[0]?.id||'';
  if(!groupId){showStatus('目前沒有已加入的群組。');onGroupReady?.();return}
  onGroupReady?.();await load(true);
 }
 $('group').onchange=()=>{groupId=$('group').value;load(true)};
 $('refresh').onclick=()=>load(true);$('new').onclick=()=>openEditor();$('more').onclick=()=>load();$('search').oninput=render;
 root.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
  filter=button.dataset.filter;root.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===button));load(true);
 });
 $('list').onclick=event=>{const button=event.target.closest('button[data-id]');if(button)void showDetail(button.dataset.id)};
 $('cancel').onclick=()=>{$('editor').hidden=true;editing=null};
 $('form').addEventListener('focusin',event=>revealField(event.target));
 const onViewport=()=>{const active=root.activeElement;if(active?.matches('input,select,textarea'))revealField(active)};
 window.visualViewport?.addEventListener('resize',onViewport);
 $('form').onsubmit=async event=>{
  event.preventDefault();if(saving||disposed)return;saving=true;$('save').disabled=true;
  const check=epoch,group=groupId,id=editing,previous=items.find(x=>x.id===id);
  try{
   const data=Object.fromEntries(new FormData($('form')));data.quantity=Number(data.quantity);data.arrivedQuantity=Number(data.arrivedQuantity);
   data.requesterUid=previous?.details.requesterUid||owner;data.orderedByUid=previous?.details.orderedByUid||'';
   if(data.status==='PENDING'){data.orderedByUid='';data.orderDate='';data.arrivedQuantity=0}
   else{if(!data.orderedByUid)data.orderedByUid=owner;if(!data.orderDate)data.orderDate=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})}
   if(data.status==='RECEIVED')data.arrivedQuantity=data.quantity;
   if(previous)await svc.update(group,id,data,previous.revision);else await svc.create(group,data);
   if(!live(check)||group!==groupId)return;
   await load(true);showStatus('訂貨已儲存，異動紀錄已寫入。');
  }catch(error){if(live(check))showStatus('儲存失敗：'+String(error?.code||error?.message||error),true)}
  finally{saving=false;$('save').disabled=false}
 };
 return {ready:initialize(),dispose(){disposed=true;++epoch;window.visualViewport?.removeEventListener('resize',onViewport);root.replaceChildren()}};
}
