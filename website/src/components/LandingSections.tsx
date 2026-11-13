import Link from "next/link";
import type { CSSProperties } from "react";
import { GUIDES } from "@/lib/guides";
import PatcherLink from "@/components/PatcherLink";
import InView from "@/components/InView";

const LANDSCAPE_URL = "https://github.com/naveen-gunawardana/open-quality-method/blob/main/program/docs/LANDSCAPE.md";

// Taken from each tool's own public description, as recorded in program/docs/LANDSCAPE.md.
const TOOLS: { name: string; price: string; limit: string; code: "Open" | "Partly" | "Not public"; ours?: boolean }[] = [
  { name: "OQM", price: "Free", limit: "No limit, no sign-in", code: "Open", ours: true },
  { name: "Haze", price: "Free tier, plans $4.99 to $9.99 a month", limit: "Weekly credits, sign-in", code: "Not public" },
  { name: "Kuronai", price: "Free tier, paid Premium", limit: "Limited, Premium raises it", code: "Partly" },
  { name: "RTX Fury", price: "Free tier, Premium by donation", limit: "3 a day, 100 MB", code: "Not public" },
  { name: "Void Studio", price: "Free tier, paid plans", limit: "3 a day, 90 MB, sign-in", code: "Not public" },
  { name: "Editing Enhancer", price: "Free tier", limit: "3 a week, 50 MB each", code: "Not public" },
  { name: "Kay x Kaz", price: "Free tier, paid for unlimited", limit: "3 every 30 days", code: "Not public" },
  { name: "Kryp", price: "Free tier", limit: "Watermark and key limits", code: "Not public" },
  { name: "CompressBase", price: "Free", limit: "6 a day/device; Telegram unlocks unlimited", code: "Not public" },
];

// Illustrative 30-day allowances; weekly limits are approximate and uncapped use is symbolic.
const PEAKS = [
  { name: "Kay x Kaz", count: 3, label: "3" },
  { name: "Editing Enhancer", count: 13, label: "~13" },
  { name: "RTX Fury", count: 90, label: "90" },
  { name: "CompressBase", count: 180, label: "180*" },
];

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// A low-poly ridge line, like the mountains in the hero scene.
function ridge(seed: number, height: number, points: number, jag: number) {
  const rand = mulberry(seed);
  let d = `M0 ${height}`;
  for (let i = 0; i <= points; i++) {
    const x = Math.round(i / points * 1440);
    const peak = i % 2 === 1;
    const y = Math.round(height * (peak ? 0.08 + rand() * jag : 0.5 + rand() * 0.4));
    d += ` L${x} ${y}`;
  }
  return `${d} L1440 ${height} Z`;
}

function Ridge({ seed, className, height = 120, points = 14, jag = 0.35 }: { seed: number; className: string; height?: number; points?: number; jag?: number }) {
  return <svg className={`ridge ${className}`} viewBox={`0 0 1440 ${height}`} preserveAspectRatio="none" aria-hidden="true"><path d={ridge(seed, height, points, jag)} /></svg>;
}

function Contours() {
  return <svg className="contours" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><filter id="contour-warp"><feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="90" /></filter></defs>
    <g filter="url(#contour-warp)" fill="none" stroke="currentColor" strokeWidth="1.2">
      {Array.from({ length: 13 }, (_, i) => <ellipse key={i} cx="430" cy="300" rx={40 + i * 44} ry={26 + i * 30} />)}
    </g>
  </svg>;
}

function Cloud({ className }: { className: string }) {
  return <svg className={`cloud ${className}`} viewBox="0 0 240 90" aria-hidden="true"><path d="M30 78a26 26 0 0 1 4-52 40 40 0 0 1 74-12 34 34 0 0 1 60 14 26 26 0 0 1 40 22 22 22 0 0 1-8 28Z" /></svg>;
}

function Check() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

const FREE_POINTS = ["Free forever", "No account", "No watermark", "No weekly cap", "No install", "Open source", "Runs in your browser"];

