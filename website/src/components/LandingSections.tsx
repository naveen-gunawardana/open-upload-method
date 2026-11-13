import Link from "next/link";
import type { CSSProperties } from "react";
import { GUIDES } from "@/lib/guides";
import PatcherLink from "@/components/PatcherLink";
import InView from "@/components/InView";

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
          <p className="lead">Patch 1080p and 4K videos at 60 fps, for free. No weekly cap, no watermark, no key, no account. The code is public, so you can see how it works.</p>
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
          <p className="fine-note">Illustrative allowances over 30 days, not a quality score. Weekly limits are approximate; OQM’s peak represents uncapped use. *CompressBase also offers unlimited use after Telegram verification. Plan limits can change.</p>
        </InView>
      </div>
    </section>

    <div className="ticker" aria-hidden="true"><div>{[0, 1].map(n => <span key={n}>{FREE_POINTS.map(point => <b key={point}>{point}</b>)}</span>)}</div></div>

    <section className="alp-sec alp-meadow" id="how-it-works" aria-labelledby="how-title">
      <Ridge seed={21} className="ridge-in ridge-hill-far" height={140} points={8} jag={0.5} />
      <div className="wrap">
        <header className="alp-head alp-head-center">
          <h2 id="how-title">Your video, ready for TikTok.</h2>
          <p className="lead">Three steps, all in your browser. Nothing to install, nothing to sign up for, nothing to pay.</p>
        </header>
        <InView className="trail">
          <svg className="trail-line" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true"><path d="M20 90 C160 10 250 110 400 60 S640 10 760 70 920 90 985 30" pathLength="1" /></svg>
          <ol className="steps">
            <li><em>1</em><h3>Choose your video</h3><p>Choose an MP4 or supported MOV. We’ll open the patcher so you can check the settings before you start.</p></li>
            <li><em>2</em><h3>Pick your settings</h3><p>Use the default settings, or choose 1080p or 4K with support for 60 fps. Click Start to patch your video right in your browser.</p></li>
            <li><em>3</em><h3>Download and post</h3><p>Download your patched video, then upload it to TikTok. Keep your original video so you always have a copy.</p></li>
          </ol>
        </InView>
        <div className="center"><PatcherLink className="cta cta-sun">Open the free patcher</PatcherLink></div>
      </div>
    </section>

    <section className="alp-sec alp-lake" id="presets" aria-labelledby="presets-title">
      <Ridge seed={33} className="ridge-over ridge-lake" height={110} points={10} jag={0.45} />
      <div className="wrap">
        <header className="alp-head">
          <h2 id="presets-title">1080p or 4K. Keep your video sharp.</h2>
          <p className="lead">Support for 4K at 60 fps, right in your browser. Start with the default settings, or choose a preset that fits your video.</p>
        </header>
        <div className="presets">
          <article className="preset preset-default"><div className="frame" style={{ "--s": 1 } as CSSProperties}><i /></div><p className="tag">Default</p><h3>Silent-tail</h3><p className="spec">Original size and frame rate</p><p>Converts supported MP4 and MOV videos to a TikTok-ready MP4, then applies the silent-tail method.</p></article>
          <article className="preset"><div className="frame" style={{ "--s": 0.5 } as CSSProperties}><i /></div><p className="tag">For everyday uploads</p><h3>1080p</h3><p className="spec">1080p · 60 fps support</p><p>Prepare a 1080p video with silent-tail. Smaller videos stay smaller, and lower frame rates stay the same.</p></article>
          <article className="preset"><div className="frame" style={{ "--s": 1 } as CSSProperties}><i /></div><p className="tag">For your 4K video</p><h3>4K</h3><p className="spec">4K · 60 fps support</p><p>Prepare your 4K video with silent-tail while keeping 60 fps motion. Use a supported browser and device.</p></article>
        </div>
        <p className="fine-note">The 1080p and 4K presets keep lower frame rates and don’t upscale smaller videos. TikTok playback quality can vary after upload. <Link href="/guides/tiktok-export-settings">See the full settings guide</Link>.</p>

        <div className="bento">
          <article className="bento-card bento-abc" aria-labelledby="abc-title">
            <h3 id="abc-title">Your video. Your choice of method.</h3>
            <p>OQM uses silent-tail by default. Want to compare options? Make local comparison (3) creates three versions from the same video.</p>
            <ul><li><b>A</b><span><strong>Clean MP4</strong>Standard MP4, without a patch.</span></li><li><b>B</b><span><strong>Original OQM</strong>The original OQM patching method.</span></li><li><b>C</b><span><strong>Silent-tail</strong>The default method, with a short silent audio tail.</span></li></ul>
            <Link className="text-link" href="/guides/tiktok-video-quality">Learn about the methods</Link>
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
        <h2 id="ready-title">Get your video ready for TikTok.</h2>
        <p>4K at 60 fps. Free forever. No account or installation.</p>
        <PatcherLink className="cta cta-sun">Patch your video</PatcherLink>
      </div>
      <footer className="landing-footer wrap"><span>OQM, the Open Quality Method</span><nav aria-label="Footer"><Link href="/guides">Editor guides</Link><Link href="/guides/feed.xml">Guide feed</Link><a href="https://github.com/naveen-gunawardana/open-quality-method">Source code</a><a href="https://www.tiktok.com/@openqualitymethod">TikTok</a></nav></footer>
    </section>
  </div>;
}
