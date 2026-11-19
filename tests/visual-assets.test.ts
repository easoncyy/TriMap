import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicDir=path.join(root,'public');
function files(dir:string):string[]{
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(dir,entry.name);
  return entry.isDirectory()?files(file):[file];
 });
}

test('Next and Pages include the same local font stylesheets, with deployable assets',()=>{
 const layout=readFileSync(path.join(root,'src/app/layout.tsx'),'utf8');
 const pages=readFileSync(path.join(root,'cloudflare/build.mjs'),'utf8');
 const sheets=(source:string)=>[...source.matchAll(/href="(\/optical\/[^"\s]+\.css)"/g)].map(m=>m[1]).sort();
 assert.ok(sheets(layout).length>0);
 assert.deepEqual(sheets(pages),sheets(layout));
 for(const file of files(publicDir)){
  assert.ok(statSync(file).size<=25*1024*1024,`${path.relative(root,file)} exceeds the Pages asset limit`);
  if(!file.endsWith('.css'))continue;
  const css=readFileSync(file,'utf8');
  for(const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)){
   const url=match[1];
   if(/^(data:|https?:)/.test(url))continue;
   const resolved=url.startsWith('/')?path.join(publicDir,url):path.resolve(path.dirname(file),url);
   assert.ok(existsSync(resolved),`Missing ${url} referenced by ${path.relative(root,file)}`);
  }
 }
});
