// 画面側の起動設定（X-002 の画面版）。process.env を読むのはここだけ。NEXT_PUBLIC_* は build 時に埋まる（秘密は置かない）
export const WEB_ENV = {
  apiBase: (process.env["NEXT_PUBLIC_API_BASE"] ?? "http://127.0.0.1:3001").replace(/\/$/, ""),
  isProduction: process.env.NODE_ENV === "production",
  devPages: process.env["KANAME_DEV_PAGES"] === "1",
} as const;
