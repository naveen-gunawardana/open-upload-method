"""Post one video through TikTok's official Content Posting API (Direct Post) and report the publish status.

Used to test whether the official pipeline keeps more quality than a Studio upload. Posts are SELF_ONLY, which is
all an unaudited client may do.

    export TIKTOK_ACCESS_TOKEN=...      # user access token with the video.publish scope
    python3 tiktok_api_test.py video.mp4 "caption"

The token is read from the environment and never printed.
"""

import json
import os
import sys
import time
import urllib.request

API = "https://open.tiktokapis.com"
CHUNK = 10 * 1024 * 1024  # chunks of 5-64 MB are allowed; a file under that size goes up as one chunk


def call(path, token, body):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    token = os.environ.get("TIKTOK_ACCESS_TOKEN")
    if not token or len(sys.argv) < 2:
        sys.exit("usage: TIKTOK_ACCESS_TOKEN=... tiktok_api_test.py video.mp4 [caption]")
    path = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else os.path.basename(path)
    size = os.path.getsize(path)
    chunk = size if size <= CHUNK else CHUNK
    total = max(1, size // chunk)  # the last chunk absorbs the remainder
    init = call("/v2/post/publish/video/init/", token, {
        "post_info": {"title": title, "privacy_level": "SELF_ONLY"},
        "source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": chunk, "total_chunk_count": total},
    })
    if init.get("error", {}).get("code") != "ok":
        sys.exit(f"init failed: {init.get('error')}")
    publish_id, upload_url = init["data"]["publish_id"], init["data"]["upload_url"]
    print("publish_id", publish_id)

    with open(path, "rb") as f:
        for i in range(total):
            start = i * chunk
            data = f.read(chunk if i < total - 1 else size - start)
            req = urllib.request.Request(upload_url, data=data, method="PUT", headers={
                "Content-Type": "video/mp4",
                "Content-Length": str(len(data)),
                "Content-Range": f"bytes {start}-{start + len(data) - 1}/{size}",
            })
            with urllib.request.urlopen(req, timeout=300) as r:
                print("chunk", i + 1, "of", total, "->", r.status)

    for _ in range(30):
        st = call("/v2/post/publish/status/fetch/", token, {"publish_id": publish_id}).get("data", {})
        print("status", st.get("status"), st.get("fail_reason", ""))
        if st.get("status") in ("PUBLISH_COMPLETE", "FAILED"):
            break
        time.sleep(5)


if __name__ == "__main__":
    main()
