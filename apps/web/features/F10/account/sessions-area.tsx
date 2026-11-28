"use client";
// ログインと安全の「入っている端末」「最近の安全の記録」の 2 区画（K-842・行為 A74）。K-318 の SecurityBody の差し込み口 sessionCards に入る。
//   見た目は下絵 me-sessions・me-session-revoke と同じ部品（login.tsx の DevicesCard・EventsCard・確かめは Confirm）。
//   切る 2 口は本人確認を取り直す（D-154.52）：403 STEP_UP_REQUIRED → StepUp → 通ったら同じ口を 1 回だけやり直す。
//   記録の画面へのリンクは置かない（D-154.2）。読めないときは「入っている端末」の区画だけに調子が悪い形と「もう一度読む」
import { useRef, useState } from "react";
import { Button, Confirm, ErrorState, Loading, useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { msgOf, toLogin } from "@/features/F1/security/common";
import { StepUp } from "@/features/F1/security/step-up";
import { DevicesCard, EventsCard } from "./login";
import { EVENTS_EMPTY, revokedText, revokeTexts, toDevices, toEvents, type SessionItem } from "./sessions-shape";
import {
  revokeOne,
  revokeOthers,
  SESSIONS_SCREEN,
  useReloadSessions,
  useSessions,
  type RevokeResult,
} from "./use-sessions";

type Target = SessionItem | "all";
const STEP_UP_REASON = "端末を切る前に、本人か確かめます";
const RETRY = "もう一度読む";

export interface SessionsAreaProps {
  /** 2 段階を付けている（取り直しで 6 けたも打つ） */
  twoFactor: boolean;
  /** パスワードがある（無ければ取り直しはパスキー） */
  hasPassword: boolean;
}

/** 断りの文（小窓の中に出す） */
function failText(r: RevokeResult): string {
  if (r.kind === "down" || r.kind === "offline") return msgOf(PAGE_ERROR.down);
  if (r.kind === "step_up") return r.err.message ?? msgOf(errorCodeOf(r.err));
  if (r.kind === "conflict" || r.kind === "failed")
    return msgOf(errorCodeOf(r.err)) || r.err.message || msgOf(PAGE_ERROR.down);
  return msgOf(PAGE_ERROR.down);
}

export function SessionsArea({ twoFactor, hasPassword }: SessionsAreaProps) {
  const q = useSessions();
  const reload = useReloadSessions();
  const notify = useNotify();
  const [target, setTarget] = useState<Target | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Target | null>(null);
  const sending = useRef(false);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef(false);

  const sessions = q.data?.sessions ?? [];
  const others = sessions.filter((s) => !s.current).length;

  const open = (id: string | "all") => {
    if (id === "all" && others === 0) return;
    const t = id === "all" ? "all" : sessions.find((s) => s.id === id);
    if (!t) return;
    setFailed(null);
    setTarget(t);
  };

  const run = async (t: Target, retried: boolean) => {
    if (!retried && needStepUp.current) {
      setTarget(null);
      return setPending(t);
    }
    const r = t === "all" ? await revokeOthers(others) : await revokeOne(t.id);
    needStepUp.current = r.kind === "step_up" && !retried;
    if (r.kind === "ok") {
      setTarget(null);
      notify(revokedText(t, r.revoked));
      return void reload();
    }
    if (r.kind === "step_up" && !retried) {
      setTarget(null);
      return setPending(t);
    }
    if (r.kind === "unauthenticated") return toLogin();
    if (r.kind === "not_found") {
      setTarget(null);
      void reload();
      return void notify(msgOf(PAGE_ERROR.notFound));
    }
    setTarget(t);
    // 取り直しのあとも 403：繰り返さず、口の文を出す
    setFailed(failText(r));
  };
  const guarded = async (t: Target, retried: boolean) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await run(t, retried);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (q.isPending) return <Loading />;
  if (!q.data) {
    const err = q.error?.err ?? null;
    return (
      <DevicesCard
        devices={[]}
        allDisabled
        notice={
          <>
            <ErrorState code={err && err.status !== 503 ? errorCodeOf(err) : PAGE_ERROR.down} />
            <div className="k-state-actions">
              <Button variant="primary" loading={q.isFetching} onClick={() => void q.refetch()}>
                {RETRY}
              </Button>
            </div>
          </>
        }
      />
    );
  }

  const answer = q.data;
  const now = Date.now();
  const texts = target ? revokeTexts(target, sessions) : null;
  return (
    <>
      <DevicesCard devices={toDevices(answer, now)} allDisabled={others === 0} onRevoke={open} />
      <EventsCard events={toEvents(answer, now)} empty={EVENTS_EMPTY} />
      <Confirm
        open={target !== null}
        title={texts?.title ?? ""}
        description={texts?.description}
        confirmLabel="本人確認して切る"
        caution={failed ? [failed] : undefined}
        busy={busy}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
        onConfirm={() => {
          if (target) void guarded(target, false);
        }}
      />
      <StepUp
        open={pending !== null}
        reason={STEP_UP_REASON}
        withCode={twoFactor}
        withPasskey={!hasPassword}
        screenId={SESSIONS_SCREEN}
        onDone={() => {
          const t = pending;
          setPending(null);
          if (t) void guarded(t, true);
        }}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
