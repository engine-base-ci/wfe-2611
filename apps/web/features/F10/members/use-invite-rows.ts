"use client";
// 招待中の行の「送り直す」「取り消す」を口につなぐ（K-809・D-154.12・D-154.35）。
//   送り直す＝resendInvitation（POST /invitations/<id>/resend・体なし）・取り消す＝revokeInvitation（DELETE /invitations/<id>）。どちらも口の持ち主は K-807。
//   結果の出し分けは答えの code と mail だけで決める：上の箱（Callout）・行の「送り直しました」・知らせ・並びの読み直し。
//   答えを待つ間は同じ操作を 2 回送らない（useRef）。「知らせる」（催促）は作らない（D-154.1）
import { useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { useNotify, type CalloutTone } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";

const SCREEN = "members";
const msgOf = (code: string): string => CATALOG[code]?.message ?? "";

/** 別のタブで状態が変わった招待（もう入った・取り消した・もう無い）：並びを読み直す */
const GONE = new Set(["E-INV-016", "E-INV-017", "E-INV-018"]);
/** 同じ招待は 1 日 1 回まで（D-154.12） */
const ONCE_A_DAY = "E-INV-019";

/** 「次に送れる時刻」を日本時間の MM/DD HH:mm に（字は仮・D-154.12 に字が無い） */
const JST = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function jstShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(JST.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p["month"]}/${p["day"]} ${p["hour"]}:${p["minute"]}`;
}

export interface InviteNotice {
  tone: CalloutTone;
  text: string;
}

/** 断られたときの正本の文（401 はログイン切れ・正本・口の文の順） */
function refusedText(r: CallErr): string {
  if (r.status === 401) return msgOf(PAGE_ERROR.sessionExpired);
  return msgOf(r.code) || r.message || msgOf(errorCodeOf(r));
}

function onceADayText(email: string, r: CallErr): string {
  const detail = r.body["detail"] as Record<string, unknown> | undefined;
  const next = typeof detail?.["次に送れる時刻"] === "string" ? jstShort(detail["次に送れる時刻"]) : "";
  return next
    ? `${email} へは 1 日に 1 回までです。次に送れるのは ${next} 以降です`
    : `${email} へは 1 日に 1 回までです`;
}

/** 取り消す前の確かめの中身 */
export interface RevokeAsk {
  id: string;
  email: string;
}

export function useInviteRows({ reload }: { reload: () => void }) {
  const notify = useNotify();
  const [notice, setNotice] = useState<InviteNotice | null>(null);
  const [resentIds, setResentIds] = useState<readonly string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ask, setAsk] = useState<RevokeAsk | null>(null);
  const [revoking, setRevoking] = useState(false);
  const sending = useRef(false);

  /** 口が断ったとき：別のタブで変わった招待は並びも読み直す（403・503 は行を前のまま） */
  const refused = (r: CallErr) => {
    setNotice({ tone: "danger", text: refusedText(r) });
    if (GONE.has(r.code)) reload();
  };

  const resend = async (id: string, email: string): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    setBusyId(id);
    setNotice(null);
    try {
      const r = await call("resendInvitation", { params: { id }, screenId: SCREEN });
      if (r.ok) {
        const mail = (r.data as unknown as { mail?: string }).mail;
        if (mail === "failed") {
          // 口は 1 日 1 回に数えない：行は「送り直しました」にしない・もう一度押せる
          setNotice({ tone: "warn", text: `${email} には送れませんでした。もう一度送り直せます` });
          return;
        }
        setNotice({ tone: "info", text: `${email} に招待を送り直しました。7 日のあいだ入れます` });
        setResentIds((xs) => (xs.includes(id) ? xs : [...xs, id]));
        reload();
        return;
      }
      if (r.code === ONCE_A_DAY) return setNotice({ tone: "warn", text: onceADayText(email, r) });
      refused(r);
    } catch {
      setNotice({ tone: "danger", text: msgOf(PAGE_ERROR.offline) });
    } finally {
      sending.current = false;
      setBusyId(null);
    }
  };

  const askRevoke = (id: string, email: string) => {
    if (sending.current) return;
    setAsk({ id, email });
  };
  const cancelRevoke = () => {
    if (sending.current) return;
    setAsk(null);
  };

  const revoke = async (): Promise<void> => {
    const target = ask;
    if (!target || sending.current) return;
    sending.current = true;
    setRevoking(true);
    setNotice(null);
    try {
      const r = await call("revokeInvitation", { params: { id: target.id }, screenId: SCREEN });
      if (r.ok) {
        notify(`${target.email} への招待を取り消しました`);
        reload();
        return;
      }
      refused(r);
    } catch {
      setNotice({ tone: "danger", text: msgOf(PAGE_ERROR.offline) });
    } finally {
      sending.current = false;
      setRevoking(false);
      setAsk(null);
    }
  };

  return { notice, resentIds, busyId, ask, revoking, resend, askRevoke, cancelRevoke, revoke };
}
