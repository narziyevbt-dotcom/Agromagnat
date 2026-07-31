import type { NextConfig } from 'next';

/**
 * Listing photos come from S3-compatible storage — MinIO in dev, the
 * production bucket later. Both have to be allow-listed for next/image.
 */
const imageHost = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_S3_URL ?? 'http://localhost:9000');
    return {
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port || undefined,
    };
  } catch {
    return { protocol: 'http' as const, hostname: 'localhost', port: '9000' };
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [imageHost],
    // WebP is already what the backend stores; AVIF buys little for the extra CPU.
    formats: ['image/webp'],
  },

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
