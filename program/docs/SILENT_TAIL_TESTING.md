# Experimental silent-tail testing

The existing OQM recipe remains the default. Choose **Silent-tail (experimental)** in the converter to test it separately. Choose settings before selecting a video at `/convert`, or use the existing upload panel.

Silent-tail requires a clean MP4 with one video and one unencrypted AAC-LC stereo audio track. It preserves encoded video packets, appends approximately 0.35 seconds of real AAC silence, updates audio timing/sample descriptions and duplicates the audio track. The container can become longer than the video; inspect audio sync, end-of-video playback and looping. The browser port accepts bounded 32-bit movie-index boxes and rejects unsupported layouts rather than stacking this method with legacy patches.

**Make local comparison (3)** prepares the selected source once, then builds:

1. A: clean MP4.
2. B: the current full OQM patch set.
3. C: standalone silent-tail.

If re-encode is enabled, only the shared source is encoded. All three arms then use the same encoded packets. If disabled, the source is remuxed without video encoding. Browser read-back checks validate container/packet metadata, not decoded pixels or TikTok outcomes. The automated FFmpeg tests independently verify packet identity, decoded video, original audio packets and appended silence/timing entries.

For the desktop command, run `python3 -m oqm compare INPUT.mp4 --out FRESH_DIRECTORY` from `program/`. This performs no encoding or uploads. It writes three MP4s, a local integrity manifest and a pending `retention.csv`. Verify silent-tail explicitly with `python3 -m oqm verify A_clean.mp4 C_silent_tail.mp4 --method silent-tail`; ordinary verification continues to reject changed primary audio.

Start with 1080p60 SDR. Check every accessible rendition on desktop and a second phone/account after processing and at 24 hours, 72 hours and seven days. Record the upload route, post URL, observation time, dimensions, video bitrate, metadata frame rate and independently decoded frame rate when obtainable. A quality label or high SSIM alone does not prove packet passthrough or retention. Progress to 4K after the initial round; keep 120 fps and HDR separate. Local preservation does not guarantee TikTok will preserve resolution, frame rate or bitrate.

The implementation is pinned to upstream commit `348c179f21eef1202d22faabf704b80d78f216ca`; see `THIRD_PARTY_NOTICES.md` for attribution and license.
