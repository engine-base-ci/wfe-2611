// パスキーのチャレンジを Cookie でなく JSON と頭で受け渡す（K-304・D-051.2）。画面は別の origin で Cookie を使わない（Bearer だけ）。
//   部品（@better-auth/passkey）はチャレンジの手がかりを署名つきの Cookie に入れて持つので、/api/auth/* の入口で写し替える:
//   ① GET  /passkey/generate-*-options の答え：部品が付けたチャレンジの Set-Cookie を外し、その値を JSON の challenge_token に入れる
//   ② POST /passkey/verify-* の要求：頭 x-passkey-challenge の値を、チャレンジの Cookie にして部品に渡す（頭が無ければ渡さない＝部品が断る）
//   値は Set-Cookie の値（署名つき・URL 符号化のまま）をそのまま写し、手で組み立てない。値はログに出さない。
import type { Auth } from "@kaname/auth";

export const CHALLENGE_FIELD = "challenge_token";
export const CHALLENGE_HEADER = "x-passkey-challenge";
const OPTIONS_PATH = /^\/passkey\/generate-(authenticate|register)-options$/;
const VERIFY_PATH = /^\/passkey\/verify-(authentication|registration)$/;
/** 写してよい値の形（URL 符号化した署名つきの値。; や改行で別の Cookie を差し込ませない） */
const TOKEN_SHAPE = /^[A-Za-z0-9%._~+/=-]{1,512}$/;
const PASSKEY_COOKIE = "better-auth-passkey";

const cookieNames = new WeakMap<object, Promise<string>>();
/** 実際の Cookie の名前（接頭辞つき。https では __Secure- も付く）を部品から引く */
const cookieNameOf = (auth: Auth): Promise<string> => {
  let p = cookieNames.get(auth);
  if (!p) {
    const ctx = (auth as unknown as { $context: Promise<{ createAuthCookie: (n: string) => { name: string } }> })
      .$context;
    p = ctx.then((c) => c.createAuthCookie(PASSKEY_COOKIE).name);
    cookieNames.set(auth, p);
  }
  return p;
};

/** cookie の頭から、その名前の項を外す */
const withoutCookie = (cookie: string | null, name: string): string[] =>
  (cookie ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x !== "" && x.split("=")[0]!.trim() !== name);

/** ① 答えの Set-Cookie からチャレンジを取り出し、JSON に足す */
async function exposeChallenge(res: Response, name: string): Promise<Response> {
  if (!res.ok) return res;
  const cookies = res.headers.getSetCookie();
  const mine = cookies.find((c) => c.startsWith(`${name}=`));
  if (!mine) return res;
  const value = mine.slice(name.length + 1).split(";")[0]!;
  const body = (await res.json()) as Record<string, unknown>;
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  for (const c of cookies) if (c !== mine) headers.append("set-cookie", c);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify({ ...body, [CHALLENGE_FIELD]: value }), { status: res.status, headers });
}

/** ② 頭のチャレンジを Cookie にして要求を作り直す（頭が無い・形が違えば Cookie を渡さない） */
async function carryChallenge(req: Request, name: string): Promise<Request> {
  const token = req.headers.get(CHALLENGE_HEADER);
  const headers = new Headers(req.headers);
  headers.delete(CHALLENGE_HEADER);
  const rest = withoutCookie(headers.get("cookie"), name);
  if (token && TOKEN_SHAPE.test(token)) rest.push(`${name}=${token}`);
  if (rest.length) headers.set("cookie", rest.join("; "));
  else headers.delete("cookie");
  return new Request(req.url, { method: req.method, headers, body: await req.arrayBuffer() });
}

/** /api/auth/* の入口から呼ぶ。パスキーの道でなければそのまま handler に渡す */
export async function withPasskeyChallenge(
  auth: Auth,
  req: Request,
  sub: string,
  handler: (r: Request) => Promise<Response>,
): Promise<Response> {
  if (req.method === "GET" && OPTIONS_PATH.test(sub))
    return exposeChallenge(await handler(req), await cookieNameOf(auth));
  if (req.method === "POST" && VERIFY_PATH.test(sub))
    return handler(await carryChallenge(req, await cookieNameOf(auth)));
  return handler(req);
}
