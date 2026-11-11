// Check actual HTTP responses, including what a crawler can read without running JavaScript.
import assert from 'node:assert/strict';
const base = (process.argv[2] ?? 'http://127.0.0.1:3002').replace(/\/$/, '');
const canonical = 'https://www.openqualitymethod.com/';
async function get(path) {
  const response = await fetch(base + path, { headers: { 'User-Agent': 'Googlebot' } });
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  return { response, text: await response.text() };
}
let ogImage;
for (const path of ['/', '/convert']) {
  const { response, text } = await get(path);
  assert.ok(!response.headers.get('x-robots-tag')?.includes('noindex'), `${path}: indexable response`);
  assert.equal((text.match(/rel="canonical"/g) ?? []).length, 1, `${path}: one canonical`);
  assert.equal(new URL(text.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? 'https://invalid.example').href, canonical, `${path}: canonical hostname and path`);
  assert.match(text, /<title>Free TikTok Video Quality Tool \| OQM<\/title>/);
  assert.match(text, /<meta name="description" content="Prepare and patch TikTok videos/);
  assert.match(text, /<meta name="robots" content="index, follow/);
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(text), `${path}: not noindexed`);
  assert.equal(new URL(text.match(/property="og:url" content="([^"]+)"/)?.[1] ?? 'https://invalid.example').href, canonical);
  assert.match(text, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(text, /Stop TikTok from compressing your video\./);
  assert.match(text, /\(Free forever\)/);
  const graph = JSON.parse(text.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1] ?? 'null');
  assert.equal(graph?.['@context'], 'https://schema.org');
  const app = graph['@graph'].find(x => x['@type'] === 'WebApplication');
  assert.equal(app.offers.price, '0');
  assert.equal(app.isAccessibleForFree, true);
  assert.equal(app.aggregateRating, undefined);
  ogImage = text.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(ogImage, `${path}: social image`);
}
const robots = (await get('/robots.txt')).text;
assert.match(robots, /User-Agent: \*/);
assert.match(robots, /Allow: \//);
assert.match(robots, /Disallow: \/api\//);
assert.match(robots, /Sitemap: https:\/\/www.openqualitymethod.com\/sitemap.xml/);
const sitemap = (await get('/sitemap.xml')).text;
assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
assert.equal((sitemap.match(/<loc>/g) ?? []).length, 1, 'only the canonical page is in the sitemap');
const llms = await get('/llms.txt');
assert.match(llms.text, /^# OQM/);
assert.match(llms.text, /does not guarantee/);
assert.equal(llms.response.headers.get('x-robots-tag'), 'noindex');
const imagePath = new URL(ogImage).pathname;
const image = await fetch(base + imagePath);
assert.equal(image.status, 200);
assert.ok(image.headers.get('content-type')?.includes('image/png'));
const bytes = new Uint8Array(await image.arrayBuffer());
assert.deepEqual([...bytes.slice(0, 8)], [137,80,78,71,13,10,26,10]);
console.log(JSON.stringify({ base, crawlerReadable: true, metadata: true, canonical: true, structuredData: true, robots: true, sitemap: true, llmsMarkdown: true, socialImage: true }));
