import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Reads src/i18n/request.ts (language + messages for every request).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Dev only: lets you open the app from a tablet or another PC on the same Wi-Fi
  // (http://192.168.x.x:3000) with hot reload working. Without this, Next.js blocks
  // its dev connection from any address other than localhost and the console fills
  // with red WebSocket errors. Add more entries if your network uses another range.
  allowedDevOrigins: ["192.168.*.*"],
  // The starter template turns on "Cache Components" and "partial prefetching".
  // We leave them OFF on purpose: a POS shows live data per logged-in user, and
  // Cache Components keeps old screens alive in the background when you navigate,
  // which is the wrong default for order and payment screens. Pages stay plain
  // "dynamic by default" and are easier to reason about. We can revisit later.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
