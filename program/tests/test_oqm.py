"""End-to-end tests. Needs ffmpeg/ffprobe on PATH. Run: python -m unittest discover tests"""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from oqm import compare, export, ff, measure, mp4, patches, verify


def _clip(path, audio=True, fps=60, src_fps=None):
    rate = src_fps or fps
    args = ["-v", "error", "-f", "lavfi", "-i", f"testsrc2=s=320x568:r={rate}:d=2"]
    if audio:
        args += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:d=2"]
    if src_fps:
        args += ["-vf", f"fps={fps}"]  # duplicate frames up to fps
    args += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
    if audio:
        args += ["-c:a", "aac", "-shortest"]
    ff.ffmpeg(*args, str(path))


def _hard_failures(checks):
    return [c for c in checks if not c.ok and not c.warn]


class OQMTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.tmp.name)
        cls.src = cls.dir / "src.mp4"
        _clip(cls.src)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_reference_profile_keeps_video_and_audio_bit_identical(self):
        out = self.dir / "ref.mp4"
        patches.patch_file(self.src, out)
        self.assertEqual(_hard_failures(verify.verify(self.src, out)), [])

    def test_decoy_track_inflates_sample_count(self):
        out = self.dir / "decoy.mp4"
        patches.patch_file(self.src, out, patches.PatchOptions(enabled={"faststart", "decoy-audio"}, inflate=10))
        _, top = mp4.read_file(out)
        moov = next(b for b in top if b.type == b"moov")
        audio = [t for t in moov.find_all(b"trak") if mp4.handler_type(t) == b"soun"]
        self.assertEqual(len(audio), 2)
        counts = [mp4.u32(t.find(b"mdia", b"minf", b"stbl", b"stsz").payload, 8) for t in audio]
        self.assertEqual(counts[1], counts[0] * 10)
        self.assertNotEqual(mp4.track_id(audio[0]), mp4.track_id(audio[1]))

    def test_decoy_track_does_not_extend_container_duration(self):
        # Regression: the public reference method drops the edit list when cloning the
        # audio track, which un-trims the encoder's priming samples and silently extends
        # the container's declared (and played/looped) duration past the real video length.
        out = self.dir / "decoy_duration.mp4"
        patches.patch_file(self.src, out, patches.PatchOptions(enabled={"faststart", "decoy-audio"}, inflate=10))
        src_dur = float(ff.probe(self.src)["format"]["duration"])
        out_dur = float(ff.probe(out)["format"]["duration"])
        self.assertAlmostEqual(src_dur, out_dur, places=2)

    def test_control_profile_adds_nothing(self):
        out = self.dir / "control.mp4"
        report = patches.patch_file(self.src, out, patches.PatchOptions(enabled=set(patches.PROFILES["none"])))
        self.assertEqual(report.applied, ["faststart"])
        self.assertTrue(all(c.ok for c in verify.verify(self.src, out)))

    def test_mvhd_upgrade_preserves_identity_matrix(self):
        out = self.dir / "mvhd.mp4"
        patches.patch_file(self.src, out, patches.PatchOptions(enabled={"faststart", "mvhd-unknown-duration"}))
        _, top = mp4.read_file(out)
        p = next(b for b in top if b.type == b"moov").find(b"mvhd").payload
        self.assertEqual(p[0], 1)
        self.assertEqual(mp4.u64(p, 24), 0xFFFFFFFFFFFFFFFF)
        matrix = [mp4.u32(p, 48 + 4 * i) for i in range(9)]
        self.assertEqual(matrix, [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000])

    def test_no_audio_skips_decoy_cleanly(self):
        src = self.dir / "silent.mp4"
        _clip(src, audio=False)
        out = self.dir / "silent_oqm.mp4"
        report = patches.patch_file(src, out)
        self.assertTrue(any(s.startswith("decoy-audio") for s in report.skipped))
        self.assertEqual(_hard_failures(verify.verify(src, out)), [])

    def test_unique_fps_exposes_duplicated_frames(self):
        fake = self.dir / "fake60.mp4"
        _clip(fake, audio=False, fps=60, src_fps=30)
        self.assertLess(measure.unique_fps(fake), 40)
        self.assertGreater(measure.unique_fps(self.src), 55)

    def test_comparison_shares_video_and_keeps_silent_tail_explicit(self):
        stereo = self.dir / "stereo.mp4"
        ff.ffmpeg("-v", "error", "-i", str(self.src), "-c:v", "copy", "-ac", "2", "-c:a", "aac", str(stereo))
        folder = self.dir / "comparison"
        ok, manifest = compare.build(stereo, folder)
        self.assertTrue(ok, [(r["file"], [c for c in r["checks"] if not c["ok"] and not c["warn"]]) for r in manifest["results"]])
        self.assertEqual(len({r["video_sha256"] for r in manifest["results"]}), 1)
        self.assertTrue(all(r["fps"] == 60 for r in manifest["results"]))
        self.assertTrue((folder / "retention.csv").read_text().count("pending") == 24)
        self.assertTrue(_hard_failures(verify.verify(stereo, folder / "C_silent_tail.mp4")))
        with self.assertRaises(ValueError):
            compare.build(stereo, folder)

    def test_4k60_export_lets_encoder_choose_valid_level(self):
        source, out = self.dir / "4k60-source.mp4", self.dir / "4k60-export.mp4"
        ff.ffmpeg("-v", "error", "-f", "lavfi", "-i", "color=s=3840x2160:r=60:d=0.05",
                  "-c:v", "libx264", "-preset", "ultrafast", str(source))
        export.export(source, out)
        video = next(s for s in ff.probe(out)["streams"] if s["codec_type"] == "video")
        self.assertEqual((video["width"], video["height"]), (3840, 2160))
        self.assertEqual(ff.fraction(video["avg_frame_rate"]), 60)
        self.assertGreaterEqual(video["level"], 52)
        baseline = self.dir / "baseline.mp4"
        export.export(self.src, baseline, baseline=True)
        self.assertIn("Baseline", ff.probe(baseline)["streams"][0]["profile"])

    def test_hdr_export_rejects_silent_709_retag(self):
        with patch.object(ff, "probe", return_value={"streams": [{"codec_type": "video", "color_transfer": "smpte2084"}]}):
            with self.assertRaisesRegex(ValueError, "HDR"):
                export.export(self.src, self.dir / "hdr.mp4")

    def test_high_ssim_does_not_claim_passthrough(self):
        with patch.object(measure, "unique_fps", return_value=60), \
             patch.object(measure, "_compare", return_value="SSIM All:0.9999\nPSNR average:50.0"), \
             patch.object(ff, "stream_hash", side_effect=["a", "b"]), \
             patch.object(ff, "decoded_hash", side_effect=["c", "d"]):
            result = measure.measure(self.src, self.src, vmaf=False)
        self.assertTrue(result["high_visual_similarity"])
        self.assertFalse(result["video_packets_identical"])
        self.assertFalse(result["decoded_frames_identical"])
        self.assertNotIn("passthrough_likely", result)


if __name__ == "__main__":
    unittest.main()
