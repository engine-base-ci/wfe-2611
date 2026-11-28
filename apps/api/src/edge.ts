// 口の入口の置き換え（K-262・D-043.3）。画面と口を同じ住所に見せるとき、画面の入口（apps/web/middleware.ts）は /api/* を口へ中継し、
//   配り先の Vercel が上書きした本当の値（偽れない x-real-ip・x-vercel-ip-country）を x-kaname-client-ip・x-kaname-client-country に写して、
//   秘密（x-kaname-edge-secret・KANAME_EDGE_SECRET）を付ける。口はここ 1 か所だけで、秘密が合うときだけ写した値に置き換える。
//   IP と国を読む所（packages/auth の countryOf・ipOf・契約の口の ipOf・同意し直しの口・Better Auth の ipAddress）は何も変えずに正しい値を読む。
//   合わない・口に秘密が無いときは写した頭を消すだけ（元の頭は配り先の Vercel が上書きした本当の値のまま）。
//   渡ってくる頭を信じない：外への中継で国が渡る保証は公式に無い（.ticket-flow/perf-research.md §3-2）
import { timingSafeEqual } from "node:crypto";

export const EDGE_SECRET_HEADER = "x-kaname-edge-secret";
export const EDGE_CLIENT_IP_HEADER = "x-kaname-client-ip";
export const EDGE_CLIENT_COUNTRY_HEADER = "x-kaname-client-country";
const COPIED = [EDGE_CLIENT_IP_HEADER, EDGE_CLIENT_COUNTRY_HEADER, EDGE_SECRET_HEADER] as const;
const COUNTRY = /^[A-Za-z]{2}$/;

/** 時間の一定な比べ方。長さが違えば比べずに違うとする（timingSafeEqual は長さが違うと投げる） */
function sameSecret(sent: string | null, secret: string): boolean {
  if (!sent) return false;
  const a = Buffer.from(sent, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 秘密が合えば写した IP と国で置き換え、どちらでも写した頭と秘密を消した要求を返す。方法・道・体はそのまま（体は読まない） */
export function edgeRequest(req: Request, secret: string | undefined): Request {
  const h = new Headers(req.headers);
  if (secret && sameSecret(h.get(EDGE_SECRET_HEADER), secret)) {
    const ip = h.get(EDGE_CLIENT_IP_HEADER);
    if (ip) {
      h.set("x-forwarded-for", ip);
      h.set("x-real-ip", ip);
    } else {
      h.delete("x-forwarded-for");
      h.delete("x-real-ip");
    }
    const country = h.get(EDGE_CLIENT_COUNTRY_HEADER);
    // 写した国が読めないときは中継の国を残さない（中継の国で見張りが全員を閉じないように）
    if (country && COUNTRY.test(country)) h.set("x-vercel-ip-country", country);
    else h.delete("x-vercel-ip-country");
  }
  for (const k of COPIED) h.delete(k);
  return new Request(req, { headers: h });
}
