"""End-to-end tests. Needs ffmpeg/ffprobe on PATH. Run: python -m unittest discover tests"""

import tempfile
import unittest
from pathlib import Path

from oqm import ff, measure, mp4, patches, verify


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


if __name__ == "__main__":
    unittest.main()
