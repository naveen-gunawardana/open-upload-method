import Link from "next/link";
import { GUIDES } from "@/lib/guides";
import PatcherLink from "@/components/PatcherLink";

const LANDSCAPE_URL = "https://github.com/naveen-gunawardana/open-quality-method/blob/main/program/docs/LANDSCAPE.md";

// Taken from each tool's own public description, as recorded in program/docs/LANDSCAPE.md.
const TOOLS = [
  { name: "OQM", price: "Free", allowance: "No limit, no sign-in", code: "Public, every patch readable", ours: true },
  { name: "Haze", price: "Free mode for now; Plus $4.99 a month, Premium $9.99 a month", allowance: "Weekly credits for signed-in users", code: "Not published" },
  { name: "Kuronai", price: "Free tier, paid Premium", allowance: "Limited; Premium raises the limits", code: "Extension config is public; “Enhanced” method is undisclosed" },
  { name: "RTX Fury", price: "Free tier, Premium by donation", allowance: "3 a day, 100 MB, 1080p 60 FPS", code: "Not published" },
  { name: "Void Studio", price: "Not listed", allowance: "First patch free with a Discord or Telegram login", code: "Not published" },
  { name: "Editing Enhancer", price: "Free tier", allowance: "3 uploads a week, 50 MB each", code: "Described as proprietary" },
  { name: "Kay x Kaz", price: "Free tier, paid for unlimited", allowance: "3 full-quality patches every 30 days", code: "Undisclosed" },
  { name: "Kryp", price: "Free tier", allowance: "Watermark and key limits", code: "Approach described, not published" },
  { name: "CompressBase", price: "Free tier", allowance: "5 uses a day per device", code: "Undisclosed" },
];

// Free patches available over 30 days, from the limits each tool advertises.
const ALLOWANCES = [
  { name: "Kay x Kaz", count: 3, label: "3" },
  { name: "Editing Enhancer", count: 13, label: "about 13" },
  { name: "RTX Fury", count: 90, label: "90" },
  { name: "CompressBase", count: 150, label: "150" },
];

function FrameScale() {
  // Portrait frames drawn to scale: 540×960, 1080×1920, 2160×3840.
  return (
    <svg className="frame-scale" viewBox="0 0 236 404" role="img" aria-label="Three portrait video frames drawn to scale: 540p, 1080p and 4K">
      <rect className="frame-4k" x="2" y="2" width="216" height="384" rx="3" />
      <rect className="frame-1080" x="2" y="194" width="108" height="192" rx="2" />
      <rect className="frame-540" x="2" y="290" width="54" height="96" rx="1.5" />
      <text x="210" y="22" textAnchor="end">4K</text>
      <text x="102" y="212" textAnchor="end">1080p</text>
      <text x="29" y="342" textAnchor="middle">540p</text>
    </svg>
  );
}

