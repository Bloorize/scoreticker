import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Link',
            value: '<https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2568418773305987>; rel=preconnect',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
