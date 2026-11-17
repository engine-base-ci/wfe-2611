// 全部の画面の応答に、画面の守りの見出しを付ける（ZT11・K-23）。中身は lib/security-headers.ts
//   nonce は要求の見出しにも載せる（Next.js が自分のスクリプトにこの nonce を付ける）
//   /api/* は口へ中継する（K-262・lib/edge-proxy.ts）。中継の答えには画面の守りの見出しと nonce を付けない（D-128.88）。
//   口の住所か秘密が無い間は中継しない（今までどおり）
import { NextResponse, type NextRequest } from "next/server";
import { WEB_ENV } from "@/lib/env";
import { edgeEnv, proxyPlan } from "@/lib/edge-proxy";
import { newNonce, securityHeaders } from "@/lib/security-headers";

export function middleware(req: NextRequest) {
  const plan = proxyPlan(req, edgeEnv());
  if (plan) {
    const headers = new Headers(req.headers);
    for (const [k, v] of Object.entries(plan.set)) headers.set(k, v);
    for (const k of plan.remove) headers.delete(k);
    return NextResponse.rewrite(plan.target, { request: { headers } });
  }
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
