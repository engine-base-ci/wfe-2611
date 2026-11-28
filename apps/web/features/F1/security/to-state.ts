// ログインと安全（K-318）：口 getMySecurity の答え → 部品（views.tsx）の値。
//   passkeys の各件は K-308 の形 { id, name, created_at, last_used_at, synced }（端末の列は無い）。行の絵は名前から決める。
//   2 行目の字は「M/D に作った ・ 最後に使った <今日 HH:MM | M/D | —>」（日本時間・ブラウザの時間帯に依らない）
import type { PasskeyItem, SecurityState } from "./views";

/** 口の答えの passkeys の 1 件（K-308） */
export interface PasskeyRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  synced: boolean;
}
/** getMySecurity の答え（契約の型は passkeys を unknown[] で持つので、ここで形を決める） */
export interface MySecurityAnswer {
  passkeys?: unknown[];
  has_password?: boolean;
  two_factor?: boolean;
  two_factor_required?: boolean;
  backup_codes_left?: number | null;
  mfa_pending?: boolean;
}

const JST_MS = 9 * 60 * 60 * 1000;
const PHONE = /iPhone|iPad|Android/i;

/** 日本時間の年・月・日・時・分 */
function jst(at: Date): { y: number; m: number; d: number; hh: string; mm: string } {
  const t = new Date(at.getTime() + JST_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: String(t.getUTCHours()).padStart(2, "0"),
    mm: String(t.getUTCMinutes()).padStart(2, "0"),
  };
}
const parse = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 「9/12 に作った ・ 最後に使った 今日 09:30」 */
export function detailOf(row: Pick<PasskeyRow, "created_at" | "last_used_at">, now: Date): string {
  const made = parse(row.created_at);
  const used = parse(row.last_used_at);
  const madeText = made ? `${jst(made).m}/${jst(made).d} に作った` : "作った日は分からない";
  let usedText = "—";
  if (used) {
    const u = jst(used);
    const n = jst(now);
    usedText = u.y === n.y && u.m === n.m && u.d === n.d ? `今日 ${u.hh}:${u.mm}` : `${u.m}/${u.d}`;
  }
  return `${madeText} ・ 最後に使った ${usedText}`;
}

const isRow = (v: unknown): v is PasskeyRow =>
  typeof v === "object" && v !== null && typeof (v as PasskeyRow).id === "string";

/** 答えの passkeys を形のそろった行にする（形の違う件は捨てる） */
export function passkeyRows(a: MySecurityAnswer): PasskeyRow[] {
  return (a.passkeys ?? []).filter(isRow).map((r) => ({
    id: r.id,
    name: typeof r.name === "string" ? r.name : "",
    created_at: r.created_at,
    last_used_at: r.last_used_at ?? null,
    synced: Boolean(r.synced),
  }));
}

export function toState(a: MySecurityAnswer, now: Date, passkeyUnsupported: boolean): SecurityState {
  const rows = passkeyRows(a);
  const passkeys: PasskeyItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    device: PHONE.test(r.name) ? "phone" : "laptop",
    detail: detailOf(r, now),
  }));
  return {
    passkeys,
    hasPassword: a.has_password === true,
    twoFactor: a.two_factor === true,
    backupLeft: a.backup_codes_left ?? null,
    via: passkeys.length > 0 ? "passkey" : "password",
    passkeyUnsupported,
  };
}

/** 外すと入り方が無くなるときの理由（正本の ID）。外せるなら null（K-309 の口と同じ振り分け） */
export function removeBlockOf(a: MySecurityAnswer): "E-AUTH-015" | "E-AUTH-016" | null {
  if (passkeyRows(a).length !== 1) return null;
  if (a.has_password !== true) return "E-AUTH-015";
  if (a.two_factor !== true) return "E-AUTH-016";
  return null;
}
