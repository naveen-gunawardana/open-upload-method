import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/conversion-analytics.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { sanitizeAttribution, sanitizeAnalytics, failureCategory, trackConversion, clientEnvironment } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const runId = '4ed76815-3442-4fb7-b660-382afed057d0';
test('analytics allowlist strips nested personal fields, bounds values and is idempotent', () => {
  const event = sanitizeAnalytics({run_id:runId,event:'succeeded',filename:'private.mov',ip:'1.2.3.4',error:'secret',preset:'silent-tail',mode:'ab',
    settings:{method:'silent-tail',encode:{reencode:true,codec:'avc',quantizer:17,filename:'secret',mbps:Infinity},patch:{enabled:['decoy-audio','secret','decoy-audio'],encoderTag:'private'}},
    shared_encode:{reencode:true,codec:'avc'},source:{container:'mov',size_mb:42,name:'private.mov'},result:{width:1920,height:1080,fps:60,codec:'avc',extra:'secret'},elapsed_ms:1234});
  assert.equal(event.settings.encode.reencode,true);
  assert.equal(event.settings.encode.mbps,undefined);
  assert.deepEqual(event.settings.patch.enabled,['decoy-audio']);
  assert.deepEqual(event.settings.shared_encode.reencode,true);
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized,/private|secret|1\.2\.3\.4|filename|encoderTag/);
  assert.deepEqual(JSON.parse(JSON.stringify(sanitizeAnalytics(event))),JSON.parse(serialized));
  assert.equal(sanitizeAnalytics({run_id:'bad',event:'succeeded'}),null);
  assert.equal(sanitizeAnalytics({run_id:runId,event:'free-text'}),null);
});
test('failure labels and browser families avoid raw errors and full user agents', () => {
  assert.equal(failureCategory(new Error('Cannot decode private.mov')),'decode');
  assert.equal(failureCategory(new Error('HDR export blocked')),'hdr');
  assert.equal(failureCategory(new Error('Requires AAC-LC stereo')),'silent-tail');
  assert.deepEqual(clientEnvironment('Mozilla Windows Chrome/100 Edg/100'),{browser:'edge',os:'windows'});
});
test('reporting failure cannot fail conversion and filenames never leave the client', async () => {
  const original=globalThis.fetch;
  let payload;
  try {
    globalThis.fetch=(_url,options)=>{payload=JSON.parse(options.body);return Promise.reject(new Error('offline'));};
    assert.doesNotThrow(()=>trackConversion({analyticsId:runId,file:new File(['test'],'private.mov'),recipe:{encode:{reencode:true},patch:{enabled:[]}}},'started','silent-tail'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(payload.source.container,'mov');
    assert.doesNotMatch(JSON.stringify(payload),/private/);
    globalThis.fetch=()=>{throw new Error('blocked');};
    assert.doesNotThrow(()=>trackConversion({analyticsId:runId,file:new File(['test'],'private.mov'),recipe:{}},'started','custom'));
  } finally {globalThis.fetch=original;}
});

test('analytics endpoint validates requests, strips extras and never increments usage', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { pathToFileURL, fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const dir = await mkdtemp(fileURLToPath(new URL('../.oqm-analytics-test-', import.meta.url)));
  const calls = [];
  globalThis.__analyticsTestDb = { from(table) { assert.equal(table,'conversion_analytics'); return {
    select(){return {eq(){return {gte:async()=>({count:0,error:null})};}};},
    async upsert(row,options){calls.push({row,options});return {error:null};},
  };}};
  try {
    await writeFile(path.join(dir,'db.mjs'),'export function supabaseServer(){return globalThis.__analyticsTestDb;}');
    await writeFile(path.join(dir,'analytics.mjs'),js);
    const routeSource = (await readFile(new URL('../src/app/api/analytics/route.ts',import.meta.url),'utf8'))
      .replace('"next/server"','"next/server.js"').replace('"@/lib/supabase"','"./db.mjs"').replace('"@/lib/conversion-analytics"','"./analytics.mjs"');
    await writeFile(path.join(dir,'route.mjs'),ts.transpileModule(routeSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
    const {POST} = await import(pathToFileURL(path.join(dir,'route.mjs')));
    const request = (body,headers={})=>new Request('https://www.openqualitymethod.com/api/analytics',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
    assert.equal((await POST(request({run_id:runId,event:'started'},{origin:'https://other.example'}))).status,403);
    assert.equal((await POST(request({run_id:'invalid',event:'started'}))).status,400);
    assert.equal(calls.length,0);
    assert.equal((await POST(request({run_id:runId,event:'started',filename:'secret.mov',settings:{encode:{reencode:true}}},{origin:'https://www.openqualitymethod.com','x-forwarded-for':'192.0.2.1','user-agent':'Windows Chrome/100'}))).status,204);
    assert.equal(calls.length,1);
    assert.doesNotMatch(JSON.stringify(calls),/secret.mov|192\.0\.2\.1/);
    assert.equal(calls[0].row.browser,'chrome');
    assert.match(calls[0].row.ip_hash,/^[a-f0-9]{64}$/);
    assert.deepEqual(calls[0].options,{onConflict:'run_id,event',ignoreDuplicates:true});
  } finally {delete globalThis.__analyticsTestDb;await rm(dir,{recursive:true,force:true});}
});

test('campaign attribution only accepts the published marketing tags and survives server validation', () => {
  assert.equal(sanitizeAttribution({source:'person@example.com',campaign:'private-search',referrer:'https://private.example'}),undefined);
  const event=sanitizeAnalytics({run_id:runId,event:'started',settings:{},attribution:{source:'reddit',medium:'community',campaign:'editor_launch',content:'launch-post',email:'private@example.com'}});
  assert.deepEqual(event.settings.attribution,{source:'reddit',medium:'community',campaign:'editor_launch',content:'launch-post'});
  assert.deepEqual(sanitizeAnalytics(event).settings.attribution,event.settings.attribution);
  assert.doesNotMatch(JSON.stringify(event),/private@example|email|referrer/);
});
