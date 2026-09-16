import type { NextConfig } from "next";

// 画面は API（apps/api）を叩くだけ（D-043.3）。業務ロジックを Server Actions に置かない。API の口は NEXT_PUBLIC_API_BASE
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
};
export default nextConfig;
