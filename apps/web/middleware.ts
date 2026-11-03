// 全部の画面の応答に、画面の守りの見出しを付ける（ZT11・KN-103）。中身は lib/security-headers.ts
//   nonce は要求の見出しにも載せる（Next.js が自分のスクリプトにこの nonce を付ける）
import { NextResponse, type NextRequest } from "next/server";
import { WEB_ENV } from "@/lib/env";
import { newNonce, securityHeaders } from "@/lib/security-headers";

export function middleware(req: NextRequest) {
  const nonce = newNonce();
  const h = securityHeaders({ nonce, apiBase: WEB_ENV.apiBase, dev: !WEB_ENV.isProduction });
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", h["Content-Security-Policy"]!);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}

// 画面の要求だけ（静的なファイルと画像の最適化は除く。どちらも Next.js が自分で見出しを付ける）
export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
