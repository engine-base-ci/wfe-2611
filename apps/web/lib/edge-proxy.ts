// 画面の入口の中継の計画（K-262・D-043.3）。画面と口を同じ住所に見せるため、/api/* を口の住所（KANAME_API_ORIGIN）へ中継する。
//   配り先の Vercel が上書きした本当の値（偽れない x-real-ip・x-vercel-ip-country）を x-kaname-client-ip・x-kaname-client-country に
//   上書き（set）し、秘密（KANAME_EDGE_SECRET）を x-kaname-edge-secret に set する。口の入口（apps/api/src/edge.ts）は秘密が合うときだけ使う。
//   process.env をここで読む訳（scripts/ci/env_audit.mjs の例外）：秘密を lib/env.ts に置くと 'use client' の部品が読む束に名前が入る。
//   中継の秘密はサーバーの入口（middleware.ts）だけが読む。NEXT_PUBLIC にしない
export interface EdgeEnv {
  apiOrigin?: string | undefined;
  secret?: string | undefined;
}

export interface ProxyPlan {
  /** 中継の先（口の住所 + 同じ道と問い合わせ） */
  target: string;
  /** 要求に上書きする頭 */
  set: Record<string, string>;
  /** 要求から消す頭（本当の値が無い写しの頭。利用者が付けた同じ名前の値を残さない） */
  remove: string[];
}

const CLIENT_IP = "x-kaname-client-ip";
const CLIENT_COUNTRY = "x-kaname-client-country";
const SECRET = "x-kaname-edge-secret";

/** 中継の環境変数を呼ぶたびに読む（サーバーだけ） */
export function edgeEnv(): EdgeEnv {
  return {
    apiOrigin: process.env["KANAME_API_ORIGIN"],
    secret: process.env["KANAME_EDGE_SECRET"],
  };
}

/** /api/* で、口の住所と秘密がそろっているときだけ中継の計画を返す。ほかは null（今までどおり） */
export function proxyPlan(req: Request, env: EdgeEnv): ProxyPlan | null {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (!env.apiOrigin || !env.secret) return null;
  const set: Record<string, string> = { [SECRET]: env.secret };
  const remove: string[] = [];
  const ip = req.headers.get("x-real-ip");
  const country = req.headers.get("x-vercel-ip-country");
  if (ip) set[CLIENT_IP] = ip;
  else remove.push(CLIENT_IP);
  if (country) set[CLIENT_COUNTRY] = country;
  else remove.push(CLIENT_COUNTRY);
  return { target: `${env.apiOrigin.replace(/\/$/, "")}${url.pathname}${url.search}`, set, remove };
}
