import { CheckpointGrid, EditStill } from "@/components/EditFigures";

import type { GuideIllustration } from "@/lib/guides";

const descriptions: Record<GuideIllustration,string> = {
  workflow: "Follow one edit from your source file to the local MP4. Check the posted rendition separately.",
  container: "Example MOV input. OQM can decode supported ProRes and prepare H.264 video and AAC audio for the patched MP4.",
  "audio-tail": "Simplified timeline. The tail is enlarged here so you can see it. The encoded video keeps its original length.",
  dimensions: "Portrait examples with the 1080p preset. It caps the shorter edge and preserves a smaller source.",
  playback: "Illustrative inspection points. Compare the same moment in your preview, export and served rendition to locate the first loss of detail.",
  cadence: "One tenth of a second of genuine motion. The dots mark three source frames at 30 fps and six at 60 fps.",
  errors: "The stage named in the error tells you which part of the workflow to troubleshoot.",
  retention: "Example local file and an empty playback log. Enter only the resolution and frame rate you can measure on each device.",
};

function Checkpoints({ playback }: { playback: boolean }) {
  const stages = playback ? ["Editor preview","Exported file","Served rendition"] : ["Source file","Patched MP4","TikTok playback"];
  return <div className="file-checkpoints">{stages.map((label,i)=><div key={label}><EditStill/><strong>{label}</strong><small>{(playback ? ["Inspect the timeline","Inspect the file","Inspect playback"] : ["Original edit","Local file checks","Check after posting"])[i]}</small></div>)}</div>;
}
function FrameCadence() {
  return <div className="cadence-rows">{[30,60].map(fps=><div key={fps}><b>{fps} fps</b><div className="cadence-path" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i} className={fps===60 || i%2===0 ? "recorded-frame" : ""}/>)}</div><span>{fps/10} frames</span></div>)}</div>;
}
export default function GuideFigure({ kind }: { kind: GuideIllustration }) {
  let drawing;
  switch(kind) {
    case "workflow": case "playback": drawing=<Checkpoints playback={kind==="playback"}/>;break;
    case "container": drawing=<div className="codec-flow"><div><b>MOV</b><span>Video · ProRes</span><span>Audio · PCM</span></div><i aria-hidden="true">→</i><div><b>MP4</b><span>Video · H.264</span><span>Audio · AAC</span></div></div>;break;
    case "audio-tail": drawing=<div className="audio-timeline"><div><b>Video track</b><span className="video-strip"/></div><div><b>Audio</b><span className="audio-strip"/></div><div><b>Added audio track</b><span className="extra-audio"/></div><small>Audio extension · ≈ 0.35 s</small></div>;break;
    case "dimensions": drawing=<div className="dimension-examples">{[["2160 × 3840","1080 × 1920"],["720 × 1280","720 × 1280"]].map(([before,after])=><div key={before}><EditStill/><span>{before} <em>→</em> <b>{after}</b></span></div>)}</div>;break;
    case "cadence": drawing=<FrameCadence/>;break;
    case "errors": drawing=<ol className="error-stages"><li><b>Read / decode</b><span>Unsupported input codec? Check the codec inside the MOV.</span></li><li><b>Encode output</b><span>Unsupported 4K encode? Try a 1080p SDR output.</span></li><li><b>Patch and check</b><span>Check the method’s input requirements and local result.</span></li></ol>;break;
    case "retention": drawing=<><div className="probe-example"><strong>Example local MP4</strong><code>1920 × 1080 · 60 fps</code></div><CheckpointGrid/></>;break;
  }
  return <figure className="guide-figure">{drawing}<figcaption>{descriptions[kind]}</figcaption></figure>;
}
