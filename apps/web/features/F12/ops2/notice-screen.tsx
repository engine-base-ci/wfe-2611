"use client";
// 運営のお知らせの 1 件の画面（/ops/notices/[id]・K-980）。外枠の答え（caps）と 1 件の口を読み → 部品に値と押したときの関数を渡す。
//   障害は［足して出す］［直ったにする］で続報の口を 1 回呼び、1 件と一覧を読み直す。直った後は押せない形（隠さない・D-145.9）。
//   読めなければ E-PAGE-007・無ければ E-PAGE-001。続報の失敗は正本の字の赤い箱で、書いた続報は残す
import { useState } from "react";
import { ErrorState, NoAccess } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import type { CallErrorKind } from "@/lib/api/call";
import { capsOf, feedOf, headSub, noticeDetailOf, placeView, stepsOf, updateBody } from "./notices-shape";
import { NOTICES_HOME, NoticeBodyState, useOpsRelogin } from "./notices-screen";
import { shellDataOf, useAddIncidentUpdate, useOpsNotice, useOpsShellOnce } from "./use-ops-notices";
import { NoticePage, type NoticeErrorView } from "./views-notices";

const RESOLVED_BODY = "直りました"; // ［直ったにする］で足す続報の本文（下絵に本文の欄が無い・D-156.70）
const DEFAULT_STEP = "様子を見ている";

const kindOfStatus = (status: number): CallErrorKind =>
  status === 404 ? "not_found" : status === 403 ? "forbidden" : status === 409 ? "conflict" : "failed";

/** 続報の失敗 → 正本の字（正本に無い ID は共通の 1 件） */
function errorView(status: number, code: string): NoticeErrorView {
  const c = status === 0 ? PAGE_ERROR.loadFailed : errorCodeOf({ kind: kindOfStatus(status), code, status });
  const t = errorText(c);
  return { title: t.title, body: t.body };
}

export function NoticeScreen({ id }: { id: string }) {
  const shell = useOpsShellOnce();
  const shellData = shellDataOf(shell.data);
  const allowed = capsOf(shellData).includes("notice");
  const one = useOpsNotice(id, allowed);
  const add = useAddIncidentUpdate(id);
  const [step, setStep] = useState(DEFAULT_STEP);
  const [body, setBody] = useState("");
  const [error, setError] = useState<NoticeErrorView | null>(null);
  const relogin = one.data?.kind === "login" || add.data?.kind === "login";
  useOpsRelogin(relogin);

  if (shell.isPending || relogin) return null;
  if (shell.data?.kind === "login" || shell.data?.kind === "setup") return null; // 入れ物（K-946）が移す
  if (shellData === undefined)
    return (
      <NoticeBodyState title="お知らせ">
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void shell.refetch()]} />
      </NoticeBodyState>
    );
  if (!allowed)
    return (
      <NoticeBodyState title="お知らせ">
        <NoAccess />
      </NoticeBodyState>
    );
  if (one.isPending) return null;
  const r = one.data;
  if (r?.kind === "failed" && r.status === 404)
    return (
      <NoticeBodyState title="お知らせ">
        <ErrorState code={PAGE_ERROR.notFound} acts={[NOTICES_HOME]} />
      </NoticeBodyState>
    );
  const d = r?.kind === "ok" ? noticeDetailOf(r.data) : null;
  if (!d)
    return (
      <NoticeBodyState title="お知らせ">
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void one.refetch()]} />
      </NoticeBodyState>
    );

  const locked = d.state === "resolved" || d.incident_state === "resolved";
  const send = async (payload: { state: string; body: string }, clear: boolean) => {
    if (add.isPending || locked) return; // 送っている間・直った後は送らない
    setError(null);
    const res = await add.mutateAsync(payload).catch(() => ({ kind: "failed" as const, status: 0, code: "" }));
    if (res.kind === "ok") {
      if (clear) setBody("");
      return;
    }
    if (res.kind === "failed") setError(errorView(res.status, res.code));
  };
  const onAdd = () => {
    const payload = updateBody({ step, body });
    if (payload) void send(payload, true);
  };
  const onResolve = () => void send({ state: "resolved", body: RESOLVED_BODY }, false);

  return (
    <NoticePage
      detail={{
        title: d.title,
        sub: headSub(d),
        steps: stepsOf(d),
        feed: feedOf(d.updates),
        body: d.body,
        impact: d.impact,
        place: placeView(d),
      }}
      step={step}
      onStep={setStep}
      body={body}
      onBody={setBody}
      onAdd={onAdd}
      onResolve={onResolve}
      locked={locked}
      busy={add.isPending}
      error={error}
      editHref={`${NOTICES_HOME}/${encodeURIComponent(d.id)}/edit`}
    />
  );
}
