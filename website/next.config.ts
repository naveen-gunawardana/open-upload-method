import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/font-preview", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/resources/tiktok-upload-test.csv", headers: [{ key: "Content-Disposition", value: 'attachment; filename="oqm-upload-test.csv"' }, { key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/llms.txt", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
