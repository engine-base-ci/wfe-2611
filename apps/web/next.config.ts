import type { NextConfig } from "next";
// 2026-11-14：配りを起こし直した（コミットの名義が個人の物だった間、Vercel が配りを止めていた・K-201）

// 画面は API（apps/api）を叩くだけ（D-043.3）。業務ロジックを Server Actions に置かない。API の口は NEXT_PUBLIC_API_BASE
const nextConfig: NextConfig = {
  // 本番ビルドの出力先を分けられるようにする（同じ .next を next dev と next start が奪い合うと壊れる）
  ...(process.env["NEXT_DIST_DIR"] ? { distDir: process.env["NEXT_DIST_DIR"] } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  transpilePackages: ["@kaname/contracts", "@kaname/config"], // workspace は src（.ts）を export している
  // 規約・プライバシーポリシーの文面のページ（K-53）は、ひな形（content/legal/*.md）を要求のときに読む。配布物にひな形を含める
  outputFileTracingIncludes: { "/legal/[kind]": ["./content/legal/**"] },
  webpack: (config) => {
    // workspace の packages は NodeNext（import "./x.js" が x.ts を指す）。bundler にもその解決を教える
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"] };
    return config;
  },
  turbopack: { resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"] },
};
export default nextConfig;
