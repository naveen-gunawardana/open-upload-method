import Link from "next/link";
import { GUIDES } from "@/lib/guides";
import PatcherLink from "@/components/PatcherLink";

export default function LandingSections() {
  return <div className="landing-sections">
    <section className="landing-section landing-intro" aria-labelledby="local-title">
      <p className="section-kicker">Your edit. Your device.</p>
      <h2 id="local-title">A free TikTok video quality tool,<br className="desktop-break" /> built for editors.</h2>
      <p className="section-lead">Prepare your video, compare upload methods, and keep control of the source. OQM runs in your browser, from the first file selection to the finished download.</p>
      <div className="landing-benefits"><span>Free forever</span><span>No account</span><span>No installation</span><span>Open source</span></div>
    </section>

    <section className="landing-section" id="how-it-works" aria-labelledby="how-title">
      <p className="section-kicker">A simple workflow</p><h2 id="how-title">From your master to a ready-to-test MP4.</h2>
      <div className="landing-steps">
        <article><span className="step-number">01</span><h3>Choose your video</h3><p>Start with your best MP4 or supported MOV. Selecting a file opens the patcher so you can review the settings before anything starts.</p></article>
        <article><span className="step-number">02</span><h3>Pick a preset</h3><p>Use the silent-tail default, or choose the 1080p or 4K output preset. Press Start when you’re ready. Supported ProRes MOV files are decoded locally.</p></article>
        <article><span className="step-number">03</span><h3>Check and download</h3><p>Review the local checks, download your MP4, and compare the actual TikTok result after processing. Keep your original master for the next test.</p></article>
      </div>
      <PatcherLink className="landing-cta">Open the free patcher <span aria-hidden="true">→</span></PatcherLink>
    </section>

    <section className="landing-section" id="presets" aria-labelledby="presets-title">
      <p className="section-kicker">1080p, 4K, and your original size</p><h2 id="presets-title">Choose settings that fit your source.</h2>
      <p className="section-lead">The three main presets use silent-tail with re-encoding enabled. Smaller videos stay smaller; a 4K selection doesn’t invent missing detail.</p>
      <div className="landing-preset-grid">
        <article className="landing-preset featured"><span className="preset-label">Default</span><h3>Silent-tail</h3><p className="preset-spec">Original size · Source FPS</p><p>Prepare H.264 video and AAC stereo, then apply the silent-tail method. A starting point for supported MP4 and MOV files.</p></article>
        <article className="landing-preset"><span className="preset-label">A practical baseline</span><h3>1080p</h3><p className="preset-spec">Target 20 Mbps · Max 60 FPS</p><p>Limit the shorter edge to 1080 pixels. Keep lower source frame rates and dimensions, with the same silent-tail method.</p></article>
        <article className="landing-preset"><span className="preset-label">For a genuine 4K master</span><h3>4K</h3><p className="preset-spec">Target 60 Mbps · Max 60 FPS</p><p>Limit the shorter edge to 2160 pixels. Use a capable browser and device, then check what TikTok actually serves.</p></article>
      </div>
      <p className="section-note">Bitrates are preparation targets. TikTok can serve different resolution, frame rate or bitrate after upload. <Link href="/guides/tiktok-export-settings">See the full settings guide →</Link></p>
    </section>

    <section className="landing-section landing-split" aria-labelledby="compare-title">
      <div><p className="section-kicker">Compare the method, not three different encodes</p><h2 id="compare-title">One source.<br />Three honest comparisons.</h2><p>Make local comparison (3) prepares your source once, then produces a clean MP4, Original OQM and silent-tail variant. That gives you a useful baseline when you test upload quality.</p><Link className="section-text-link" href="/guides/tiktok-video-quality">Follow the comparison workflow →</Link></div>
      <div className="comparison-stack"><div><span>A</span><div><h3>Clean MP4</h3><p>Normal container. Your baseline.</p></div></div><div><span>B</span><div><h3>Original OQM</h3><p>The original container patch set.</p></div></div><div><span>C</span><div><h3>Silent-tail</h3><p>A short silent AAC tail and a second audio track.</p></div></div></div>
    </section>

    <section className="landing-section landing-split" aria-labelledby="privacy-title">
      <div><p className="section-kicker">Local by design</p><h2 id="privacy-title">Your video stays on your device.</h2><p>Video contents and filenames aren’t sent to OQM’s server. Your browser does the processing, and your original file stays available to you.</p></div>
      <div className="landing-detail-panel"><h3>Clear about what we measure.</h3><p>Limited conversion analytics include selected settings, file format/size, output properties, timing, broad outcomes, browser/OS/country and a salted network hash. We don’t store raw IP addresses in these analytics.</p><p>Local checks confirm file properties and structure. TikTok upload quality and retention need a separate playback test.</p><Link href="/guides/check-video-resolution-and-fps">Check resolution, frame rate and retention →</Link></div>
    </section>

    <section className="landing-section" id="editor-guides" aria-labelledby="resources-title">
      <p className="section-kicker">Practical answers for editors</p><h2 id="resources-title">Good settings are easier to choose<br className="desktop-break" /> when you know what they do.</h2>
      <nav className="landing-guide-grid" aria-label="Editor guides">{GUIDES.map(guide => <Link href={`/guides/${guide.slug}`} key={guide.slug}><span className="guide-category">{guide.category ?? "Editor guide"}</span><h3>{guide.title}</h3><p>{guide.description}</p><span className="guide-read">Read the guide <span aria-hidden="true">↗</span></span></Link>)}</nav>
    </section>

    <section className="landing-section landing-faq" aria-labelledby="faq-title"><p className="section-kicker">Before you start</p><h2 id="faq-title">A few useful answers.</h2>
      <details><summary>Is OQM really free?</summary><p>Yes. The website is free forever, with no account or installation needed. The source code is public.</p></details>
      <details><summary>Should I re-encode my video?</summary><p>Leave re-encode enabled for supported MOV/ProRes files that need preparation into H.264/AAC stereo. If you already have a compatible MP4 for silent-tail, you can turn re-encode off to avoid another encoding generation. <Link href="/guides/mov-to-mp4-for-tiktok">Read the MOV conversion guide.</Link></p></details>
      <details><summary>Does OQM guarantee 4K on TikTok?</summary><p>No method here guarantees every upload or later playback. 4K has been reported working with the current default, but source quality, upload route and delivered renditions still need checking. <Link href="/guides/why-tiktok-videos-look-blurry">Diagnose a blurry result.</Link></p></details>
      <details><summary>What if my browser can’t convert a file?</summary><p>Input decoding and output video/audio encoding are separate capabilities. Check the error stage, try a 1080p SDR baseline, or prepare a compatible MP4 in your editor. <Link href="/guides/browser-video-conversion-errors">See the troubleshooting guide.</Link></p></details>
      <details><summary>Can I test HDR or 120 fps?</summary><p>Treat them as separate experiments. The 1080p and 4K presets cap higher frame rates at 60; the default keeps source timing. HDR/wide-gamut re-encoding needs explicit colour conversion and is currently blocked in the browser workflow.</p></details>
    </section>

    <section className="landing-section landing-final" aria-labelledby="ready-title"><p className="section-kicker">Keep the master. Test the result.</p><h2 id="ready-title">Give your next upload a better starting point.</h2><PatcherLink className="landing-cta">Patch your video <span aria-hidden="true">→</span></PatcherLink><p className="section-note">Free forever. No account or installation.</p></section>
    <footer className="landing-footer"><span>OQM · Open Quality Method</span><nav aria-label="Footer"><Link href="/guides">Editor guides</Link><Link href="/guides/feed.xml">Guide feed</Link><a href="https://github.com/naveen-gunawardana/open-quality-method">Source code</a><a href="https://www.tiktok.com/@openqualitymethod">TikTok</a></nav></footer>
  </div>;
}
