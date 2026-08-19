/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We call out to system binaries (pm2, systemctl, nginx) from API routes,
  // so those routes must run on the Node.js runtime, not the Edge runtime.
  eslint: {
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