export default function LandingSections() {
  return <div className="alp">
    <section className="alp-sec alp-compare" id="compare" aria-labelledby="compare-title">
      <Ridge seed={11} className="ridge-over ridge-snow-far" height={150} points={18} jag={0.3} />
      <Ridge seed={4} className="ridge-over ridge-snow" height={96} points={12} />
      <div className="alp-sky" aria-hidden="true"><i className="sun-glow" /><Cloud className="cloud-a" /><Cloud className="cloud-b" /><Cloud className="cloud-c" /><Contours /></div>
      <div className="wrap">
        <header className="alp-head">
          <p className="tag tag-free">Free forever</p>
          <h2 id="compare-title">Other methods charge you or ration you. <span>OQM does neither.</span></h2>
          <p className="lead">Every patch here is free. No weekly cap, no watermark, no key, no account. The code is public, so you can read exactly what changes in your file.</p>
          <PatcherLink className="cta">Patch a video free</PatcherLink>
        </header>

        <InView className="range">
          <h3>Free patches you get in 30 days</h3>
          <div className="range-plot">
            <Cloud className="range-cloud range-cloud-a" /><Cloud className="range-cloud range-cloud-b" />
            {PEAKS.map((peak, i) => <div className="peak" key={peak.name} style={{ "--h": Math.max(9, Math.round(peak.count / 180 * 170)), "--i": i } as CSSProperties}>
              <b>{peak.label}</b><i /><span>{peak.name === "CompressBase" ? <>Compress<wbr />Base</> : peak.name}</span>
            </div>)}
            <div className="peak peak-ours" style={{ "--h": 330, "--i": 4 } as CSSProperties}>
              <b>No limit</b><i /><span>OQM</span>
            </div>
          </div>
          <p className="fine-note">Illustrative allowances over 30 days, not a quality score. Weekly limits are approximate; OQM’s peak represents uncapped use. *CompressBase also offers unlimited use after Telegram verification. See the plans and requirements below.</p>
        </InView>

        <div className="tools" role="table" aria-label="OQM compared with other upload methods">
          <div className="tool tool-head" role="row"><span role="columnheader">Method</span><span role="columnheader">Price</span><span role="columnheader">Free use</span><span role="columnheader">Code</span></div>
          {TOOLS.map(tool => <div className={`tool${tool.ours ? " tool-ours" : ""}`} role="row" key={tool.name}>
            <strong role="cell">{tool.name}</strong>
            <span role="cell" data-label="Price">{tool.price}</span>
            <span role="cell" data-label="Free use">{tool.limit}</span>
            <span role="cell" className={`code code-${tool.code.toLowerCase().replaceAll(" ", "-")}`}>{tool.code === "Open" && <Check />}{tool.code}</span>
          </div>)}
        </div>
        <p className="fine-note">Limits and prices are the ones each tool advertised in November 2026. They change, so check their sites. “Not public” means we haven’t found public patcher source code. We haven’t found a published controlled comparison showing a paid patch consistently beats the free ones. No method, this one included, can promise what TikTok serves back. <a href={LANDSCAPE_URL} target="_blank" rel="noopener">Read our notes on each method</a>.</p>
      </div>
    </section>

    <div className="ticker" aria-hidden="true"><div>{[0, 1].map(n => <span key={n}>{FREE_POINTS.map(point => <b key={point}>{point}</b>)}</span>)}</div></div>

    <section className="alp-sec alp-meadow" id="how-it-works" aria-labelledby="how-title">
      <Ridge seed={21} className="ridge-in ridge-hill-far" height={140} points={8} jag={0.5} />
      <div className="wrap">
        <header className="alp-head alp-head-center">
          <h2 id="how-title">From your master to a ready-to-test MP4.</h2>
          <p className="lead">Three steps, all in your browser. Nothing to install, nothing to sign up for, nothing to pay.</p>
        </header>
        <InView className="trail">
          <svg className="trail-line" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true"><path d="M20 90 C160 10 250 110 400 60 S640 10 760 70 920 90 985 30" pathLength="1" /></svg>
          <ol className="steps">
            <li><em>1</em><h3>Choose your video</h3><p>Start with your best MP4 or supported MOV. Selecting a file opens the patcher so you can review the settings before anything starts.</p></li>
            <li><em>2</em><h3>Pick a preset</h3><p>Use the silent-tail default, or choose the 1080p or 4K output preset. Press Start when you’re ready. Supported ProRes MOV files are decoded locally.</p></li>
            <li><em>3</em><h3>Check and download</h3><p>Review the local checks, download your MP4, and compare the actual TikTok result after processing. Keep your original master for the next test.</p></li>
          </ol>
        </InView>
        <div className="center"><PatcherLink className="cta cta-sun">Open the free patcher</PatcherLink></div>
      </div>
    </section>

    <section className="alp-sec alp-lake" id="presets" aria-labelledby="presets-title">
      <Ridge seed={33} className="ridge-over ridge-lake" height={110} points={10} jag={0.45} />
      <div className="wrap">
        <header className="alp-head">
          <h2 id="presets-title">Choose settings that fit your source.</h2>
          <p className="lead">The three main presets use silent-tail with re-encoding enabled. Smaller videos stay smaller; a 4K selection doesn’t invent missing detail.</p>
        </header>
        <div className="presets">
          <article className="preset preset-default"><div className="frame" style={{ "--s": 1 } as CSSProperties}><i /></div><p className="tag">Default</p><h3>Silent-tail</h3><p className="spec">Original size, source FPS</p><p>Prepare H.264 video and AAC stereo, then apply the silent-tail method. A starting point for supported MP4 and MOV files.</p></article>
          <article className="preset"><div className="frame" style={{ "--s": 0.5 } as CSSProperties}><i /></div><p className="tag">A practical baseline</p><h3>1080p</h3><p className="spec">Target 20 Mbps, max 60 FPS</p><p>Limit the shorter edge to 1080 pixels. Keep lower source frame rates and dimensions, with the same silent-tail method.</p></article>
          <article className="preset"><div className="frame" style={{ "--s": 1 } as CSSProperties}><i /></div><p className="tag">For a genuine 4K master</p><h3>4K</h3><p className="spec">Target 60 Mbps, max 60 FPS</p><p>Limit the shorter edge to 2160 pixels. Use a capable browser and device, then check what TikTok actually serves.</p></article>
        </div>
        <p className="fine-note">Frames are drawn to scale against 4K. Bitrates are preparation targets; TikTok can serve different resolution, frame rate or bitrate after upload. <Link href="/guides/tiktok-export-settings">See the full settings guide</Link>.</p>

        <div className="bento">
          <article className="bento-card bento-abc" aria-labelledby="abc-title">
            <h3 id="abc-title">One source. Three honest comparisons.</h3>
            <p>Make local comparison (3) prepares your source once, then produces a clean MP4, Original OQM and silent-tail variant. That gives you a useful baseline when you test upload quality.</p>
            <ul><li><b>A</b><span><strong>Clean MP4</strong>Normal container. Your baseline.</span></li><li><b>B</b><span><strong>Original OQM</strong>The original container patch set.</span></li><li><b>C</b><span><strong>Silent-tail</strong>A short silent AAC tail and a second audio track.</span></li></ul>
            <Link className="text-link" href="/guides/tiktok-video-quality">Follow the comparison workflow</Link>
          </article>
          <article className="bento-card bento-private" aria-labelledby="privacy-title">
            <svg className="device" viewBox="0 0 120 120" aria-hidden="true"><rect x="34" y="8" width="52" height="104" rx="10" /><path d="M48 62l9 9 16-18" /><circle cx="60" cy="60" r="46" /></svg>
            <h3 id="privacy-title">Your video stays on your device.</h3>
            <p>Video contents and filenames aren’t sent to OQM’s server. Your browser does the processing, and your original file stays available to you.</p>
            <p className="small"><strong>Clear about what we measure.</strong> Limited conversion analytics include selected settings, file format/size, output properties, timing, broad outcomes, browser/OS/country and a salted network hash. We don’t store raw IP addresses in these analytics. Local checks confirm file properties and structure. TikTok upload quality and retention need a separate playback test.</p>
            <Link className="text-link" href="/guides/check-video-resolution-and-fps">Check resolution, frame rate and retention</Link>
          </article>
        </div>
      </div>
    </section>

    <section className="alp-sec alp-snow" id="editor-guides" aria-labelledby="resources-title">
      <Ridge seed={47} className="ridge-over ridge-snow" height={90} points={12} />
      <div className="alp-sky" aria-hidden="true"><Contours /></div>
      <div className="wrap">
        <header className="alp-head"><h2 id="resources-title">Good settings are easier to choose when you know what they do.</h2></header>
        <nav className="guides" aria-label="Editor guides">{GUIDES.map(guide => <Link href={`/guides/${guide.slug}`} key={guide.slug}>
          <span className="tag">{guide.category ?? "Editor guide"}</span><h3>{guide.title}</h3><p>{guide.description}</p>
        </Link>)}</nav>

        <div className="faq-block">
          <h2 id="faq-title">A few useful answers.</h2>
          <div className="faq" aria-labelledby="faq-title">
            <details><summary>Is OQM really free?</summary><p>Yes. The website is free forever, with no account or installation needed. The source code is public.</p></details>
            <details><summary>Should I re-encode my video?</summary><p>Leave re-encode enabled for supported MOV/ProRes files that need preparation into H.264/AAC stereo. If you already have a compatible MP4 for silent-tail, you can turn re-encode off to avoid another encoding generation. <Link href="/guides/mov-to-mp4-for-tiktok">Read the MOV conversion guide.</Link></p></details>
            <details><summary>Does OQM guarantee 4K on TikTok?</summary><p>No method here guarantees every upload or later playback. 4K has been reported working with the current default, but source quality, upload route and delivered renditions still need checking. <Link href="/guides/why-tiktok-videos-look-blurry">Diagnose a blurry result.</Link></p></details>
            <details><summary>What if my browser can’t convert a file?</summary><p>Input decoding and output video/audio encoding are separate capabilities. Check the error stage, try a 1080p SDR baseline, or prepare a compatible MP4 in your editor. <Link href="/guides/browser-video-conversion-errors">See the troubleshooting guide.</Link></p></details>
            <details><summary>Can I test HDR or 120 fps?</summary><p>Treat them as separate experiments. The 1080p and 4K presets cap higher frame rates at 60; the default keeps source timing. HDR/wide-gamut re-encoding needs explicit colour conversion and is currently blocked in the browser workflow.</p></details>
          </div>
        </div>
      </div>
    </section>

    <section className="alp-sec alp-final" aria-labelledby="ready-title">
      <div className="final-scene" aria-hidden="true">
        <i className="final-sun" /><Cloud className="cloud-a" /><Cloud className="cloud-b" />
        <Ridge seed={61} className="final-r1" height={300} points={9} jag={0.3} />
        <Ridge seed={75} className="final-r2" height={220} points={11} jag={0.4} />
        <Ridge seed={88} className="final-r3" height={130} points={6} jag={0.5} />
      </div>
      <div className="wrap final-copy">
        <h2 id="ready-title">Give your next upload a better starting point.</h2>
        <p>Free forever. No account or installation.</p>
        <PatcherLink className="cta cta-sun">Patch your video</PatcherLink>
      </div>
      <footer className="landing-footer wrap"><span>OQM, the Open Quality Method</span><nav aria-label="Footer"><Link href="/guides">Editor guides</Link><Link href="/guides/feed.xml">Guide feed</Link><a href="https://github.com/naveen-gunawardana/open-quality-method">Source code</a><a href="https://www.tiktok.com/@openqualitymethod">TikTok</a></nav></footer>
    </section>
  </div>;
}
