"use client";
// 設定の「プランと支払い」の 1 行と、プランを変える小窓（K-962・画面 company-settings・段 11 の設定の画面の差し込み口 planRow に置く）。
//   読む：listWorkspacePlans を 1 回（use-plans.ts）。見た目は K-943 の部品（views.tsx の PriceChange bare・PlanDialog・PlanConfirm・PlanBlocked）。
//   「このプランにする」：選べて上げられる → 上げる確かめ／選べて上げられない → 下げる確かめ／選べない → 下げられない（口を呼ばない）。
//   変える：changePlan を 1 回（送っている間は 2 回目を送らない）。200 → 小窓を全部閉じ、知らせ・読み直し 1 回。
//   403 STEP_UP_REQUIRED → getMySecurity を 1 回読み取り直しの小窓。通ったら同じプランで 1 回だけやり直す・やめたら何も送らない（K-363 と同じ形）。
//   409（人数が上限を超えた）→ 読み直し、選べなくなっていれば下げられない。ほかの失敗 → 確かめを閉じ、プランの小窓に alert（E-PAGE-003）。
//   listWorkspacePlans が 403 なら「プランを変える」「請求書」を押せない形（D-145.9・隠さない）
import { useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Callout, Loading, useNotify } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import { changeText, confirmView, nextBillText, planRowLine, planViews, type PlanIn, type PlanKey } from "./plan-shape";
import { PLAN_SCREEN, PlansReadError, usePlans, useReloadPlans, type PlansAnswer } from "./use-plans";
import { PlanBlocked, PlanConfirm, PlanDialog, PriceChange } from "./views";

const BILLING_HREF = "/billing";
const MEMBERS_HREF = "/members";
/** 取り直しの理由（代表の答え 2026-11-23・D-156.70 の案のまま） */
const STEP_UP_REASON = "プランを変える前に、本人か確かめます";
const DOWN = CATALOG[PAGE_ERROR.down]?.message ?? "";
const LOAD_FAILED = CATALOG[PAGE_ERROR.loadFailed]?.message ?? "";
/** 権限が無い・読めなかったときの 1 行（プランの字は出さない） */
const NO_LINE = "—";
const changedText = (name: string): string => `${name} に変えました`;

type View =
  { kind: "list"; alert?: string } | { kind: "confirm"; key: PlanKey } | { kind: "blocked"; key: PlanKey } | null;

export interface PlanRowProps {
  /** ワークスペースの名前（段 11 の getWorkspaceSettings の答えから・口を増やさない） */
  workspace: string;
}

export function PlanRow({ workspace }: PlanRowProps) {
  const q = usePlans();
  const reload = useReloadPlans();
  const notify = useNotify();
  const [view, setView] = useState<View>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const sending = useRef(false);
  const pendingKey = useRef<PlanKey | null>(null);

  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) {
    const forbidden = q.error instanceof PlansReadError && q.error.forbidden;
    return (
      <>
        {forbidden ? null : <Callout tone="danger">{LOAD_FAILED}</Callout>}
        <PriceChange bare line={NO_LINE} billingHref={BILLING_HREF} disabled />
      </>
    );
  }
  const data = q.data;
  const { plans, meta } = data;
  const planOf = (key: PlanKey, from: PlansAnswer = data): PlanIn | undefined =>
    from.plans.find((p) => p.plan_key === key);
  const row = planRowLine(plans, meta, Date.now());
  const current = plans.find((p) => p.current);
  const upcoming = current ? changeText(current) : null;

  const choose = (id: string) => {
    const p = planOf(id as PlanKey);
    if (!p || p.current) return;
    setView(p.can_choose ? { kind: "confirm", key: p.plan_key } : { kind: "blocked", key: p.plan_key });
  };

  const send = async (key: PlanKey, retried: boolean): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("changePlan", { body: { plan_key: key } as never, screenId: PLAN_SCREEN });
      if (r.ok) {
        setView(null);
        setStepUp(null);
        notify(changedText(planOf(key)?.name ?? ""));
        await reload();
        return;
      }
      if (r.kind === "step_up" && !retried) {
        setView(null);
        const s = await call("getMySecurity", { screenId: PLAN_SCREEN, keepOn401: true });
        const sec = s.ok ? s.data : {};
        pendingKey.current = key;
        setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
        return;
      }
      if (r.kind === "unauthenticated") return; // call が入り直しへ送る
      if (r.kind === "conflict") {
        const next = await reload();
        const p = next ? planOf(key, next) : undefined;
        setView(p && !p.can_choose ? { kind: "blocked", key } : { kind: "list", alert: DOWN });
        return;
      }
      setView({ kind: "list", alert: DOWN });
    } catch {
      setView({ kind: "list", alert: DOWN }); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const chosen = view && view.kind !== "list" ? planOf(view.key) : undefined;
  const confirm = view?.kind === "confirm" && chosen ? confirmView(chosen) : null;
  const backToList = () => setView({ kind: "list" });
  return (
    <>
      <PriceChange
        bare
        line={row.line}
        {...(upcoming ? { change: upcoming.change, noticeDate: upcoming.noticeDate } : {})}
        billingHref={BILLING_HREF}
        onChangePlan={() => setView({ kind: "list" })}
      />
      {view?.kind === "list" ? (
        <PlanDialog
          workspace={workspace}
          members={meta.members}
          plans={planViews(plans)}
          nextBill={nextBillText(Date.now())}
          billingHref={BILLING_HREF}
          onChoose={choose}
          onCancel={() => setView(null)}
          {...(view.alert ? { alert: view.alert } : {})}
        />
      ) : null}
      {confirm && view?.kind === "confirm" ? (
        <PlanConfirm
          {...(confirm.mode === "up"
            ? { plan: confirm.plan, days: confirm.days, amount: confirm.amount, due: confirm.due }
            : { plan: confirm.plan, mode: "down" as const, from: confirm.from })}
          busy={busy}
          onConfirm={() => void send(view.key, false)}
          onCancel={backToList}
        />
      ) : null}
      {view?.kind === "blocked" && chosen ? (
        <PlanBlocked
          plan={chosen.name}
          limit={chosen.member_limit}
          members={meta.members}
          membersHref={MEMBERS_HREF}
          onCancel={backToList}
        />
      ) : null}
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId={PLAN_SCREEN}
        onDone={() => {
          setStepUp(null);
          const key = pendingKey.current;
          pendingKey.current = null;
          if (key) void send(key, true);
        }}
        onCancel={() => {
          setStepUp(null);
          pendingKey.current = null;
        }}
      />
    </>
  );
}
