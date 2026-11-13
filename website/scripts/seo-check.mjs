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
  const pageCanonical = path === '/' ? canonical : canonical + 'convert';
  assert.ok(!response.headers.get('x-robots-tag')?.includes('noindex'), `${path}: indexable response`);
  assert.equal((text.match(/rel="canonical"/g) ?? []).length, 1, `${path}: one canonical`);
  assert.equal(new URL(text.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? 'https://invalid.example').href, pageCanonical, `${path}: canonical hostname and path`);
  assert.match(text, path === "/" ? /<title>Free TikTok Video Quality Tool \| OQM<\/title>/ : /<title>Patch Your TikTok Video for Free \| OQM<\/title>/);
  assert.match(text, /<meta name="description" content="Prepare and patch 1080p and 4K TikTok videos/);
  assert.match(text, /<meta name="robots" content="index, follow/);
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(text), `${path}: not noindexed`);
  assert.equal(new URL(text.match(/property="og:url" content="([^"]+)"/)?.[1] ?? 'https://invalid.example').href, pageCanonical);
  assert.match(text, /<meta name="twitter:card" content="summary_large_image"/);
  if (path === "/") {
    assert.match(text, /Stop TikTok from compressing your video\./);
    assert.match(text, /\(Free forever\)/);
    assert.ok(text.includes('class="landing-content hero-spread"'));
    assert.ok(!text.includes('class="card-slider"'));
  } else {
    assert.match(text, /Patch your video\./);
    assert.ok(!text.includes('id="home-title"'));
    assert.ok(!text.includes('id="compare"'));
  }
  assert.match(text, /4K · 60fps/);
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
const guideSlugs = ['tiktok-video-quality','mov-to-mp4-for-tiktok','silent-tail-method','tiktok-export-settings','why-tiktok-videos-look-blurry','tiktok-60fps','browser-video-conversion-errors','check-video-resolution-and-fps'];
assert.equal((sitemap.match(/<loc>/g) ?? []).length, 11, 'homepage, patcher, guide index and eight articles');
for (const path of ['/guides', ...guideSlugs.map(slug => '/guides/' + slug)]) {
  const { text } = await get(path);
  assert.ok(sitemap.includes(`<loc>https://www.openqualitymethod.com${path}</loc>`));
  assert.equal(new URL(text.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? 'https://invalid.example').href, `https://www.openqualitymethod.com${path}`);
  assert.ok(text.includes('href="/convert?utm_source=guide'), 'guide links to the patcher');
  if (path !== '/guides') {
    assert.ok(text.includes('"@type":"TechArticle"'));
    assert.ok(text.includes('"@type":"BreadcrumbList"'));
    assert.ok(text.includes('aria-label="On this page"'));
    assert.ok(text.includes('id="common-questions"'));
    const slug=path.split('/').pop();
    assert.ok(text.includes(`/og/guides/${slug}.png`));
    const preview=await fetch(base+`/og/guides/${slug}.png`);assert.equal(preview.status,200);
    assert.ok(preview.headers.get('content-type')?.includes('image/png'));
  }
}
const feed=await get('/guides/feed.xml');
assert.ok(feed.response.headers.get('content-type')?.includes('application/rss+xml'));
assert.equal((feed.text.match(/<item>/g)??[]).length,8);
const worksheet=await get('/resources/tiktok-upload-test.csv');
assert.match(worksheet.response.headers.get('content-disposition')??'',/attachment/);
assert.equal(worksheet.text.trim().split(/\r?\n/).length,13);
const home=(await get('/')).text;
for(const id of ['how-it-works','presets','editor-guides','faq-title'])assert.ok(home.includes(`id="${id}"`),'home section: '+id);
assert.ok(home.includes('href="/guides"'),'crawlable home-to-guides link');
const missing=await fetch(base+'/guides/not-a-guide',{headers:{'User-Agent':'Googlebot'}});assert.equal(missing.status,404);
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
