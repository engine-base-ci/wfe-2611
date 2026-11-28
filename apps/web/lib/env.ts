// 画面側の起動設定（X-002 の画面版）。process.env を読むのはここだけ。NEXT_PUBLIC_* は build 時に埋まる（秘密は置かない）
export const WEB_ENV = {
  // 「/」か空なら画面と同じ住所（相対の道で呼ぶ・K-262）。未設定なら手元の口
  apiBase: (process.env["NEXT_PUBLIC_API_BASE"] ?? "http://127.0.0.1:3001").replace(/\/$/, ""),
  isProduction: process.env.NODE_ENV === "production",
  // サーバ側（(dev)/layout など）。クライアントには埋まらない
  devPages: process.env["KANAME_DEV_PAGES"] === "1",
  /** クライアントでも見える dev 判定（build 時に埋まる）。dev の代わりの操作を画面に出すかどうか */
  devClient: process.env["NEXT_PUBLIC_KANAME_DEV_PAGES"] === "1",
  /** 運営の問い合わせ先（画面に出す・build 時に埋まる） */
  opsEmail: process.env["NEXT_PUBLIC_OPS_EMAIL"] || "info@engine-base.com",
  /** 開発の受信箱が読む API のログ（サーバ側の (dev) だけ） */
  apiLog: process.env["KANAME_API_LOG"] ?? "../../.dev-logs/api.log",
} as const;
