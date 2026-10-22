import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {handle} from '../../line-ingress/handler.mjs';
import {router,direct} from '../line/helpers.mjs';
import {secret} from './helpers.mjs';
const lineSecret='synthetic-line-secret';
const config={lineSecret,originSecret:secret,audience:'synthetic-gas',channel:'synthetic-channel',gasUrl:'https://script.google.com/macros/s/SYNTHETIC/exec'};
const payload=()=>JSON.stringify({destination:config.channel,events:[]});
function request(body=payload(),signature=crypto.createHmac('sha256',lineSecret).update(body).digest('base64')){return new Request('https://synthetic.invalid/webhook',{method:'POST',headers:{'content-type':'application/json','x-line-signature':signature},body});}
function ack(envelope,status='accepted'){
 const a={v:1,nonce:envelope.nonce,status};a.mac=crypto.createHmac('sha256',secret).update('PK_ACK_V1\n'+JSON.stringify([a.v,a.nonce,a.status])).digest('base64');return new Response(JSON.stringify(a));
}
test('ingress official HMAC verified on exact raw bytes; forwards once and validates signed ack',async()=>{let calls=0;const body=' {"destination":"synthetic-channel", "events":[], "中文":"😀\\r\\n"} ';const result=await handle(request(body),config,async(url,options)=>{calls++;const e=JSON.parse(options.body);assert.equal(e.payload,body);assert.equal(options.redirect,'manual');return ack(e);});assert.equal(result.status,200);assert.equal(calls,1);});
test('ingress HMAC independent fixed standard SHA256 vector',async()=>{
 // RFC4231 test case 2, checked independently of implementation's MAC function.
 const key='Jefe',body='what do ya want for nothing?';
 assert.equal(crypto.createHmac('sha256',key).update(body).digest('hex'),'5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
 // Valid HMAC gets through authentication (invalid JSON fails parsing -> 503).
 const sig=Buffer.from('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843','hex').toString('base64');
 assert.equal((await handle(request(body,sig),{...config,lineSecret:key},()=>{throw Error('must not forward non JSON');})).status,503);
});
for(const mode of ['wrong','missing','mutated','duplicate'])test('ingress rejects signature '+mode,async()=>{let calls=0;const body=payload();let sig=crypto.createHmac('sha256',lineSecret).update(body).digest('base64');if(mode==='wrong')sig='A'.repeat(43)+'=';if(mode==='missing')sig='';if(mode==='duplicate')sig+=','+sig;const result=await handle(request(mode==='mutated'?body+' ':body,sig),config,()=>{calls++;});assert.equal(result.status,401);assert.equal(calls,0);});
test('ingress wrong channel or overlimit batch never forwards',async()=>{for(const body of [JSON.stringify({destination:'other',events:[]}),JSON.stringify({destination:config.channel,events:Array.from({length:33},()=>({}))})]){let calls=0;assert.equal((await handle(request(body),config,()=>{calls++;})).status,400);assert.equal(calls,0);}});
test('ingress body size bounded before forwarding',async()=>{let calls=0;const r=await handle(request('a'.repeat(40001)),config,()=>{calls++;});assert.equal(r.status,503);assert.equal(calls,0);});
test('ingress network timeout or HTML/unsigned ACK never reports success or retries',async()=>{for(const response of [()=>{throw Error('timeout');},()=>new Response('<html>not GAS</html>'),()=>new Response('{"v":1,"status":"accepted"}')]){let calls=0;assert.equal((await handle(request(),config,()=>{calls++;return response();})).status,503);assert.equal(calls,1);}});
test('ingress follows only expected GAS result redirect; never forwards secrets to redirected host',async()=>{let calls=0;const result=await handle(request(),config,()=>{calls++;return new Response(null,{status:302,headers:{location:'https://attacker.invalid/x'}});});assert.equal(result.status,503);assert.equal(calls,1);});
test('ingress approved result redirect uses GET without envelope; signed ACK still required',async()=>{let envelope,calls=0;const result=await handle(request(),config,async(url,o)=>{calls++;if(calls===1){envelope=JSON.parse(o.body);return new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo?synthetic=1'}});}assert.equal(o.method,'GET');assert.equal(o.body,undefined);return ack(envelope);});assert.equal(result.status,200);assert.equal(calls,2);});
test('ingress/GAS isolated two-hop HMAC contract; no actual network',async()=>{
 const h=router();h.c.Date=Date;const event={type:'message',webhookEventId:'synthetic-twohop',timestamp:Date.now(),source:direct,replyToken:'SYNTHETIC',message:{type:'text',text:'選單'}};
 const result=await handle(request(JSON.stringify({destination:config.channel,events:[event]})),config,async(url,o)=>new Response(h.c.originDoPost({postData:{contents:o.body}}).value));
 assert.equal(result.status,200);assert.equal(h.sent.length,1);
});
