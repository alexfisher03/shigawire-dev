import type { NextConfig } from "next";

const isTauriExport = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isTauriExport
    ? {
        output: "export",
        distDir: "out",
      }
    : {}),
  images: {
    unoptimized: true,
  },
  ...(isTauriExport
    ? {}
    : {
        async rewrites() {
          const backend = process.env.BACKEND_INTERNAL_URL || "http://localhost:8083";
          return [
            {
              source: "/api/v1/:path*",
              destination: `${backend}/api/v1/:path*`,
            },
          ];
        },
      }),

      devIndicators: false,
};

export default nextConfig;
