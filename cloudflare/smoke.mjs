const base=process.argv[2];const expected=process.argv[3];if(!base||!expected)throw Error('Usage: node smoke.mjs https://site.example <expected-commit-sha>');
const url=new URL(base);if(!['https:','http:'].includes(url.protocol))throw Error('Invalid URL');
async function read(path){const r=await fetch(new URL(path,url),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r;}
const page=await read('/');if(!(await page.text()).includes('id="root"'))throw Error('Missing app shell');
const h=await (await read('/api/health')).json();if(h.status!=='ok'||h.revision!==expected)throw Error(`Release mismatch: expected ${expected}, got ${h.revision}`);
const atlas=await (await read('/api/atlas')).json();if(!atlas.nodes?.length||!atlas.meta?.official)throw Error('Missing shared atlas');
const session=await (await read('/api/session')).json();if(session.maintainer!==false)throw Error('Anonymous maintainer access');
console.log(JSON.stringify({status:'ok',revision:h.revision,nodes:atlas.nodes.length,checks:['app-shell','database','revision','shared-atlas','anonymous-permissions']}));
