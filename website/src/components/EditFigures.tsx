// The example edit keeps the same portrait crop and colors in every figure.
export function EditStill({ className = "" }: { className?: string }) {
  return <svg className={`edit-still ${className}`} viewBox="0 0 120 172" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="120" height="172" fill="#a8dafa"/>
    <circle cx="84" cy="53" r="18" fill="#fff0ae"/>
    <path d="m0 75 31-24 9 4 20-18 26 31 14-6 20 16v48H0Z" fill="#85afc2"/>
    <path d="M-7 91 20 51 27 51 44 20 64 51 72 53 105 106l18 11v26H-7Z" fill="#6196ac"/>
    <path d="m44 20 20 31 8 2 33 53-29-16-13-19-14-12Z" fill="#3a677e"/>
    <path d="m44 20-17 31-7 0-9 16 14-10 5 1 11-21 3 9 4-6 10 13-4-13Z" fill="#f6fbf1"/>
    <path d="M0 82q18-4 44 14t37 13q26-13 39-33v70H0Z" fill="#5d9784"/>
    <path d="M0 99q22-6 42 9t46 5q23-10 32-24v60H0Z" fill="#9dcb73"/>
    <path d="M48 116q32 5 55-8-8 7-21 12-7 2 7 4l-34 6-18-5q37-5 11-9Z" fill="#c4e7dc"/>
    <path d="M0 117q21-7 39 4t42 6q19-8 39-7v54H0Z" fill="#409267"/>
    <path d="M89 126q-22 6-11 10 14 5-1 13-16 9-23 23H30q15-19 34-27 12-6 4-9-9-5 21-10Z" fill="#e1d798"/>
    <path d="m4 127 7-15 7 15h-5v4H9v-4Zm8-4 5-10 5 10h-4v4h-2v-4Zm85 8 4-9 4 9h-3v3h-2v-3Z" fill="#225f50"/>
  </svg>;
}

export function TopicMark({ slug }: { slug: string }) {
  const paths: Record<string, string> = {
    "tiktok-export-settings": "M5 3h10v18H5z M19 3v18m0-15h-2m2 4h-2m2 4h-2m2 4h-2",
    "mov-to-mp4-for-tiktok": "M5 2h9l5 5v15H5z M14 2v6h5 M9 12l5 3-5 3z",
    "silent-tail-method": "M2 8h18 M2 15h3l2-4 3 8 3-7 2 3h7",
    "why-tiktok-videos-look-blurry": "M3 4h15v11H3z M7 8h14v12H7 M8 12l3-3 4 4",
    "tiktok-60fps": "M2 6h4v12H2z M10 6h4v12h-4z M18 6h4v12h-4z",
    "patch": "M3 6h13m3 0h2M3 12h3m3 0h12M3 18h9m3 0h6M16 3v6M8 9v6m5 0v6",
    "browser-video-conversion-errors": "M2 4h20v16H2z M2 8h20 M12 11v3m0 2v.5",
    "check-video-resolution-and-fps": "M3 3h18v18H3z M3 9h18 M8 9v12 M3 15h18",
    "tiktok-video-quality": "M2 6h8v12H2z M14 10l4-4 4 4m-4-4v11",
  };
  return <svg className="topic-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={paths[slug]} /></svg>;
}

export function MethodBranches() {
  return <figure className="method-map">
    <div className="map-origin"><EditStill /><strong>One prepared source</strong></div>
    <ul>{["Clean MP4", "Original OQM", "Silent-tail"].map((label,i)=><li key={label}>
      <EditStill /><span>{label}</span><span className={`track-pair${i === 2 ? " has-tail" : ""}`} aria-hidden="true"><i/><i/></span>
    </li>)}</ul>
    <figcaption>Each output uses the same encoded video. Silent-tail adds a short audio tail.</figcaption>
  </figure>;
}

export function CheckpointGrid() {
  return <div className="checkpoint-grid"><strong>Playback check</strong><strong>Resolution / fps</strong>
    {["After processing","24 hours","72 hours","7 days"].map(time=><div className="checkpoint-row" key={time}><span>{time}</span><span aria-label="To be measured">—</span></div>)}
  </div>;
}

export function ClosingValley() {
  return <div className="closing-valley" aria-hidden="true">
    <i className="closing-sun"/>
    <svg viewBox="0 0 1440 200" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path fill="var(--valley-far)" d="M-20 99 61 51 98 64 147 23 191 51 226 44 339 105 400 85 504 134 571 112 632 130 710 139 789 116 864 128 974 79 1037 96 1168 33 1205 49 1290 7 1380 53 1460 34v183H-20Z"/>
      <path fill="var(--valley-mid)" d="M-20 85q118-31 275 25t229 33q146-11 245 20 175-23 274-56t207-18q110 5 250-42v165H-20Z"/>
      <path fill="var(--valley-near)" d="M-20 116q112-24 249 12t277 41q152-18 263 5 131-22 249-19 101 5 217-29t225-30v110H-20Z"/>
    </svg>
  </div>;
}
