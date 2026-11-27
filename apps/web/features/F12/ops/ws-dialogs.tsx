"use client";
// 運営の 1 社の小窓と帯の入れ物（K-972）：中を見る・止める・再開・この 1 社にお知らせを送る。
//   見た目は K-941 の部品（tenant-dialogs.tsx・tenant-frame.tsx）。値と体は ws-dialogs-shape.ts。
//   書く口：openPeek・closePeek・stopWorkspace・resumeWorkspace・sendWorkspaceNotice（1 回の押しで 1 回・送っている間は 2 回目を送らない）。
//   403 STEP_UP_REQUIRED → getMySecurity を 1 回・本人確認の取り直し（StepUp）。通ったら同じ体で 1 回だけやり直す・やめたら何も送らない
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CATALOG } from "@kaname/errors/catalog";
import { Callout } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import { NoticeDialog, PeekBand, PeekDialog, StopDialog } from "./tenant-dialogs";
import type { TenantActs, TenantStopBand } from "./tenant-frame";
import {
  canStopNow,
  daysUntil,
  jstAfter,
  mdOf,
  noticeBody,
  peekBandView,
  peekBody,
  peekReasons,
  stopBandView,
  stopBody,
  stopDefault,
  stopDoneText,
  stopLabel,
  type NoticeTo,
  type PeekBandView,
  type StopForm,
  type WsInquiry,
  type WsLike,
} from "./ws-dialogs-shape";

const SCREEN = "ops-tenant";
const MINUTE_MS = 60_000;
/** 仮の字（下絵に足すかはまとめ役・K-972 の申し送り） */
const STEP_UP_REASON = {
  peek: "中を見る前に、本人か確かめます",
  stop: "止める前に、本人か確かめます",
  resume: "再開する前に、本人か確かめます",
} as const;
const SENT_TEXT = "送りました";

/** 1 社の答え（小窓と帯が読む欄と、対象の行の人数＝members.count・PC の数ではない） */
export type WsAnswer = WsLike & { id?: string; members?: { count?: number | null } | null };

const textOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 口が断った字：契約の字（errors）→ 口の字 → 「うまくいきませんでした」 */
const errText = (r: CallErr): string => textOf(r.code) || r.message || textOf(PAGE_ERROR.down);
const NET_FAIL = (): string => textOf(PAGE_ERROR.offline) || textOf(PAGE_ERROR.down);

type Kind = "peek" | "stop" | "notice";
interface PeekState {
  choice: string | null;
  minutes: number;
  other: string;
}
interface NoticeState {
  title: string;
  body: string;
  where: string;
  to: NoticeTo;
}
interface StepUpAsk {
  kind: "peek" | "stop" | "resume";
  withCode: boolean;
  withPasskey: boolean;
}
const PEEK_START: PeekState = { choice: null, minutes: 60, other: "" };
const NOTICE_START: NoticeState = { title: "", body: "", where: "band", to: "all" };

export interface WsDialogsArgs {
  id: string;
  ws: WsAnswer;
  caps: readonly string[];
  /** 1 社を読み直す */
  reload: () => void;
  /** 1 社を答えの 14 欄で置き換える */
  replace: (ws: WsAnswer) => void;
}
export interface WsDialogs {
  acts: TenantActs;
  stopBand: TenantStopBand | null;
  resuming: boolean;
  /** 頭の下の知らせ（「11/16 に止めます」「送りました」・再開の失敗） */
  notice: ReactNode;
  /** 見ている間の帯（外枠の帯の場所に出す）と、見ている間か */
  peekBand: ReactNode;
  peeking: boolean;
  /** 小窓と本人確認 */
  dialogs: ReactNode;
}

