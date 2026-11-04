// 画面の守りの見出し（ゼロトラストの決まり ZT11・K-23・D-128.88）。全部の画面の応答に付ける（apps/web/middleware.ts）。
//   Content-Security-Policy：読み込んでよい先を Kaname の画面と API だけにする。スクリプトは要求ごとの nonce が付いたものだけ（Next.js が自分のスクリプトに付ける）
//   frame-ancestors 'none'：ほかのサイトの中に Kaname の画面を埋め込ませない（クリックの横取りを防ぐ）
//   Referrer-Policy：ほかのサイトへ移るとき、どの画面にいたか（チケットの番号など）を渡さない
//   Strict-Transport-Security：本番は https だけで開く
export interface HeaderOptions {
  nonce: string;
  /** API の口（WEB_ENV.apiBase）。画面が呼ぶ・署名つきの資料を読む先 */
  apiBase: string;
  /** 開発（next dev）。React の作り直しに eval が要る・http で開く */
  dev: boolean;
}

export function contentSecurityPolicy(o: HeaderOptions): string {
  const api = new URL(o.apiBase).origin;
  const d: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${o.nonce}'`, "'strict-dynamic'", ...(o.dev ? ["'unsafe-eval'"] : [])],
    // 部品が style 属性で寸法を渡すので、style だけは inline を許す（スクリプトは許さない）
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", api],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", api, ...(o.dev ? ["ws:"] : [])],
    "media-src": ["'self'", "blob:", api],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    ...(o.dev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(d)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export function securityHeaders(o: HeaderOptions): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(o),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    ...(o.dev ? {} : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }),
  };
}

/** 要求ごとの nonce（推し量れない 16 バイト） */
export function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}
