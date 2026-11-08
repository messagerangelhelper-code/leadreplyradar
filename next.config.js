/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only LeadReplyRadar itself and the CashCow Mail dashboard may show this app inside a page.
  // To add another dashboard address, set FRAME_ANCESTORS on Render (space separated).
  async headers() {
    const allowed = process.env.FRAME_ANCESTORS || 'https://cashcow-mail.onrender.com';
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self' " + allowed }] }];
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['imapflow', 'mailparser'],
  },
};

module.exports = nextConfig;
