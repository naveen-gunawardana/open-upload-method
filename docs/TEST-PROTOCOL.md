# Test protocol

One upload proves nothing. TikTok may serve different renditions to different devices, change behaviour week to week, and treat new accounts differently. Here's how to get a result worth sharing.

## Setup

1. **Use a test account**, not your main one.
2. **Pick the clip.** Either a real edit or `oqm testcard card.mp4 --fps 60` (fine moving detail, sharp edges and gradients make differences obvious).
3. **Make the master once:** `oqm export edit.mov master.mp4`
4. **Build the kit:** `oqm abtest master.mp4` gives you

| Arm | What it is | Question it answers |
|---|---|---|
| A_control | Same bitstream, normal file | What does TikTok do to a good file anyway? |
| B_reference | Full method | Does the full method beat control? |
| C_decoy_only | Decoy audio track only | Is the decoy the part that matters? |
| D_structure_only | Everything except decoy | ...or is it the other changes? |

## Uploading

- **Same route for every arm**: all web, or all phone app. Record which in `upload_route`.
- **Same settings**: same caption length, no TikTok editor effects, no trimming in-app. In-app editing triggers re-rendering on its own.
- **Spread them out**: about an hour apart, in shuffled order (not always A first).
- Note whether you posted public or private-first. Methods disagree on this, and it may matter.

## Collecting the served copy

For each post, from a **different** account or device:
1. Download the video, or screen-record at full resolution with no overlays.
2. Run `oqm measure master.mp4 served_B.mp4 --json` (always compare to the **master**, not the patched file).
3. Copy the numbers into `RESULTS.csv`. Also note playback problems (no sound, stutter, won't seek, won't loop) and 24 h views.

## Reading the result

- If **B is no better than A**, the method isn't working for you right now. Stop paying for it if you were.
- If **B beats A and C matches B**, the decoy track is doing the work.
- If **B beats A and D matches B**, the decoy doesn't matter. Drop it, since it's the riskiest change.
- **Views:** one post with low views proves nothing. Look for a pattern across several kits before calling anything a "shadowban."
- Repeat on another day before you trust a difference.

## Sharing

Submit your filled `RESULTS.csv` (no account names needed) as described in CONTRIBUTING.md. Results from many editors over time are the only real answer to "does this work right now."
