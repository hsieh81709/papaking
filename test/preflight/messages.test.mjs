import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateMessages} from '../../tools/line-preflight.mjs';
import {router,fixture} from '../line/helpers.mjs';
const samples=JSON.parse(fs.readFileSync(new URL('../../docs/mvp1/examples/P0-2_LINE_MESSAGES.json',import.meta.url)));
for(const key of ['menu','locationPrompt','toilet','park','parking','noApprovedToilets'])test(`local message profile: fixed ${key}`,()=>assert.deepEqual(validateMessages([samples[key]]),[]));
test('current runtime-generated menu, all category prompts, park and toilet messages pass local profile',()=>{
 const h=router({realPark:true});h.text('選單');for(const t of ['停車','附近公園','附近公廁']){h.text(t);h.location();}
 for(const batch of h.sent)assert.deepEqual(validateMessages(batch.messages),[]);
});
test('five synthetic approved toilets and bounded long unknown fields pass local profile',()=>{
 const h=router({rows:Array.from({length:6},(_,i)=>({...fixture.record,'公廁ID':`SYNTHETIC-${i}`,'公廁名稱':'合成'.repeat(200),'緯度':25+i*.0001}))});
 h.text('附近公廁');h.location();const m=h.sent.at(-1).messages[0];assert.equal(m.contents.contents.length,5);assert.deepEqual(validateMessages([m]),[]);
});
for(const [name,mutate] of [
 ['empty altText',m=>{m.altText='';}],['oversize altText',m=>{m.altText='甲'.repeat(401);}],
 ['empty carousel',m=>{m.contents.contents=[];}],['too many product bubbles',m=>{m.contents.contents=Array(6).fill(m.contents.contents[0]);}],
 ['unsafe URI',m=>{m.contents.contents[0].footer.contents[0].action.uri='javascript:alert(1)';}],
 ['missing button action',m=>{delete m.contents.contents[0].footer.contents[0].action;}],
 ['invalid box layout',m=>{m.contents.contents[0].body.layout='bad';}],
 ['empty text',m=>{m.contents.contents[0].body.contents[0].text='';}],
 ['bubble byte budget',m=>{m.contents.contents[0].body.contents.push(...Array.from({length:15},()=>({type:'text',text:'甲'.repeat(1800)})));}]
])test(`local validator rejects ${name}`,()=>{const m=structuredClone(samples.toilet);mutate(m);assert.ok(validateMessages([m]).length>0);});
test('local validator rejects oversized text, quick replies and reply batch',()=>{
 assert.ok(validateMessages([{type:'text',text:'x'.repeat(5001)}]).length);
 const m=structuredClone(samples.menu);m.quickReply.items=Array(14).fill(m.quickReply.items[0]);assert.ok(validateMessages([m]).length);
 assert.ok(validateMessages(Array(6).fill(samples.menu)).length);
});
