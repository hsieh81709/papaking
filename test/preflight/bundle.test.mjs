import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {harness,root} from '../parks/helpers.mjs';
const files=['line_webhook_gas.js','park_search_gas.js','facility_search_gas.js','facility_line_gas.js','webhook_security_gas.js','webhook_state_gas.js'];
function permutations(xs){return xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];}
test('search engines and manifest remain byte-identical to pre-P09 d4d6aff',()=>{
 for(const f of ['park_search_gas.js','facility_search_gas.js','appsscript.json'])assert.equal(fs.readFileSync(`${root}/gas/${f}`,'utf8'),execFileSync('git',['show',`d4d6aff:gas/${f}`],{cwd:root,encoding:'utf8'}));
});
test('all 720 bundle load orders initialize the six files without maintenance or harness autoload',()=>{
 for(const order of permutations(files)){
  const h=harness([]),c=h.context;
  for(const f of order)vm.runInContext(fs.readFileSync(`${root}/gas/${f}`,'utf8'),c,{filename:f});
  for(const fn of ['doPost','handleLocation','parkSearch_','toiletSearch_','handlePapaKingMessage_','facilityNavigationUrl_','buildToiletFlexReply_'])assert.equal(typeof c[fn],'function',`${order}: ${fn}`);
  assert.equal(c.buildPapaKingQuickMenu_().quickReply.items.length,3);assert.deepEqual(h.events,[]);
 }
});
test('six-file bundle has no duplicate named global function declarations',()=>{
 const seen=new Set();for(const f of files){const src=fs.readFileSync(`${root}/gas/${f}`,'utf8');for(const match of src.matchAll(/^function\s+([\w$]+)\s*\(/gm)){assert.ok(!seen.has(match[1]),match[1]);seen.add(match[1]);}}
});
