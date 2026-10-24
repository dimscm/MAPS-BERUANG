/** @type {import('next').NextConfig} */
// Static export untuk GitHub Pages. BASE_PATH diisi otomatis oleh workflow (mis. /maps-beruang).
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

module.exports = nextConfig;
