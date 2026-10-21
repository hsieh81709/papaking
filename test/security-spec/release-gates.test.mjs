/** Safety expectations, deliberately RED on 855f5f2 / fbd1abe.
 * No xfail, skip or expected-error wrapper: node --test exits nonzero.
 * Future integration may replace the fixture driver with verified ingress work;
 * preserve these behavioral assertions and the existing 436 regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {router,direct} from '../line/helpers.mjs';
const text=value=>({type:'text',text:value});
const location=()=>({type:'location',latitude:25,longitude:121.46});
function event(h,id,message,redelivery=false){
 return h.c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',webhookEventId:id,deliveryContext:{isRedelivery:redelivery},source:direct,replyToken:'SYNTHETIC',message}]})}});
}

test('R1 completed selection and location replays must not repeat parking work',()=>{
 const h=router();event(h,'S1',text('停車'));event(h,'L1',location());assert.deepEqual(h.routes,['parking']);
 event(h,'S1',text('停車'),true);event(h,'L1',location(),true);assert.deepEqual(h.routes,['parking']);
});
test('R2 old location replay must preserve the new category for a fresh location',()=>{
 const h=router();event(h,'S1',text('停車'));event(h,'L1',location());assert.deepEqual(h.routes,['parking']);
 event(h,'S2',text('附近公廁'));assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');
 event(h,'L1',location(),true);assert.deepEqual(h.routes,['parking']);assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');
 event(h,'L2',location());assert.deepEqual(h.routes,['parking','toilet']);
});
test('R3 failed event redelivery must not blindly reexecute its query',()=>{
 const h=router();let calls=0;h.c.toiletSearch_=()=>{calls++;throw new Error('SYNTHETIC_QUERY_FAILURE');};
 event(h,'S1',text('附近公廁'));event(h,'L1',location());assert.equal(calls,1);assert.match(h.lastText(),/系統.*暫時/);
 event(h,'L1',location(),true);assert.equal(calls,1);
});
test('R4 concurrent duplicate toilet event must claim only one query',()=>{
 const h=router(),original=h.c.toiletSearch_;let nested=false;
 h.c.toiletSearch_=(...a)=>{if(!nested){nested=true;event(h,'L1',location(),true);}return original(...a);};
 event(h,'S1',text('附近公廁'));event(h,'L1',location());assert.equal(nested,true);assert.deepEqual(h.routes,['toilet']);
});
test('R5 concurrent parking event must claim intent and work before a second reader',()=>{
 const h=router(),original=h.c.clearFacilityIntent_;let nested=false;
 h.c.clearFacilityIntent_=(...a)=>{if(!nested){nested=true;event(h,'L1',location(),true);}return original(...a);};
 event(h,'S1',text('停車'));event(h,'L1',location());assert.equal(nested,true);assert.deepEqual(h.routes,['parking']);
});
test('R6 old completion compare/remove must not erase a newer category',()=>{
 const h=router();h.text('附近公廁');const state=h.c.peekFacilityIntent_(direct);assert.equal(state.kind,'toilet');
 const cache=h.c.CacheService.getScriptCache(),key=h.c.facilityIntentKey_(direct);let once=false;
 h.c.CacheService.getScriptCache=()=>({...cache,remove:k=>{if(k===key&&!once){once=true;h.text('附近公園');}cache.remove(k);}});
 h.c.clearFacilityIntent_(direct,state.snapshot);assert.equal(once,true);assert.equal(h.c.peekFacilityIntent_(direct).kind,'park');
});
test('R7 overlapping category writes must preserve the newer complete selection',()=>{
 const h=router(),cache=h.c.CacheService.getScriptCache();let once=false;
 h.c.CacheService.getScriptCache=()=>({...cache,put:(k,v,ttl)=>{cache.put(k,v,ttl);if(k.endsWith('_pending')&&!once){once=true;h.text('附近公園');}}});
 h.text('附近公廁');assert.equal(once,true);assert.equal(h.c.peekFacilityIntent_(direct).kind,'park');
});
test('R8 unsigned direct origin request must cause zero query and zero LINE sends',()=>{
 const h=router();event(h,'FORGED-S',text('停車'));event(h,'FORGED-L',location());
 assert.deepEqual(h.routes,[]);assert.equal(h.sent.length,0);
});
test('R9 concurrent admitted monthly queries must each have a durable reservation',()=>{
 const h=router();h.c.MONTHLY_BUDGET=100;h.c.MONTHLY_QUOTA=0;h.c.Utilities.formatDate=()=> '202610';
 const base=h.c.PROPS,key='quota_202610_total';let nested=false,inner;
 h.c.PROPS={...base,getProperties:()=>({...h.props}),deleteProperty:k=>delete h.props[k],getProperty:k=>{
  const value=base.getProperty(k);if(k===key&&!nested){nested=true;inner=h.c.consumeQuota(direct);}return value;
 }};
 const outer=h.c.consumeQuota(direct),admitted=[outer,inner].filter(v=>v===null).length;
 assert.equal(nested,true);assert.ok(admitted>=1);assert.equal(Number(h.props[key]),admitted);
});
test('R10 accepted eleven-event batch must account for all eleven events',()=>{
 const h=router(),events=Array.from({length:11},(_,i)=>({type:'message',webhookEventId:`S${i}`,source:direct,replyToken:`SYNTHETIC-${i}`,message:text('選單')}));
 const result=h.c.doPost({postData:{contents:JSON.stringify({events})}});assert.equal(result.value,'OK');assert.equal(h.sent.length,11);
});
test('C1 concurrent TDX key grants must both count against the minute budget',()=>{
 const h=router();h.c.TDX_KEYS=[{id:'SYNTHETIC_KEY',secret:'SYNTHETIC_NOT_A_CREDENTIAL'}];
 const cache=h.c.CacheService.getScriptCache();let nested=false,inner;
 h.c.CacheService.getScriptCache=()=>({...cache,getAll:keys=>{
  const values=Object.fromEntries(keys.map(k=>[k,cache.get(k)]));
  if(!nested){nested=true;inner=h.c.pickTDXKey();}return values;
 }});
 const outer=h.c.pickTDXKey(),admitted=[outer,inner].filter(v=>v===0).length;
 assert.equal(nested,true);assert.ok(admitted>=1);assert.equal(Number(cache.get(h.c.tdxRateKey(0))),admitted);
});
