// 預ける小窓の値 → 預けるの口 createCredential の体（K-372・正は口の葉 K-352 の入力の整え）。画面の部品は持たない（直し方だけ）。
//   名前：NFKC → 前後の空白を取る → 大文字。使える場所：NFKC → カンマ・読点・空白で区切る → 小文字 → 空を捨てる
//   （名前と使える場所はサーバーも同じ直しをする・最後の砦）。
//   期限：前後の空白を取り / を - に、月日は 2 けたに（2027/1/5 → 2027-01-05）・空なら送らない。口は YYYY-MM-DD の形だけを受けるので、ここはクライアントだけで直す。
//   説明：空なら送らない。鍵（kind key）には two_factor・totp_secret を送らない。totp_secret は 2 段階が認証アプリのときだけ
import type { Ops } from "@kaname/contracts";
import type { AddCredentialErrors, AddCredentialValues, CredentialField } from "./views";

export type CreateCredentialBody = Ops["createCredential"]["body"];

const FIELDS: readonly CredentialField[] = [
  "name",
  "description",
  "login",
  "password",
  "value",
  "two_factor",
  "totp_secret",
  "destinations",
  "expires_on",
];

export const normalizeName = (s: string): string => s.normalize("NFKC").trim().toUpperCase();

export const normalizeDestinations = (s: string): string[] =>
  s
    .normalize("NFKC")
    .split(/[,、\s]+/)
    .map((d) => d.toLowerCase())
    .filter((d) => d !== "");

/** 期限の字を口の形に寄せる（形が違えばそのまま送り、口の 422 の文を期限の欄の下に出す） */
export function normalizeExpires(s: string): string {
  const t = s.trim().replace(/\//g, "-");
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  return m ? `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}` : t;
}

export function toCreateBody(v: AddCredentialValues): CreateCredentialBody {
  const description = v.description.trim() === "" ? {} : { description: v.description };
  const expires = normalizeExpires(v.expires_on);
  const expiresOn = expires === "" ? {} : { expires_on: expires };
  const common = { layer: v.layer, name: normalizeName(v.name), ...description };
  const destinations = normalizeDestinations(v.destinations);
  if (v.kind === "key") return { kind: "key", ...common, value: v.value, destinations, ...expiresOn };
  return {
    kind: "login",
    ...common,
    login: v.login,
    password: v.password,
    two_factor: v.two_factor,
    ...(v.two_factor === "totp" ? { totp_secret: v.totp_secret } : {}),
    destinations,
    ...expiresOn,
  };
}

/** 口の 422 の欄ごとの理由 → 小窓の欄（destinations.0 のような添え字は欄の名前に寄せる）。小窓に無い欄は返さない */
export function fieldErrorsOf(fields: Record<string, string>): AddCredentialErrors {
  const out: AddCredentialErrors = {};
  for (const [key, message] of Object.entries(fields)) {
    const f = FIELDS.find((x) => x === key.split(/[.[]/)[0]);
    if (f && !out[f]) out[f] = message;
  }
  return out;
}
