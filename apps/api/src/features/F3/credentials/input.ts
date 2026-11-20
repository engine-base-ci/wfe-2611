// 預けたログイン情報の入力の整え（K-352 預ける。K-353 の上書きも同じ整えを使う）。
//   表記ゆらぎ（全角半角・前後の空白）は入口（op.ts の normalize）が揃えた後に来るが、ここでも同じに直す（サーバーが最後の砦）。
//   秘密の中身（パスワード・鍵の値）だけは、入口が直す前の値（打ったとおり）を受け取って確かめる。値はログにもエラーにも出さない。
//   エラーの文は正本（errors.json → @kaname/errors）から引く
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";
import { todayJst } from "../../F4/create-ticket/input.js";
import { destinationOf } from "./host.js";
import { DESTINATION_RE_RAW, EXPIRES_RE_RAW, LOGIN_RE_RAW, NAME_RE_RAW, PUBLIC_SUFFIXES_LIST } from "./patterns.js";

export { NAME_PATTERN } from "./patterns.js";

/** 名前の形：英字から始まる英大文字・数字・_ の 64 文字まで（DB の check と同じ・D-125.148） */
export const NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** 使える場所の数の上限 */
export const DESTINATIONS_MAX = 20;
/** 使える場所の形：点で区切った名前（頭の *. は下の名前だけの印）。点の無い名前・IP は通さない */
const DESTINATION_RE = /^(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
/** 公開の接尾辞（形の確かめの最後の砦。一覧は patterns.ts） */
export const PUBLIC_SUFFIXES: ReadonlySet<string> = new Set(PUBLIC_SUFFIXES_LIST);
export const LAYERS = ["workspace", "personal"] as const;
export const KINDS = ["login", "key"] as const;
export const TWO_FACTORS = ["none", "totp", "sms", "email", "push"] as const;
export type Layer = (typeof LAYERS)[number];
export type Kind = (typeof KINDS)[number];
export type TwoFactor = (typeof TWO_FACTORS)[number];

/** 正本のエラーを、欄の名前つきの答えにする（画面は details の欄の下に文を出す） */
export const fail = (code: string, field?: string): HookReply => {
  const e = kanameError(code);
  return {
    status: e.status,
    body: { ...e.toJSON(), ...(field ? { field, details: [{ field, message: e.entry.message }] } : {}) },
  };
};
/** 契約の形に合うが決まった値の外（層・種類・2 段階の種類）：入口の形の確かめと同じ答え */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 時刻や預けた物の状態で決まる断り：409（欄は付けない）。番号は正本のエラーのまま */
export const conflict409 = (code: string): HookReply => {
  const e = kanameError(code);
  return { status: 409, body: { ...e.toJSON(), error: "conflict" } };
};
export const isReply = (v: unknown): v is HookReply =>
  typeof v === "object" && v !== null && "status" in v && "body" in v;

const text = (v: unknown): string => (typeof v === "string" ? v.normalize("NFKC").trim() : "");
const oneOf = <T extends string>(v: unknown, set: readonly T[]): T | null =>
  typeof v === "string" && (set as readonly string[]).includes(v) ? (v as T) : null;

/** ① 名前：全角・小文字・前後の空白は直して大文字に。形が違えば 422・E-CRED-001 */
export function parseName(v: unknown, raw: unknown = v): string | HookReply {
  // 先に打ったとおりを契約と同じ pattern で照らす（ß などを大文字化で英字にして受けない）。その後に直した形で DB の check と同じ形を見る
  if (typeof raw !== "string" || !NAME_RE_RAW.test(raw)) return fail("E-CRED-001", "name");
  const name = text(v).toUpperCase();
  return NAME_RE.test(name) ? name : fail("E-CRED-001", "name");
}

/** ⑧ 説明：前後の空白を落とし、空は null（長さの上限は置かない・D-130.1）。DB の文字の列に入らない NUL だけは除く（金庫に置いた後で行が作れなくなるのを避ける） */
export function parseDescription(v: unknown): string | null {
  // eslint-disable-next-line no-control-regex -- 保存できない NUL を除く
  return text(typeof v === "string" ? v.replace(/\u0000/g, "") : v) || null;
}

/** ② 使える場所：1〜20 個のドメイン。URL・大文字・全角・末尾の点は直す。重なりは前の順で 1 つに。
 *  無い・空は 422・E-CRED-003。ドメインでない物・公開の接尾辞だけ・21 個以上は 422・E-CRED-002 */
export function parseDestinations(v: unknown, rawList: unknown = v): string[] | HookReply {
  if (!Array.isArray(v) || v.length === 0) return fail("E-CRED-003", "destinations");
  if (v.length > DESTINATIONS_MAX) return fail("E-CRED-002", "destinations");
  const out: string[] = [];
  for (const [i, raw] of v.entries()) {
    // 先に打ったとおりを契約と同じ pattern で照らす（合わなければ使える場所の形違い）
    const typed = Array.isArray(rawList) ? rawList[i] : undefined;
    if (typeof typed !== "string" || !DESTINATION_RE_RAW.test(typed)) return fail("E-CRED-002", "destinations");
    const d = typeof raw === "string" ? destinationOf(raw) : null;
    if (d === null || !DESTINATION_RE.test(d) || PUBLIC_SUFFIXES.has(d.replace(/^\*\./, "")))
      return fail("E-CRED-002", "destinations");
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

/** ③ 期限：無いか null は期限なし。打ったとおりが契約と同じ pattern（年-月-日・暦に在る日）に合わなければ 422（欄 expires_on）。
 *  日本の今日より前は時刻で決まるので 409・E-CRED-004。通れば、行に入れる時刻（その日の日本の終わり）を返す。
 *  日本の今日はチケットの期限と同じ数え方（create-ticket の todayJst） */
export function parseExpiresOn(
  v: unknown,
  today: string = todayJst(),
  raw: unknown = v,
): { expiresAt: string | null } | HookReply {
  if (v === undefined || v === null) return { expiresAt: null };
  if (typeof raw !== "string" || !EXPIRES_RE_RAW.test(raw)) return invalid("expires_on", "年-月-日（暦に在る日）");
  const day = text(v);
  if (day < today) return conflict409("E-CRED-004");
  return { expiresAt: `${day} 23:59:59.999+09:00` };
}

/** 預ける中身（金庫に入れる物）。login・password・value は秘密なので、この形のまま金庫の関門にだけ渡す */
export type SecretContent =
  { kind: "login"; login: string; password: string; twoFactor: TwoFactor } | { kind: "key"; value: string };

/** ④⑤ 中身（mixed：預けた物の種類と合わない混ざりの答え。預ける口は 422・上書きの口は預けた物の状態で決まるので 409）：ログイン情報は ID とパスワード（と 2 段階の種類）、API キー・値は値だけ。欠け・種類の混ざりは 422・E-CRED-005（欄の名前つき）。
 *  input は入口が形を確かめた体、rawBody は入口が直す前の体（パスワードと値は打ったとおりに預ける）。
 *  認証アプリの鍵（totp_secret）の形と有無は vault.ts の parseTotpSecret が見る（ここでは鍵に付いていないことだけ） */
export function parseContent(
  kind: Kind,
  input: Record<string, unknown>,
  rawBody: Record<string, unknown>,
  mixed: (field: string) => HookReply = (field) => fail("E-CRED-005", field),
): SecretContent | HookReply {
  const has = (k: string): boolean => input[k] !== undefined;
  const asTyped = (k: string): string => {
    const v = typeof rawBody[k] === "string" ? rawBody[k] : input[k];
    return typeof v === "string" ? v : "";
  };
  if (kind === "key") {
    for (const k of ["login", "password", "two_factor", "totp_secret"]) if (has(k)) return mixed(k);
    const value = asTyped("value");
    if (value === "") return fail("E-CRED-005", "value");
    return { kind, value };
  }
  if (has("value")) return mixed("value");
  // ID は打ったとおりが契約と同じ pattern（空白だけでない）に合うこと。直した形を預ける
  const typedLogin = rawBody["login"] ?? input["login"];
  if (typeof typedLogin !== "string" || !LOGIN_RE_RAW.test(typedLogin)) return fail("E-CRED-005", "login");
  const login = text(input["login"]);
  if (login === "") return fail("E-CRED-005", "login");
  const password = asTyped("password");
  if (password === "") return fail("E-CRED-005", "password");
  const twoFactor = has("two_factor") ? oneOf(input["two_factor"], TWO_FACTORS) : "none";
  if (twoFactor === null) return invalid("two_factor", TWO_FACTORS.join("／"));
  return { kind, login, password, twoFactor };
}

/** ⑦ 層と種類：決まった値の外は 422（欄の名前つき） */
export function parseLayerKind(input: Record<string, unknown>): { layer: Layer; kind: Kind } | HookReply {
  const layer = oneOf(input["layer"], LAYERS);
  if (layer === null) return invalid("layer", LAYERS.join("／"));
  const kind = oneOf(input["kind"], KINDS);
  if (kind === null) return invalid("kind", KINDS.join("／"));
  return { layer, kind };
}
