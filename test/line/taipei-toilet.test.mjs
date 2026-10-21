import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {router,direct} from './helpers.mjs';
const tp=JSON.parse(fs.readFileSync(new URL('../facilities/fixtures/taipei-toilet.json',import.meta.url))).record;
function query(options={}){const h=router({rows:[structuredClone(tp)],...options});h.text('附近公廁');h.location();return h;}
test('Taipei location share produces existing toilet Flex and approved representative walking URL',()=>{
 const h=query(),m=h.sent.at(-1).messages[0];assert.equal(m.type,'flex');assert.deepEqual(h.routes,['toilet']);
 const text=JSON.stringify(m);assert.match(text,/合成臺北公廁/);assert.match(text,/萬華區/);assert.match(text,/直線/);assert.match(text,/未確認/);assert.ok(!/24小時|無尿布臺/.test(text));
 const url=new URL(m.contents.contents[0].footer.contents[0].action.uri);assert.equal(url.searchParams.get('destination'),'25.0001,121.46');
});
test('menu and unsupported-area prompts describe both-city toilet coverage',()=>{
 const h=router();h.text('選單');assert.match(h.lastText(),/公廁.*雙北/);assert.ok(!/公廁目前提供新北/.test(h.lastText()));
 h.text('附近公廁');h.location(direct,22.63,120.3);assert.match(h.lastText(),/公廁.*雙北/);
});
test('Taipei missing approvals is distinct from no nearby result and produces no navigation',()=>{
 const h=query({releases:[]});assert.match(h.lastText(),/尚無已核准發布/);assert.ok(!JSON.stringify(h.sent.at(-1)).includes('maps/dir'));
});
test('approved Taipei toilet outside radius yields no-match rather than no-approved',()=>{
 const h=query({rows:[{...tp,'緯度':'25.1'}]});assert.match(h.lastText(),/附近沒有符合條件/);assert.ok(!/尚無已核准/.test(h.lastText()));
});
test('Taipei missing source sheet is data failure, never empty or parking',()=>{
 const h=router({rows:[tp]});h.sheets.delete('公廁資料');h.text('附近公廁');h.location();assert.match(h.lastText(),/資料表.*失敗/);assert.deepEqual(h.routes,['toilet']);assert.ok(!JSON.stringify(h.sent.at(-1)).includes('maps/dir'));
});
test('Taipei Flex 400 uses same-query text once without parking fallback',()=>{
 const h=router({rows:[tp]});h.text('附近公廁');h.codes.push(400,200);h.location();assert.deepEqual(h.routes,['toilet']);
 assert.deepEqual(h.sent.slice(-2).map(x=>x.messages[0].type),['flex','text']);assert.match(h.lastText(),/合成臺北公廁/);assert.match(h.lastText(),/25\.0001/);
});
