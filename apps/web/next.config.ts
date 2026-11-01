import type { NextConfig } from "next";

// 画面は API（apps/api）を叩くだけ（D-043.3）。業務ロジックを Server Actions に置かない。API の口は NEXT_PUBLIC_API_BASE
const nextConfig: NextConfig = {
  // 本番ビルドの出力先を分けられるようにする（同じ .next を next dev と next start が奪い合うと壊れる）
  ...(process.env["NEXT_DIST_DIR"] ? { distDir: process.env["NEXT_DIST_DIR"] } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  transpilePackages: ["@kaname/contracts"], // workspace は src（.ts）を export している
  webpack: (config) => {
    // workspace の packages は NodeNext（import "./x.js" が x.ts を指す）。bundler にもその解決を教える
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"] };
    return config;
  },
  turbopack: { resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"] },
};
export default nextConfig;
