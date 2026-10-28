import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const html=readFileSync(new URL('./orders-v1.html',import.meta.url),'utf8');
assert(html.includes('data-tab="all"')&&html.includes('data-tab="done"')&&html.includes('data-tab="open"'));
assert(html.includes('class="active" data-tab="all"'));
assert(html.includes('orders-v1-service.mjs'));
assert(html.includes('HONBIN_ORDERS_READY')&&html.includes('HONBIN_ORDERS_HEIGHT'));
assert(html.includes('html.embedded')&&html.includes('onAuthStateChanged(auth'));
assert(html.includes('id="backWorkspace"'));
assert(!/supplierPrice|purchasePrice|costPrice|進價|採購單價/.test(html));
const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert(js,'inline module script missing');
const file=new URL('./.orders-v1-check-temp.mjs',import.meta.url);
try{
 writeFileSync(file,js);
 execFileSync(process.execPath,['--check',file.pathname],{stdio:'pipe'});
}finally{try{unlinkSync(file)}catch{}}
console.log('ORDERS_V1_HTML_TABS_AND_SYNTAX_PASS');
