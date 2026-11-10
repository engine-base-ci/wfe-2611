// PC をつなぐ（K-57）の小さな決まり：接続コード・PC の印・PC の名前。乱数とハッシュは node:crypto（D-128.137）
import { createHash, randomBytes, randomInt } from "node:crypto";
import { isUuid } from "@kaname/contracts";

/** 見分けにくい字（0・O・1・I・L）を除いた英数字（D-128.137） */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LEN = 6;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`);
/** 入れた文字の上限（これより長いものは形を見るまでもなく止める） */
export const CODE_INPUT_MAX = 32;
export const LABEL_MAX = 80;
export const LABEL_DEFAULT = "この PC";

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** 接続コードを 1 つ作る（6 けた・31 字の中から一様に） */
export function newCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** PC の印（"kpc_" ＋ 乱数 32 バイト）。引き取りのときに 1 回だけ返し、DB にはハッシュだけ残す */
export const newDeviceToken = (): string => `kpc_${randomBytes(32).toString("base64url")}`;

export type CodeCheck = { ok: true; code: string } | { ok: false; message: string };
/** 表記ゆらぎ（全角半角・大文字小文字・前後と途中の空白・区切りの「-」）を揃えてから形を見る（サーバーが最後の砦） */
export function normalizeCode(raw: unknown): CodeCheck {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: false, message: "接続コードを入れてください" };
  if ([...raw].length > CODE_INPUT_MAX) return { ok: false, message: "接続コードが長すぎます（英数字 6 けた）" };
  const code = raw
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\-‐‑‒–—―ー−]/g, "");
  if (!CODE_RE.test(code)) return { ok: false, message: "接続コードは英数字 6 けたです" };
  return { ok: true, code };
}

/** PC の名前：制御文字は消し、80 文字で切り、空なら「この PC」 */
export function cleanLabel(raw: unknown): string {
  if (typeof raw !== "string") return LABEL_DEFAULT;
  const s = [...raw.replace(/\p{Cc}/gu, "").trim()].slice(0, LABEL_MAX).join("").trim();
  return s || LABEL_DEFAULT;
}

/** この PC の印（machine_id・D-128.174）。Bridge が入れたときに PC の中で作る UUID。送らない古い Bridge は null（何も切らない）。
 *  大文字は小文字にそろえる（表記ゆらぎ）。UUID の形でなければ止める */
/** 正式な uuid の形（契約の入口と同じ isUuid＝z.uuid()・版と variant の桁まで見る・K-145） */
const MACHINE_ID_RE = { test: (v: string): boolean => isUuid(v) };
export type MachineCheck = { ok: true; machineId: string | null } | { ok: false; message: string };
export function normalizeMachineId(raw: unknown): MachineCheck {
  if (raw === undefined || raw === null) return { ok: true, machineId: null };
  if (typeof raw !== "string") return { ok: false, message: "この PC の印の形が違います" };
  const v = raw.trim().toLowerCase();
  if (!MACHINE_ID_RE.test(v)) return { ok: false, message: "この PC の印の形が違います" };
  return { ok: true, machineId: v };
}