/** 1 分ごとに今を進める（見ている間の帯の残り） */
function useNow(on: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!on) return undefined;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/** その会社の済みでない問い合わせ（中を見るの理由の選び肢）。小窓を開いたときだけ読む */
function useInquiries(id: string, on: boolean) {
  return useQuery({
    queryKey: ["k971", "inquiries", id],
    queryFn: async (): Promise<WsInquiry[]> => {
      const r = await call("listOpsWorkspaceInquiries", { params: { id }, screenId: SCREEN });
      return r.ok ? (r.data as unknown as WsInquiry[]) : [];
    },
    enabled: on,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useWsDialogs({ id, ws, caps, reload, replace }: WsDialogsArgs): WsDialogs {
  const [open, setOpen] = useState<Kind | null>(null);
  const [peek, setPeek] = useState<PeekState>(PEEK_START);
  const [stop, setStop] = useState<StopForm>(() => stopDefault(new Date()));
  const [notice, setNotice] = useState<NoticeState>(NOTICE_START);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Kind | "resume" | "close" | null>(null);
  const [said, setSaid] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [stepUp, setStepUp] = useState<StepUpAsk | null>(null);
  const [reasonOf, setReasonOf] = useState<Record<string, string>>({});
  const sending = useRef(false);

  const has = (c: string) => caps.includes(c);
  const inquiries = useInquiries(id, open === "peek" && has("inquiry"));
  const reasons = peekReasons(inquiries.data ?? []);
  const choice = peek.choice ?? reasons[0]?.value ?? "incident";

  const now = useNow(Boolean(ws.peek));
  const bandRaw = peekBandView(ws, now);
  const band: PeekBandView | null =
    bandRaw && !bandRaw.reason && reasonOf[bandRaw.id] ? { ...bandRaw, reason: reasonOf[bandRaw.id]! } : bandRaw;
  // 期限を過ぎたら 1 社を 1 回読み直す（帯が消える）
  const expired = Boolean(ws.peek) && bandRaw === null;
  useEffect(() => {
    if (expired) reload();
  }, [expired, reload]);

  const stopBand = stopBandView(ws);
  const today = new Date();

  const begin = (k: Kind) => {
    setSaid(null);
    setError(null);
    if (k === "peek") setPeek(PEEK_START);
    if (k === "stop") setStop(stopDefault(new Date()));
    if (k === "notice") setNotice(NOTICE_START);
    setOpen(k);
  };
  const close = () => {
    if (sending.current) return;
    setOpen(null);
    setError(null);
  };

  /** 書く口を 1 回。true＝通った・false＝断った（字は出した）・"step"＝取り直しへ */
  async function send(
    kind: Kind | "resume" | "close",
    run: () => Promise<{ ok: true; data: unknown } | CallErr>,
    done: (data: unknown) => void,
    fail: (r: CallErr) => void,
    retry: boolean,
  ): Promise<void> {
    if (sending.current) return;
    sending.current = true;
    setBusy(kind);
    setError(null);
    try {
      const r = await run();
      if (r.ok) return done(r.data);
      if (r.kind === "step_up" && (kind === "peek" || kind === "stop" || kind === "resume") && !retry) {
        const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
        const sec: { two_factor?: boolean | null; has_password?: boolean | null } = s.ok ? s.data : {};
        setStepUp({ kind, withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
        return;
      }
      if (r.kind === "unauthenticated") return; // call が入り直しへ送る
      fail(r);
    } catch {
      fail({
        ok: false,
        status: 0,
        kind: "failed",
        code: PAGE_ERROR.offline,
        message: NET_FAIL(),
        fields: {},
        retryAfterSec: null,
        body: {},
      });
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  const submitPeek = (retry = false) => {
    const body = peekBody({ ...peek, choice }, inquiries.data ?? []);
    if (!body) return;
    void send(
      "peek",
      () => call("openPeek", { params: { id }, body: body as never, screenId: SCREEN }),
      (data) => {
        const pid = (data as { id?: unknown } | null)?.id;
        if (typeof pid === "string") setReasonOf((m) => ({ ...m, [pid]: body.reason }));
        setOpen(null);
        reload();
      },
      (r) => setError(errText(r)),
      retry,
    );
  };
  const closePeek = () => {
    const pid = ws.peek?.id;
    if (!pid) return;
    void send(
      "close",
      () => call("closePeek", { params: { id: pid }, screenId: SCREEN }),
      () => reload(),
      (r) => {
        if (r.code !== "E-OPS-002") setSaid({ tone: "danger", text: errText(r) });
        reload();
      },
      false,
    );
  };
  const submitStop = (retry = false) => {
    const body = stopBody(stop);
    if (!body) return;
    const form = stop;
    void send(
      "stop",
      () => call("stopWorkspace", { params: { id }, body: body as never, screenId: SCREEN }),
      (data) => {
        setOpen(null);
        replace(data as WsAnswer);
        const text = stopDoneText(form);
        if (text) setSaid({ tone: "info", text });
      },
      (r) => setError(errText(r)),
      retry,
    );
  };
  const resume = (retry = false) => {
    setSaid(null);
    void send(
      "resume",
      () => call("resumeWorkspace", { params: { id }, body: {} as never, screenId: SCREEN }),
      (data) => replace(data as WsAnswer),
      (r) => {
        if (r.code !== "E-OPS-004") setSaid({ tone: "danger", text: errText(r) });
        reload();
      },
      retry,
    );
  };
  const submitNotice = () => {
    const body = noticeBody(notice);
    if (!body) return;
    void send(
      "notice",
      () => call("sendWorkspaceNotice", { params: { id }, body: body as never, screenId: SCREEN }),
      () => {
        setOpen(null);
        setSaid({ tone: "info", text: SENT_TEXT });
      },
      (r) => setError(errText(r)),
      false,
    );
  };
  const again = (k: StepUpAsk["kind"]) => {
    setStepUp(null);
    if (k === "peek") submitPeek(true);
    else if (k === "stop") submitStop(true);
    else resume(true);
  };

  // 対象の字は「<会社> ・ <members.count> 人」（人数は会社の生きているメンバーの数・PC の数ではない・PM の決め 2026-11-25）
  const count = ws.members?.count;
  const target = typeof count === "number" ? `${ws.name} ・ ${count} 人` : ws.name;
  const tomorrow = jstAfter(today, 1);
  const days = daysUntil(today, stop.stopOn);
  const hidden = stepUp !== null; // 取り直しの間は小窓を下げる（値は残す）
  const dialogs = (
    <>
      {open === "peek" && !hidden ? (
        <PeekDialog
          onClose={close}
          target={target}
          reasons={reasons}
          value={{ choice, minutes: peek.minutes, other: peek.other }}
          onChange={(v) => setPeek({ choice: v.choice, minutes: v.minutes, other: v.other })}
          onSubmit={() => submitPeek()}
          busy={busy === "peek"}
          error={error}
        />
      ) : null}
      {open === "stop" && !hidden ? (
        <StopDialog
          onClose={close}
          target={target}
          value={stop}
          onChange={(v) => setStop(v.mode === "now" && !canStopNow(v.reason) ? { ...v, mode: "scheduled" } : v)}
          onSubmit={() => submitStop()}
          submitLabel={stopLabel(stop)}
          laterDesc={`管理者にお知らせが出る ・ 止める日 ${/^\d{4}-\d{2}-\d{2}$/.test(stop.stopOn) ? `${mdOf(stop.stopOn)}（${days} 日後）` : "—"}`}
          canNow={canStopNow(stop.reason)}
          minDate={tomorrow}
          ready={stopBody(stop) !== null}
          busy={busy === "stop"}
          error={error}
        />
      ) : null}
      {open === "notice" ? (
        <NoticeDialog
          onClose={close}
          target={target}
          value={notice}
          onChange={(v) => setNotice(v.to === "admins" && notice.to !== "admins" ? { ...v, where: "list" } : v)}
          onSubmit={submitNotice}
          ready={noticeBody(notice) !== null}
          busy={busy === "notice"}
          error={error}
        />
      ) : null}
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON[stepUp?.kind ?? "stop"]}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId={SCREEN}
        onDone={() => stepUp && again(stepUp.kind)}
        onCancel={() => setStepUp(null)}
      />
    </>
  );

  return {
    acts: {
      onNotice: () => begin("notice"),
      onPeek: () => begin("peek"),
      onStop: () => begin("stop"),
      onResume: () => resume(),
      canNotice: has("notice"),
      canPeek: has("peek"),
      canStop: has("stop"),
    },
    stopBand,
    resuming: busy === "resume",
    notice: said ? <Callout tone={said.tone}>{said.text}</Callout> : null,
    peekBand: band ? (
      <PeekBand
        title={band.title}
        rest={band.rest}
        reason={band.reason ?? null}
        onClose={closePeek}
        busy={busy === "close"}
      />
    ) : null,
    peeking: band !== null,
    dialogs,
  };
}

/** 外枠の帯の場所（.k-op-banner・頭の帯の上）に出す。外枠が見つからなければその場に出す */
export function ShellBanner({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const body = document.querySelector<HTMLElement>(".k-op-shell-body");
    if (!body) {
      setReady(true);
      return undefined;
    }
    const el = document.createElement("div");
    el.className = "k-op-banner";
    body.insertBefore(el, body.querySelector(":scope > .k-bar"));
    setSlot(el);
    setReady(true);
    return () => {
      el.remove();
      setSlot(null);
    };
  }, []);
  if (!ready) return null;
  return slot ? createPortal(children, slot) : <>{children}</>;
}
