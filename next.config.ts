import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Blendet den Next.js-DevTools-Button (schwarzes "N" unten links) im
  // Dev-Modus aus — er überdeckte den KI-Bereich der Seitenleiste.
  devIndicators: false,
};

export default nextConfig;
