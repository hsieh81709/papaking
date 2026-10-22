import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,plain} from './helpers.mjs';

function replies(statuses,parks=[{id:'SYNTHETIC_PARK',name:'合成鞦韆公園',city:'新北市',district:'板橋區',lat:25,lon:121.46,km:0.125,tags:['鞦韆']}]) {
 const h=harness(['park_search_gas.js','line_webhook_gas.js']),c=h.context,sent=[];let searches=0;
 c.parkSearch_=()=>{searches++;return parks;};
 c.buildReply=()=>{throw new Error('Park fallback must not query parking services');};
 c.postLineReply=(token,messages)=>{sent.push({token,messages:plain(messages)});return statuses[Math.min(sent.length-1,statuses.length-1)];};
 function query(lat=25,lon=121.46) {
  const source={type:'user',userId:'SYNTHETIC_USER'};
  c.rememberParkIntent_(source,'鞦韆');
  c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',source,replyToken:'SYNTHETIC_TOKEN',message:{type:'location',latitude:lat,longitude:lon}}]})}});
 }
 return {...h,sent,query,searches:()=>searches};
}
test('PK-05 rejected park Flex sends text from the same query, without extra Sheets or parking requests',()=>{
 const h=replies([400,200]);h.query();
 assert.equal(h.sent.length,2);assert.equal(h.searches(),1);
 assert.deepEqual(h.sent[0].messages.map(m=>m.type),['flex']);assert.deepEqual(h.sent[1].messages.map(m=>m.type),['text']);
 const text=h.sent[1].messages[0].text;
 for(const expected of ['合成鞦韆公園','125 公尺','鞦韆','query=25,121.46'])assert.ok(text.includes(expected));
 assert.equal(h.sent[0].token,h.sent[1].token);
 assert.deepEqual(Object.keys(h.sent[0].messages[0]).sort(),['altText','contents','type']);
});
for(const status of [200,429,500])test(`PK-05 status ${status} does not duplicate a park reply or retry an uncertain request`,()=>{
 const h=replies([status]);h.query();assert.equal(h.sent.length,1);assert.equal(h.searches(),1);assert.equal(h.sent[0].messages[0].type,'flex');
});
test('PK-05 fallback rejected with 400 is attempted once, with no recursive retry',()=>{
 const h=replies([400,400]);h.query();assert.equal(h.sent.length,2);assert.equal(h.searches(),1);
});
test('PK-05 no-result park reply is text and reads the park data once',()=>{
 const h=replies([400],[]);h.query();assert.equal(h.sent.length,1);assert.equal(h.sent[0].messages[0].type,'text');
 assert.match(h.sent[0].messages[0].text,/沒有符合條件/);assert.equal(h.searches(),1);
});
test('PK-05 invalid park coordinates use text without querying data',()=>{
 const h=replies([200]);h.query(null,121.46);assert.equal(h.sent.length,1);assert.match(h.sent[0].messages[0].text,/座標異常/);assert.equal(h.searches(),0);
});
test('PK-05 existing parking text plus Flex still retries only its original truncated text on 400',()=>{
 const h=replies([400,200]);
 h.context.replyLine('SYNTHETIC_TOKEN',['x'.repeat(6000),'第二段停車資訊',{type:'flex',altText:'合成停車',contents:{}}]);
 assert.equal(h.sent.length,2);assert.deepEqual(h.sent[0].messages.map(m=>m.type),['text','text','flex']);
 assert.deepEqual(h.sent[1].messages,h.sent[0].messages.slice(0,2));assert.equal(h.sent[1].messages[0].text.length,5000);
});
test('PK-05 pure text rejection and Flex without a supplied fallback never invent retries',()=>{
 const h=replies([400]);h.context.replyLine('SYNTHETIC','文字');h.context.replyLine('SYNTHETIC',{type:'flex',altText:'合成',contents:{}});
 assert.equal(h.sent.length,2);
});
test('PK-05 explicit fallback respects LINE text limits and is not included in Flex JSON',()=>{
 const h=replies([400,200]);h.context.replyLine('SYNTHETIC',{type:'flex',altText:'合成',contents:{}},'x'.repeat(6000));
 assert.equal(h.sent.length,2);assert.equal(h.sent[1].messages[0].text.length,5000);assert.ok(h.sent[1].messages[0].text.endsWith('…'));
 assert.deepEqual(Object.keys(h.sent[0].messages[0]).sort(),['altText','contents','type']);
});
test('PK-05 transport exceptions are not retried and the webhook contains the event failure',()=>{
 const h=replies([200]);h.context.postLineReply=()=>{throw new Error('synthetic transport failure');};
 h.query();assert.ok(h.logs.some(s=>String(s).includes('Webhook event uncertain')));assert.equal(h.searches(),1);
});
