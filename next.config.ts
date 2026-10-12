import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Claude reaches the local development server through this ngrok host.
  // Next blocks cross-origin dev assets unless the host is explicitly allowed.
  allowedDevOrigins: ['gondola-concise-residue.ngrok-free.dev'],
};

export default nextConfig;
