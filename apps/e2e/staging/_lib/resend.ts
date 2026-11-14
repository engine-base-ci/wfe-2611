// Resend の送った記録を読む（K-65・D-140.1）：staging は本物のメールを Resend から送る。試験は受け箱を持たず、Resend の記録（届いたか・本文）を読む。
//   読むだけ（GET）。送らない・消さない。鍵は環境の値の名前で受け、投げる文には口の番号だけを書く（宛先・本文・リンクは書かない）。
//   探したもの：apps/web/tests/_lib/mailbox.ts（自分の台の中でだけ聞く受け箱。staging の口からは届かない）・packages/notify/src/resend.ts（送る側だけ）。読む道具は無かった。
//   口の形は Resend の公開の API（送った一覧 GET /emails・1 通 GET /emails/{id}）。形が違っていたら、直すのはこの道具（試験は変えない）
import { resendKey } from "./site";

const BASE = "https://api.resend.com";
const TIMEOUT_MS = 15_000;
/** 一覧で読む数（新しい順）。1 回の通しで送るのは 9 通前後 */
const LIST_LIMIT = 100;

export interface MailRecord {
  id: string;
  from: string;
  to: string[];
  replyTo: string[];
  subject: string;
  /** 最後の出来事（sent・delivered・bounced …） */
  lastEvent: string | null;
  text: string;
  html: string;
}
type Raw = Record<string, unknown>;

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];
const str = (v: unknown): string => (typeof v === "string" ? v : "");

async function get(path: string): Promise<Raw> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        authorization: `Bearer ${resendKey()}`,
        accept: "application/json",
        "user-agent": "kaname-staging-e2e",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error("Resend の記録の口に届かない");
  }
  if (!res.ok) throw new Error(`Resend の記録の口が ${res.status}`);
  return (await res.json()) as Raw;
}

/** その宛先に送った新しいほうの 1 通（id と最後の出来事）。まだ記録に無ければ null */
export async function latestTo(to: string): Promise<{ id: string; lastEvent: string | null } | null> {
  const body = await get(`/emails?limit=${LIST_LIMIT}`);
  const rows = Array.isArray(body["data"]) ? (body["data"] as Raw[]) : [];
  const hit = rows.find((r) => list(r["to"]).some((a) => a.toLowerCase() === to.toLowerCase()));
  return hit ? { id: str(hit["id"]), lastEvent: str(hit["last_event"]) || null } : null;
}
/** その宛先に送った通数（二重に送っていないかを見る） */
export async function countTo(to: string): Promise<number> {
  const body = await get(`/emails?limit=${LIST_LIMIT}`);
  const rows = Array.isArray(body["data"]) ? (body["data"] as Raw[]) : [];
  return rows.filter((r) => list(r["to"]).some((a) => a.toLowerCase() === to.toLowerCase())).length;
}
/** 最後の出来事だけ（expect.poll で待つ用）。記録にまだ無ければ "まだ無い" */
export async function eventOf(to: string): Promise<string> {
  return (await latestTo(to))?.lastEvent ?? "まだ無い";
}

/** 1 通を読む（差出人・返信先・件名・本文） */
export async function readMail(id: string): Promise<MailRecord> {
  const r = await get(`/emails/${encodeURIComponent(id)}`);
  return {
    id: str(r["id"]),
    from: str(r["from"]),
    to: list(r["to"]),
    replyTo: list(r["reply_to"]),
    subject: str(r["subject"]),
    lastEvent: str(r["last_event"]) || null,
    text: str(r["text"]),
    html: str(r["html"]),
  };
}

/** 本文の中の確認のリンク（/verify-email?token=…）。無ければ null */
export function verifyLink(m: Pick<MailRecord, "text" | "html">): string | null {
  const hit = /https?:\/\/[^\s"'<>]+\/verify-email\?token=[^\s"'<>&]+/.exec(`${m.text}\n${m.html}`);
  return hit ? hit[0] : null;
}
