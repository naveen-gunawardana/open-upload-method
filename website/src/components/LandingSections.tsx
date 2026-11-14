import Image from "next/image";
import Link from "next/link";
import PatcherLink from "@/components/PatcherLink";
import { ClosingValley, EditStill, MethodBranches, TopicMark } from "@/components/EditFigures";
import "./landing-sections.css";

const sourceUrl = "https://github.com/naveen-gunawardana/open-quality-method";
const steps = [
  ["Choose your video", "Open an MP4 or supported MOV in the patcher. Your original stays on your device."],
  ["Set it, then start", "Leave Silent-tail selected or pick an output preset. Press Start patching when you’re ready."],
  ["Download and post", "Save the patched MP4, then upload that file to TikTok."],
];
const presets = [
  ["Silent-tail", "Original size", "Keep the dimensions and frame rate of your source. A good place to start with a supported MP4 or MOV."],
  ["1080p", "1080p · up to 60 fps", "Use this for an HD edit, or scale a larger video down to a maximum 1080px short edge."],
  ["4K", "2160p · up to 60 fps", "Choose this for a 4K source. Smaller files keep their dimensions and lower frame rates stay lower."],
];
const guideLinks = [
  ["tiktok-export-settings","Which preset should I use?","Compare the settings for a 1080p or 4K export."],
  ["mov-to-mp4-for-tiktok","Why won’t my MOV convert?","Check the codec inside your MOV and choose an export your browser can read."],
  ["why-tiktok-videos-look-blurry","Why does my post look blurry?","Trace softness from your edit through to the version TikTok plays."],
];
const faqs = [
  ["Should I re-encode my video?", <>Leave re-encoding on for supported MOV and ProRes sources. For a compatible MP4 with AAC-LC stereo audio, you can switch it off to keep the existing streams. <Link href="/guides/mov-to-mp4-for-tiktok">Read the MOV guide.</Link></>],
  ["What if my browser can’t convert a file?", <>Check which stage failed. Try a 1080p SDR export with H.264 video and AAC audio if your browser can’t decode the source or encode the requested output. <Link href="/guides/browser-video-conversion-errors">Troubleshoot conversion.</Link></>],
  ["Will TikTok keep my video in 4K?", <>Editors have reported 4K playback with the current default. TikTok chooses which renditions it serves and may change them over time. <Link href="/guides/check-video-resolution-and-fps">Check playback quality.</Link></>],
  ["Can I use HDR or 120 fps?", <>The resolution presets cap output at 60 fps. The default keeps source timing where supported. HDR and wide-gamut re-encoding require a color conversion the browser workflow does not perform. Use an SDR source for these presets.</>],
  ["Is OQM free?", <>Yes. Patch as many videos as you like, without an account, installation or watermark. <a href={sourceUrl}>Read the source code.</a></>],
] as const;

function Workflow() {
  return <section className="story-block workflow-block" id="how-it-works" aria-labelledby="how-title">
    <svg className="meadow-edge" viewBox="0 0 1440 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0h1440v9q-145 31-340 10T728 24Q533 50 322 29T0 16Z"/></svg>
    <div className="story-wrap">
      <h2 id="how-title">From your edit to TikTok.</h2>
      <ol className="workflow-steps">{steps.map(([title,copy],i)=><li key={title}>
        <div className={`step-art step-art-${i+1}`} aria-hidden="true">
          {i===1 ? <div className="sample-settings"><span>Preset</span><b>Silent-tail <i>⌄</i></b><span className="sample-start">Start patching →</span></div>
            : <div className="sample-file"><EditStill/><div><small>{i===0 ? "Source file" : "Patched file"}</small><b>{i===0 ? "ridge-edit.mov" : "ridge-edit.mp4"}</b><span>{i===0 ? "MOV video" : "Download MP4 ↓"}</span></div></div>}
        </div>
        <h3><span className="step-number">{i+1}</span>{title}</h3><p>{copy}</p>
      </li>)}</ol>
      <PatcherLink className="story-link">Open the free patcher →</PatcherLink>
    </div>
  </section>;
}

function Allowance() {
  const editDays = [2,4,7,11,12,18,22,23,27,30];
  return <section className="story-block allowance-block" id="compare" aria-labelledby="compare-title"><div className="story-wrap story-split">
    <div><h2 id="compare-title">Patch as often<br/>as you edit.</h2><p className="story-lead">Free forever. No monthly cap, no watermark and no account.</p><a className="story-link" href={sourceUrl}>View the source code ↗</a></div>
    <figure className="allowance-log"><figcaption><span>Patches per month</span><strong>No limit</strong></figcaption><div className="edit-month" aria-hidden="true">{Array.from({length:30},(_,i)=><span key={i} className={editDays.includes(i+1) ? "edit-day" : ""}>{editDays.includes(i+1) ? "✓" : i+1}</span>)}</div><small>Example monthly edit log</small></figure>
  </div></section>;
}

