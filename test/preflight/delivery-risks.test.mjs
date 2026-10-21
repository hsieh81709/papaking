/** Characterization: PASS means risk reproduced, NOT safe-to-release. No fixes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {router,direct} from '../line/helpers.mjs';
const message=(type,value)=>type==='text'?{type,text:value}:{type,latitude:25,longitude:121.46};
function event(h,id,msg,redelivery=false){return h.c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',webhookEventId:id,deliveryContext:{isRedelivery:redelivery},source:direct,replyToken:'SYNTHETIC',message:msg}]})}});}
test('SAFETY: sequential duplicate parking location does not query parking twice without new selection',()=>{
 const h=router();event(h,'S1',message('text','停車'));event(h,'L1',message('location'));event(h,'L1',message('location'),true);assert.deepEqual(h.routes,['parking']);
});
test('RISK R1: replayed selection + replayed location queries parking twice despite event IDs',()=>{
 const h=router();for(const replay of [false,true]){event(h,'S1',message('text','停車'),replay);event(h,'L1',message('location'),replay);}assert.deepEqual(h.routes,['parking','parking']);
});
test('RISK R2: old location redelivery consumes a newly selected different category',()=>{
 const h=router();event(h,'S1',message('text','停車'));event(h,'L1',message('location'));h.text('附近公廁');event(h,'L1',message('location'),true);assert.deepEqual(h.routes,['parking','toilet']);assert.equal(h.c.peekFacilityIntent_(direct).kind,'unset');
});
test('RISK R3: data failure preserves state so identical event is queried again and acknowledged OK',()=>{
 const h=router();let calls=0;h.c.toiletSearch_=()=>{calls++;throw new Error('SYNTHETIC');};h.text('附近公廁');for(const replay of [false,true]){const result=event(h,'L1',message('location'),replay);assert.equal(result.value,'OK');}assert.equal(calls,2);assert.match(h.lastText(),/系統.*暫時/);
});
test('RISK R4: modeled concurrent toilet queries both observe the same pending state',()=>{
 const h=router(),original=h.c.toiletSearch_;let nested=false;h.c.toiletSearch_=(...args)=>{if(!nested){nested=true;event(h,'L1',message('location'),true);}return original(...args);};h.text('附近公廁');event(h,'L1',message('location'));assert.deepEqual(h.routes,['toilet','toilet']);
});
test('RISK R5: modeled parking peek/clear interleaving can issue two parking queries',()=>{
 const h=router(),original=h.c.clearFacilityIntent_;let nested=false;
 h.c.clearFacilityIntent_=(...a)=>{if(!nested){nested=true;event(h,'L1',message('location'),true);}return original(...a);};
 h.text('停車');event(h,'L1',message('location'));assert.deepEqual(h.routes,['parking','parking']);
});
test('RISK R6: modeled cache compare/remove race removes a newer selection',()=>{
 const h=router();h.text('附近公廁');const state=h.c.peekFacilityIntent_(direct),cache=h.c.CacheService.getScriptCache(),key=h.c.facilityIntentKey_(direct);let once=false;
 h.c.CacheService.getScriptCache=()=>({...cache,remove:k=>{if(k===key&&!once){once=true;h.text('附近公園');}cache.remove(k);}});
 h.c.clearFacilityIntent_(direct,state.snapshot);assert.equal(h.c.peekFacilityIntent_(direct).kind,'expired');
});
test('RISK R7: interleaved marker/main writes lose a selection but fail closed',()=>{
 const h=router(),cache=h.c.CacheService.getScriptCache();let once=false;
 h.c.CacheService.getScriptCache=()=>({...cache,put:(k,v,ttl)=>{cache.put(k,v,ttl);if(k.endsWith('_pending')&&!once){once=true;h.text('附近公園');}}});
 h.text('附近公廁');assert.equal(h.c.peekFacilityIntent_(direct).kind,'unknown');h.location();assert.deepEqual(h.routes,[]);
});
test('RISK R8: unsigned synthetic request is accepted and reaches parking delegate',()=>{
 const h=router();event(h,'FORGED-S',message('text','停車'));event(h,'FORGED-L',message('location'));assert.deepEqual(h.routes,['parking']);
});
test('RISK R9: modeled concurrent monthly budget check admits two requests but stores one increment',()=>{
 const h=router();h.c.MONTHLY_BUDGET=100;h.c.MONTHLY_QUOTA=0;h.c.Utilities.formatDate=()=> '202610';
 const base=h.c.PROPS,key='quota_202610_total';let nested=false,inner;
 h.c.PROPS={...base,getProperties:()=>({...h.props}),deleteProperty:k=>delete h.props[k],getProperty:k=>{
  const value=base.getProperty(k);if(k===key&&!nested){nested=true;inner=h.c.consumeQuota(direct);}return value;
 }};
 assert.equal(h.c.consumeQuota(direct),null);assert.equal(inner,null);assert.equal(h.props[key],'1');
});
test('RISK R10: eleven-event batch silently processes only ten while returning OK',()=>{
 const h=router(),events=Array.from({length:11},(_,i)=>({type:'message',webhookEventId:`S${i}`,source:direct,replyToken:'SYNTHETIC',message:message('text','選單')}));
 const result=h.c.doPost({postData:{contents:JSON.stringify({events})}});assert.equal(result.value,'OK');assert.equal(h.sent.length,10);
});
test('SAFETY: 599 seconds valid and 600 seconds expired with no implicit parking',()=>{
 const h=router();h.text('附近公廁');h.advance(599);assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');h.advance(1);h.location();assert.deepEqual(h.routes,[]);assert.match(h.lastText(),/逾時/);
});
test('SAFETY: absent release ledger excludes NTPC parks and toilets, no navigation',()=>{
 const h=router({realPark:true});const p=h.sheets.get('公園資料');p.data[1][0]='NP-SYNTHETIC';p.data[1][1]='新北市';p.data[1][2]='板橋區';h.sheets.delete('設施發布核准');
 for(const t of ['附近公園','附近公廁']){h.text(t);h.location();assert.match(h.lastText(),/尚無已核准發布/);assert.ok(!JSON.stringify(h.sent.at(-1)).includes('maps/dir'));}assert.deepEqual(h.events,[]);
});
test('SAFETY: HTTP400 fallback does not requery or invoke parking',()=>{
 const h=router();h.text('附近公廁');h.codes.push(400,200);h.location();assert.deepEqual(h.routes,['toilet']);assert.deepEqual(h.sent.slice(-2).map(b=>b.messages[0].type),['flex','text']);
});
