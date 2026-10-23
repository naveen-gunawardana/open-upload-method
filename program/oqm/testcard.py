"""A synthetic clip that makes compression easy to see and measure.

Top: FFmpeg's testsrc2 (sharp edges, moving elements, colour bars).
Middle: a zooming Mandelbrot (fine detail in motion - the first thing encoders smear).
Bottom: smooth gradients (banding shows up here first).
Every frame differs, so `unique fps` should equal the declared fps.
"""

from . import ff


def make(dst, fps=60, seconds=10, width=1080, height=1920):
    top, mid = height // 2, height // 4
    bot = height - top - mid
    graph = (f"testsrc2=s={width}x{top}:r={fps}[a];"
             f"mandelbrot=s={width}x{mid}:r={fps}[b];"
             f"gradients=s={width}x{bot}:r={fps}:speed=0.02[c];"
             f"[a][b][c]vstack=inputs=3,format=yuv420p[v]")
    ff.ffmpeg("-v", "error", "-filter_complex", graph, "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=48000",
              "-map", "[v]", "-map", "0:a", "-t", str(seconds),
              "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-g", str(fps * 2),
              "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
              "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst))
