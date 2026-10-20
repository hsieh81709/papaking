import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.mjs';

function router(files=['park_search_gas.js','line_webhook_gas.js']) {
 const h=harness(files),c=h.context,routes=[],replies=[],cache=new Map();let now=0;
 c.CacheService.getScriptCache=()=>({
  put:(key,value,seconds)=>cache.set(key,{value,expires:now+seconds*1000}),
  get:key=>{const item=cache.get(key);if(!item)return null;if(now>=item.expires){cache.delete(key);return null;}return item.value;},
  remove:key=>cache.delete(key)
 });
 c.replyLine=(_token,message)=>replies.push(message);
 c.handleLocation=()=>routes.push('parking');
 c.buildParkFlexReply_=(_lat,_lon,intent)=>{routes.push(intent);return 'synthetic park reply';};
 function send(source,type,value) {
  const message=type==='text'?{type,text:value}:{type:'location',latitude:25,longitude:121.46};
  const response=c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',source,replyToken:'SYNTHETIC',message}]})}});
  assert.equal(response.value,'OK');
 }
 return {...h,routes,replies,text:(source,text)=>send(source,'text',text),location:source=>send(source,'location'),advance:seconds=>{now+=seconds*1000;}};
}
const direct={type:'user',userId:'SYNTHETIC_USER'};
for(const source of [direct,{type:'group',groupId:'SYNTHETIC_GROUP',userId:direct.userId},{type:'room',roomId:'SYNTHETIC_ROOM',userId:direct.userId}]) {
 test(`PK-04 ${source.type}: menu cancels park intent before parking location action`,()=>{
  const h=router();h.text(source,'附近公園');h.text(source,'選單');h.location(source);
  assert.deepEqual(h.routes,['parking']);assert.equal(h.replies[1].quickReply.items.at(-1).action.type,'location');
 });
}
test('PK-04 menu reset is isolated from the same user in another conversation and another group member',()=>{
 const h=router(),group={type:'group',groupId:'SYNTHETIC_GROUP',userId:direct.userId},member={...group,userId:'SYNTHETIC_OTHER'};
 h.text(direct,'附近公園');h.text(group,'附近有溜滑梯的公園');h.text(member,'附近有鞦韆的公園');
 h.text(direct,'menu');h.location(direct);h.location(group);h.location(member);
 assert.deepEqual(h.routes,['parking','溜滑梯','鞦韆']);
});
test('PK-04 reselecting from each menu alias sets a new one-shot park intent',()=>{
 for(const menu of ['選單','功能選單','公園選單','MENU']) {
  const h=router();h.text(direct,'附近公園');h.text(direct,menu);h.text(direct,'附近有鞦韆的公園');h.location(direct);h.location(direct);
  assert.deepEqual(h.routes,['鞦韆','parking']);
 }
});
test('PK-04 park intent works before TTL and is consumed once',()=>{
 const h=router();h.text(direct,'附近有溜滑梯的公園');h.advance(599);h.location(direct);h.location(direct);
 assert.deepEqual(h.routes,['溜滑梯','parking']);
});
test('PK-04 expired intent and direct locations retain default parking',()=>{
 const h=router();h.location(direct);h.text(direct,'附近公園');h.advance(600);h.location(direct);
 assert.deepEqual(h.routes,['parking','parking']);
});
test('PK-04 menu remains usable when only the parking module is installed',()=>{
 const h=router(['line_webhook_gas.js']);h.text(direct,'選單');h.location(direct);
 assert.equal(h.replies.length,1);assert.deepEqual(h.routes,['parking']);assert.ok(!h.logs.some(s=>String(s).includes('處理失敗')));
});
