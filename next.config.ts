import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tắt StrictMode để dev không double-invoke effect (tránh fetch gọi 2 lần,
  // request đầu bị abort/cancel trong network tab). Production vốn đã gọi 1 lần.
  reactStrictMode: false,
};

export default nextConfig;