export default function LandingSections() {
  return <div className="landing-sections">
    <section className="ground" id="compare" aria-labelledby="compare-title">
      <div className="wrap">
        <div className="ground-head">
          <h2 id="compare-title">Other methods charge you or ration you. OQM does neither.</h2>
          <p>Every patch on this site is free, with no weekly cap, no size limit set by us, no watermark and no key. You don’t make an account. The code is public, so you can read exactly what gets changed in your file.</p>
        </div>

        <div className="tool-table" role="table" aria-label="OQM compared with other upload methods">
          <div className="tool-row tool-head" role="row">
            <span role="columnheader">Method</span><span role="columnheader">Price</span><span role="columnheader">Free use</span><span role="columnheader">How it works</span>
          </div>
          {TOOLS.map(tool => <div className={`tool-row${tool.ours ? " ours" : ""}`} role="row" key={tool.name}>
            <strong role="cell">{tool.name}</strong>
            <span role="cell" data-label="Price">{tool.price}</span>
            <span role="cell" data-label="Free use">{tool.allowance}</span>
            <span role="cell" data-label="How it works">{tool.code}</span>
          </div>)}
        </div>

        <div className="allowance">
          <h3>Free patches you get in 30 days</h3>
          <div className="allowance-bars">
            {ALLOWANCES.map(item => <div className="allowance-row" key={item.name}>
              <span>{item.name}</span>
              <div className="allowance-track"><i style={{ width: `${Math.max(1.2, item.count / 150 * 62)}%` }} /></div>
              <b>{item.label}</b>
            </div>)}
            <div className="allowance-row ours">
              <span>OQM</span>
              <div className="allowance-track"><i style={{ width: "100%" }} /></div>
              <b>No limit</b>
            </div>
          </div>
          <p className="ground-note">Haze, Kuronai, Kryp and Void Studio don’t advertise a count, so they aren’t charted. Limits and prices are the ones each tool advertised in November 2026. They change, so check their sites. <a href={LANDSCAPE_URL} target="_blank" rel="noopener">Read our notes on each method</a>.</p>
        </div>

        <div className="ground-close">
          <p>Paying buys more uses, support and convenience. No paid tool has published a controlled test showing its patch beats the free ones, and no method, this one included, can promise what TikTok serves back.</p>
          <PatcherLink className="cta cta-light">Patch a video free</PatcherLink>
        </div>
      </div>
    </section>

    <section className="band" id="how-it-works" aria-labelledby="how-title">
      <div className="wrap split">
        <div className="split-head">
          <h2 id="how-title">From your master to a ready-to-test MP4.</h2>
          <p>Three steps, all in your browser. Nothing to install, nothing to sign up for, nothing to pay.</p>
          <PatcherLink className="cta">Open the free patcher</PatcherLink>
        </div>
        <ol className="steps">
          <li><h3>Choose your video</h3><p>Start with your best MP4 or supported MOV. Selecting a file opens the patcher so you can review the settings before anything starts.</p></li>
          <li><h3>Pick a preset</h3><p>Use the silent-tail default, or choose the 1080p or 4K output preset. Press Start when you’re ready. Supported ProRes MOV files are decoded locally.</p></li>
          <li><h3>Check and download</h3><p>Review the local checks, download your MP4, and compare the actual TikTok result after processing. Keep your original master for the next test.</p></li>
        </ol>
      </div>
    </section>

    <section className="band" id="presets" aria-labelledby="presets-title">
      <div className="wrap split">
        <div className="split-head">
          <h2 id="presets-title">Choose settings that fit your source.</h2>
          <p>The three main presets use silent-tail with re-encoding enabled. Smaller videos stay smaller; a 4K selection doesn’t invent missing detail.</p>
          <figure className="frame-figure">
            <FrameScale />
            <figcaption>Frames to scale. A 4K frame holds 16 times the pixels of a 540p one, which is why a recompressed upload looks soft.</figcaption>
          </figure>
        </div>
        <div>
          <dl className="presets">
            <div><dt>Silent-tail <em>Default</em></dt><dd className="spec">Original size, source FPS</dd><dd>Prepare H.264 video and AAC stereo, then apply the silent-tail method. A starting point for supported MP4 and MOV files.</dd></div>
            <div><dt>1080p</dt><dd className="spec">Target 20 Mbps, max 60 FPS</dd><dd>Limit the shorter edge to 1080 pixels. Keep lower source frame rates and dimensions, with the same silent-tail method. A practical baseline.</dd></div>
            <div><dt>4K</dt><dd className="spec">Target 60 Mbps, max 60 FPS</dd><dd>Limit the shorter edge to 2160 pixels. For a genuine 4K master: use a capable browser and device, then check what TikTok actually serves.</dd></div>
          </dl>
          <p className="note">Bitrates are preparation targets. TikTok can serve different resolution, frame rate or bitrate after upload. <Link href="/guides/tiktok-export-settings">See the full settings guide</Link>.</p>
        </div>
      </div>
    </section>

    <section className="band" aria-labelledby="abc-title">
      <div className="wrap split">
        <div className="split-head">
          <h2 id="abc-title">One source. Three honest comparisons.</h2>
          <p>Make local comparison (3) prepares your source once, then produces a clean MP4, Original OQM and silent-tail variant. That gives you a useful baseline when you test upload quality.</p>
          <Link className="text-link" href="/guides/tiktok-video-quality">Follow the comparison workflow</Link>
        </div>
        <ul className="variants">
          <li><b>A</b><div><h3>Clean MP4</h3><p>Normal container. Your baseline.</p></div></li>
          <li><b>B</b><div><h3>Original OQM</h3><p>The original container patch set.</p></div></li>
          <li><b>C</b><div><h3>Silent-tail</h3><p>A short silent AAC tail and a second audio track.</p></div></li>
        </ul>
      </div>
    </section>

    <section className="band" aria-labelledby="privacy-title">
      <div className="wrap split">
        <div className="split-head">
          <h2 id="privacy-title">Your video stays on your device.</h2>
          <p>Video contents and filenames aren’t sent to OQM’s server. Your browser does the processing, and your original file stays available to you.</p>
        </div>
        <div className="prose">
          <h3>Clear about what we measure.</h3>
          <p>Limited conversion analytics include selected settings, file format/size, output properties, timing, broad outcomes, browser/OS/country and a salted network hash. We don’t store raw IP addresses in these analytics.</p>
          <p>Local checks confirm file properties and structure. TikTok upload quality and retention need a separate playback test.</p>
          <Link className="text-link" href="/guides/check-video-resolution-and-fps">Check resolution, frame rate and retention</Link>
        </div>
      </div>
    </section>

    <section className="band" id="editor-guides" aria-labelledby="resources-title">
      <div className="wrap">
        <h2 id="resources-title">Good settings are easier to choose when you know what they do.</h2>
        <nav className="guide-list" aria-label="Editor guides">{GUIDES.map(guide => <Link href={`/guides/${guide.slug}`} key={guide.slug}>
          <span className="guide-category">{guide.category ?? "Editor guide"}</span>
          <h3>{guide.title}</h3>
          <p>{guide.description}</p>
        </Link>)}</nav>
      </div>
    </section>

    <section className="band" aria-labelledby="faq-title">
      <div className="wrap split">
        <div className="split-head"><h2 id="faq-title">A few useful answers.</h2></div>
        <div className="faq">
          <details><summary>Is OQM really free?</summary><p>Yes. The website is free forever, with no account or installation needed. The source code is public.</p></details>
          <details><summary>Should I re-encode my video?</summary><p>Leave re-encode enabled for supported MOV/ProRes files that need preparation into H.264/AAC stereo. If you already have a compatible MP4 for silent-tail, you can turn re-encode off to avoid another encoding generation. <Link href="/guides/mov-to-mp4-for-tiktok">Read the MOV conversion guide.</Link></p></details>
          <details><summary>Does OQM guarantee 4K on TikTok?</summary><p>No method here guarantees every upload or later playback. 4K has been reported working with the current default, but source quality, upload route and delivered renditions still need checking. <Link href="/guides/why-tiktok-videos-look-blurry">Diagnose a blurry result.</Link></p></details>
          <details><summary>What if my browser can’t convert a file?</summary><p>Input decoding and output video/audio encoding are separate capabilities. Check the error stage, try a 1080p SDR baseline, or prepare a compatible MP4 in your editor. <Link href="/guides/browser-video-conversion-errors">See the troubleshooting guide.</Link></p></details>
          <details><summary>Can I test HDR or 120 fps?</summary><p>Treat them as separate experiments. The 1080p and 4K presets cap higher frame rates at 60; the default keeps source timing. HDR/wide-gamut re-encoding needs explicit colour conversion and is currently blocked in the browser workflow.</p></details>
        </div>
      </div>
    </section>

    <section className="ground ground-final" aria-labelledby="ready-title">
      <div className="wrap">
        <h2 id="ready-title">Give your next upload a better starting point.</h2>
        <p>Free forever. No account or installation.</p>
        <PatcherLink className="cta cta-light">Patch your video</PatcherLink>
      </div>
      <footer className="landing-footer wrap"><span>OQM, the Open Quality Method</span><nav aria-label="Footer"><Link href="/guides">Editor guides</Link><Link href="/guides/feed.xml">Guide feed</Link><a href="https://github.com/naveen-gunawardana/open-quality-method">Source code</a><a href="https://www.tiktok.com/@openqualitymethod">TikTok</a></nav></footer>
    </section>
  </div>;
}
