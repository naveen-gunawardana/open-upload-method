import { ImageResponse } from "next/og";

export const alt = "Open Quality Method — free TikTok video quality tool. No account or installation needed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", padding: 56, background: "linear-gradient(145deg, #299af0, #b5e8ff 70%, #9cdb56)", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", borderRadius: 28, padding: "42px 48px", width: "100%", color: "#1d3348" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>OQM · Open Quality Method</div>
          <div style={{ fontSize: 24, color: "#08783a" }}>Free forever</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, lineHeight: 1.08, fontWeight: 700 }}>Free TikTok video quality tool.</div>
          <div style={{ fontSize: 27, color: "#5f7285" }}>Patch videos locally. No account or installation.</div>
        </div>
        <div style={{ fontSize: 24, color: "#2477c9" }}>openqualitymethod.com</div>
      </div>
    </div>,
    size,
  );
}