function Presets() {
  return <section className="story-block preset-block" id="presets" aria-labelledby="presets-title"><div className="story-wrap">
    <div className="story-head"><h2 id="presets-title">Choose your output.</h2><p>All three presets use Silent-tail. Pick the size that suits your edit.</p></div>
    <div className="preset-studies">{presets.map(([name,spec,copy],i)=><article key={name}><div className="preset-plate" aria-hidden="true"><div className="dimension-frame"><EditStill/></div><span>{["Source","1080p","2160p"][i]}</span></div>
      <h3>{name}{i===0 && <small>Default</small>}</h3><b>{spec}</b><p>{copy}</p></article>)}</div>
    <p className="preset-example">A 1080p30 source stays 1080p30 with the 4K preset. <Link href="/guides/tiktok-export-settings">See full export settings →</Link></p>
  </div></section>;
}

function MethodsAndPrivacy() {
  return <>
    <section className="story-block" aria-labelledby="abc-title"><div className="story-wrap story-split">
      <div><h2 id="abc-title">One source.<br/>Three methods.</h2><p className="story-lead">Compare clean MP4, Original OQM and Silent-tail using one prepared file.</p><p>Open <strong>Advanced settings → Tools &amp; help</strong> in the patcher, then choose <strong>Make local comparison (3)</strong>.</p><Link className="story-link" href="/guides/silent-tail-method">Explore the method →</Link></div>
      <MethodBranches/>
    </div></section>
    <section className="story-block privacy-block" aria-labelledby="privacy-title"><div className="story-wrap story-split">
      <div><h2 id="privacy-title">Your video stays<br/>on your device.</h2><p className="story-lead">Your browser reads, patches and saves the file. OQM’s server never receives its contents or filename.</p>
        <details className="analytics-details"><summary>What gets recorded?</summary><p>Conversion reports can include selected settings, format and size, output properties, timing, outcome, browser, operating system, country, referral campaign and a salted network hash. These analytics do not store raw IP addresses.</p></details></div>
      <figure className="device-figure"><div className="device-window"><header><i aria-hidden="true"/>Your browser</header><div className="device-flow"><span><EditStill/>Source file</span><i aria-hidden="true">→</i><span><TopicMark slug="patch"/>Patch</span><i aria-hidden="true">→</i><span><TopicMark slug="mov-to-mp4-for-tiktok"/>MP4 file</span></div></div><figcaption><TopicMark slug="patch"/> Separate report · conversion analytics</figcaption></figure>
    </div></section>
  </>;
}

function ReadingSections() {
  return <div className="story-block reading-block"><div className="story-wrap">
    <section id="editor-guides" aria-labelledby="resources-title"><div className="story-head"><h2 id="resources-title">Editor guides.</h2><Link className="story-link" href="/guides">All eight guides →</Link></div>
      <div className="reading-links">{guideLinks.map(([slug,title,copy])=><Link key={slug} href={`/guides/${slug}`}><TopicMark slug={slug}/><h3>{title}</h3><p>{copy}</p><span aria-hidden="true">↗</span></Link>)}</div>
    </section>
    <section className="story-split faq-section" aria-labelledby="faq-title"><h2 id="faq-title">Common questions.</h2><div>{faqs.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
  </div></div>;
}

export default function LandingSections() {
  return <div className="story"><Workflow/><Allowance/><Presets/><MethodsAndPrivacy/><ReadingSections/>
    <section className="closing-section" aria-labelledby="ready-title"><ClosingValley/><div className="closing-copy"><h2 id="ready-title">Get your video ready for TikTok.</h2><p>4K at 60 fps. Free forever.</p><PatcherLink className="sun-action closing-action">Patch your video →</PatcherLink></div></section>
    <footer className="story-footer"><div className="story-wrap"><Link href="/" className="footer-brand"><Image src="/logo.png" width={32} height={32} alt=""/>Open Quality Method</Link><nav aria-label="Reading resources"><Link href="/guides">Editor guides</Link><a href="/guides/feed.xml">RSS feed</a></nav><nav aria-label="Project links"><a href={sourceUrl}>GitHub ↗</a><a href="https://www.tiktok.com/@openqualitymethod">TikTok ↗</a></nav></div></footer>
  </div>;
}
