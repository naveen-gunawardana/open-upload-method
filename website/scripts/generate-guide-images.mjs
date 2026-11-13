// Static share cards: no runtime image-generation dependency in the deployed pages.
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../',import.meta.url));
const dir = await mkdtemp(path.join(root,'.oqm-guide-assets-'));
try {
  for (const name of ['seo','guides','guides-extra']) {
    const source = await readFile(path.join(root,'src/lib',`${name}.ts`),'utf8');
    const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
      .replace(/from "\.\/(seo|guides|guides-extra)"/g,'from "./$1.mjs"');
    await writeFile(path.join(dir,`${name}.mjs`),js);
  }
  const {GUIDES} = await import(pathToFileURL(path.join(dir,'guides.mjs')));
  const logo = (await readFile(path.join(root,'public/logo.png'))).toString('base64');
  const escape = text => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const wrap = title => {
    const lines=[];let line='';
    for (const word of title.split(/\s+/)) {
      if ((line+' '+word).trim().length>37 && line) {lines.push(line);line=word;} else line=(line+' '+word).trim();
    }
    if(line)lines.push(line);
    if(lines.length>4)throw new Error('Share-card title too long: '+title);
    return lines;
  };
  const output=path.join(root,'public/og/guides');await mkdir(output,{recursive:true});
  for(const guide of GUIDES){
    const lines=wrap(guide.title); const font=lines.length>3?47:54;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630"><defs><linearGradient id="sky" x2="1" y2="1"><stop stop-color="#299af0"/><stop offset="1" stop-color="#b5e8ff"/></linearGradient></defs><rect width="1200" height="630" fill="url(#sky)"/><rect x="42" y="42" width="1116" height="546" rx="28" fill="#fff"/><image x="82" y="78" width="58" height="58" xlink:href="data:image/png;base64,${logo}"/><g font-family="Arial, sans-serif"><text x="157" y="115" font-size="25" font-weight="600" fill="#1d3348">OQM · Editor guides</text><text x="1090" y="114" text-anchor="end" font-size="20" fill="#08783a">Free forever</text><text x="88" y="188" font-size="16" font-weight="700" fill="#08783a">${escape(guide.category.toUpperCase())}</text>${lines.map((line,i)=>`<text x="86" y="${260+i*66}" font-size="${font}" font-weight="700" fill="#1d3348">${escape(line)}</text>`).join('')}<text x="88" y="545" font-size="20" fill="#2477c9">openqualitymethod.com/guides</text></g></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(output,`${guide.slug}.png`));
  }
  console.log(`Generated ${GUIDES.length} static guide previews.`);
} finally {await rm(dir,{recursive:true,force:true});}
