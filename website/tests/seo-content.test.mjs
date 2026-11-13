import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=await mkdtemp(path.join(root,'.oqm-seo-test-'));
after(()=>rm(dir,{recursive:true,force:true}));
for(const name of ['seo','guides','guides-extra','conversion-analytics']){
  const source=await readFile(path.join(root,'src/lib',name+'.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/(seo|guides|guides-extra)"/g,'from "./$1.mjs"');
  await writeFile(path.join(dir,name+'.mjs'),js);
}
const {GUIDES,sectionId,guidePublished,guideUpdated}=await import(pathToFileURL(path.join(dir,'guides.mjs')));
test('guide routes, dates, fragments and related links stay consistent',async()=>{
  assert.equal(GUIDES.length,8);
  const ids=new Set(GUIDES.map(g=>g.slug));assert.equal(ids.size,GUIDES.length);
  for(const g of GUIDES){
    await access(path.join(root,'src/app/guides',g.slug,'page.tsx'));
    assert.ok(g.category && g.summary.length && g.faq.length,'reader-facing summary and answers: '+g.slug);
    assert.ok(guideUpdated(g)>=guidePublished(g),'modified date cannot precede publication');
    assert.ok(g.seoTitle.length<=75,'concise search title: '+g.slug);
    const fragments=g.sections.map(s=>sectionId(s.title));assert.equal(new Set(fragments).size,fragments.length);
    assert.ok(fragments.every(Boolean));
    for(const related of g.related)assert.ok(ids.has(related)&&related!==g.slug,'valid related article: '+related);
    for(const source of g.sources)assert.equal(new URL(source.url).protocol,'https:');
  }
});
test('every guide has a distinct static share card at the advertised dimensions',async()=>{
  const signatures=new Set();
  for(const g of GUIDES){
    const bytes=await readFile(path.join(root,'public/og/guides',g.slug+'.png'));
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
    signatures.add(bytes.toString('base64'));
  }
  assert.equal(signatures.size,GUIDES.length);
});
test('the downloadable worksheet covers all variants and retention checkpoints',async()=>{
  const lines=(await readFile(path.join(root,'public/resources/tiktok-upload-test.csv'),'utf8')).trim().split(/\r?\n/).map(x=>x.split(','));
  assert.equal(lines.length,13);assert.ok(lines.every(row=>row.length===9));
  assert.equal(lines[0][0],'variant');
  for(const variant of ['Clean MP4','Original OQM','Silent-tail'])assert.deepEqual(lines.slice(1).filter(r=>r[0]===variant).map(r=>r[1]),['After processing','24 hours','72 hours','7 days']);
});

test('every guide CTA uses campaign tags the analytics endpoint will retain',async()=>{
  const {sanitizeAttribution}=await import(pathToFileURL(path.join(dir,'conversion-analytics.mjs')));
  for(const g of GUIDES){
    const tags={source:'guide',medium:'organic',campaign:'editor_launch',content:g.campaign};
    assert.deepEqual(sanitizeAttribution(tags),tags,g.slug);
  }
});
