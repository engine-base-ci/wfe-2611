"use client";
// 配るもの › プラン › 案（/ops/skills/plans/new?plan=<key>・/ops/skills/plans/proposals/<id>・K-991）。
//   新しい案・下書き・差し戻された案（作った本人）は「作る形」（PlanEditPage）、待っている・決めた案は「決める人の形」（PlanReviewPage）。
//   1 件の案は listPlanProposals から id で拾う（無ければ「見つかりませんでした」）。影響は案ができてから getPlanProposalImpact。
//   決めるは本人確認の取り直しが要る：口が 403 STEP_UP_REQUIRED → getMySecurity を 1 回読み StepUp → 通ったら同じ体で 1 回だけやり直す。
//   自分の案（作った本人で can_decide が偽）は帯と押せない形（口を呼ばない）。口の 409 E-OPS-022 も同じ帯。送っている間は 2 回目を送らない
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, Dialog, TextArea } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import {
  decideSteps,
  defaultNotice,
  familyName,
  impactView,
  reviewFacts,
  reviewHead,
  type PlanImpact,
  type PlanOps,
  type PlanProposal,
} from "./plans-shape";
import { PLANS_PATH, PlansFallback, openProposals, plansHrefs, proposalPath, useRelogin } from "./plans-screen";
import {
  PLANS_KEY,
  PROPOSALS_KEY,
  createProposal,
  decideProposal,
  impactKey,
  returnProposal,
  setFlash,
  stepUpShape,
  submitProposal,
  updateProposal,
  useMe,
  useOpsPlans,
  usePlanImpact,
  usePlanProposals,
  type ProposalInput,
  type Read,
} from "./use-ops-plans";
import { PlanEditPage, PlanReviewPage, type ImpactData, type PlanEditForm } from "./views-plans";

const STEP_UP_REASON = "値段を決める前に、本人か確かめます"; // （仮）
const DECIDED = "決めました"; // （仮）
const RETURNED = "差し戻しました"; // （仮）
const IMPACT_FAILED = "影響を読めませんでした"; // （仮）
const SHORT_NOTICE = "30 日より短くはできません";
const SELF_REFUSED = "E-OPS-022";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";
const failText = (r: CallErr): string =>
  textOf(r.code) || r.message || textOf(errorCodeOf(r)) || textOf(PAGE_ERROR.loadFailed);

type Res = { ok: true; data: unknown } | CallErr;
type Shape = { withCode: boolean; withPasskey: boolean };

/** 書く口を呼ぶ。取り直しが要れば 1 回だけ取り直してから同じ体でやり直す。送っている間は 2 回目を送らない */
function useWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<Shape | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const sending = useRef(false);

  const step = async (job: () => Promise<Res>, done: (r: Res) => Promise<void> | void, retried: boolean) => {
    const r = await job();
    if (!r.ok && r.kind === "step_up" && !retried) {
      pending.current = () => send(job, done, true);
      setStepUp(await stepUpShape());
      return;
    }
    if (!r.ok && r.status === 401) {
      router.replace(`/ops/login?next=${encodeURIComponent(pathname)}` as Route);
      return;
    }
    await done(r);
  };
  const send = async (job: () => Promise<Res>, done: (r: Res) => Promise<void> | void, retried = false) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setOffline(null);
    try {
      await step(job, done, retried);
    } catch {
      setOffline(textOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const node = (
    <StepUp
      open={stepUp !== null}
      reason={STEP_UP_REASON}
      withCode={stepUp?.withCode ?? false}
      withPasskey={stepUp?.withPasskey ?? false}
      screenId="ops-skills"
      onDone={() => {
        setStepUp(null);
        const again = pending.current;
        pending.current = null;
        if (again) void again();
      }}
      onCancel={() => {
        setStepUp(null);
        pending.current = null; // やめた：何も送らない
      }}
    />
  );
  return { send, busy, offline, stepUpNode: node };
}

const num = (s: string): number => Number(s.trim());
/** 作る形の値 → 口の体（無料期間は今の版と違うときだけ） */
function bodyOf(f: PlanEditForm, planTrial: number): ProposalInput {
  return {
    price_monthly: num(f.price),
    member_limit: num(f.members),
    existing_policy: f.policy,
    ...(f.policy === "after_days" ? { notice_days: num(f.days) } : {}),
    new_from: f.newcomer === "date" && f.newFrom ? f.newFrom : null,
    ...(num(f.trial) !== planTrial ? { trial_days: num(f.trial) } : {}),
    reason: f.reason.trim(),
  };
}
/** 直すときは変えた欄だけ */
function changedOf(now: ProposalInput, before: ProposalInput): ProposalInput {
  const keys = new Set([...Object.keys(now), ...Object.keys(before)]) as Set<keyof ProposalInput>;
  return Object.fromEntries(
    [...keys].filter((k) => k in now && JSON.stringify(now[k]) !== JSON.stringify(before[k])).map((k) => [k, now[k]]),
  ) as ProposalInput;
}
const FIELD_OF: Record<string, keyof NonNullable<Parameters<typeof PlanEditPage>[0]["errors"]>> = {
  price_monthly: "price",
  member_limit: "members",
  trial_days: "trial",
  notice_days: "days",
  reason: "reason",
  new_from: "newFrom",
};
/** 422 の項目ごとの理由（口は detail.field か field で返す） */
function fieldErrors(r: CallErr, f: PlanEditForm): Partial<Record<string, string>> {
  const top = typeof r.body["field"] === "string" ? { [r.body["field"]]: "" } : {};
  const all: Record<string, string> = { ...top, ...r.fields };
  return Object.fromEntries(
    Object.entries(all).flatMap(([field, msg]) => {
      const k = FIELD_OF[field];
      if (!k) return [];
      if (k === "days" && num(f.days) < 30) return [[k, SHORT_NOTICE]];
      return [[k, msg || failText(r)]];
    }),
  );
}

const impactOf = (r: Read<PlanImpact> | undefined, plan: { price_monthly: number; name: string }): ImpactData | null =>
  r?.kind === "ok" ? impactView(r.data, plan) : null;

function formOf(plan: PlanOps | undefined, p: PlanProposal | null, places: number): PlanEditForm {
  const trial = plan?.trial_days ?? 0;
  if (!p)
    return {
      planName: plan?.name ?? "",
      fromVer: plan?.version ?? 1,
      toVer: (plan?.version ?? 1) + 1,
      proposer: "",
      places,
      now: { price: plan?.price_monthly ?? 0, members: plan?.member_limit ?? 0, trial },
      price: String(plan?.price_monthly ?? ""),
      members: String(plan?.member_limit ?? ""),
      trial: String(trial),
      policy: "after_days",
      days: "90",
      newcomer: "now",
      newFrom: "",
      reason: "",
    };
  const nowPrice = p.before.price_monthly ?? plan?.price_monthly ?? 0;
  const nowMembers = p.before.member_limit ?? plan?.member_limit ?? 0;
  return {
    planName: p.plan_name,
    fromVer: p.from_version,
    toVer: p.to_version,
    proposer: familyName(p.proposer.name),
    places,
    now: { price: nowPrice, members: nowMembers, trial },
    price: String(p.changes.price_monthly ?? nowPrice),
    members: String(p.changes.member_limit ?? nowMembers),
    trial: String(p.changes.trial_days ?? trial),
    policy: p.existing_policy === "keep" ? "keep" : "after_days",
    days: String(p.notice_days ?? 90),
    newcomer: p.new_from ? "date" : "now",
    newFrom: p.new_from ?? "",
    reason: p.reason,
  };
}

/** 作る形（新しい案・下書き・差し戻された案） */
function ProposalEdit({
  planKey,
  plan,
  proposal,
  impact,
  open,
}: {
  planKey: string;
  plan: PlanOps | undefined;
  proposal: PlanProposal | null;
  impact: Read<PlanImpact> | undefined;
  open: { count: number; first: string | null };
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const w = useWriter();
  const places = impact?.kind === "ok" ? impact.data.customers : (plan?.places ?? 0);
  const [initial] = useState(() => formOf(plan, proposal, places));
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [dateField, setDateField] = useState(false);
  const planTrial = plan?.trial_days ?? 0;

  const refuse = (r: CallErr) => {
    const fe = r.kind === "invalid" ? fieldErrors(r, form) : {};
    setErrors(fe);
    setAlert(Object.keys(fe).length > 0 ? null : failText(r));
  };
  const reread = async (id: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: PROPOSALS_KEY }),
      qc.invalidateQueries({ queryKey: PLANS_KEY }),
      qc.invalidateQueries({ queryKey: impactKey(id) }),
    ]);
  };
  /** 下書きにする（新しいなら作る・あれば変えた欄だけ直す）→ できた案の id */
  const save = (then: (id: string) => Promise<void> | void) => {
    setErrors({});
    setAlert(null);
    const body = bodyOf(form, planTrial);
    const job = proposal
      ? () => {
          const diff = changedOf(body, bodyOf(initial, planTrial));
          return Object.keys(diff).length === 0
            ? Promise.resolve<Res>({ ok: true, data: proposal })
            : updateProposal(proposal.id, diff);
        }
      : () => createProposal({ plan_key: planKey, ...body });
    void w.send(job, async (r) => {
      if (!r.ok) return refuse(r);
      const id = (r.data as { id?: unknown } | null)?.id;
      await then(typeof id === "string" ? id : (proposal?.id ?? ""));
    });
  };
  const onSaveDraft = () =>
    save(async (id) => {
      await reread(id);
      if (!proposal) router.push(proposalPath(id) as Route);
    });
  const onSubmit = () =>
    save(async (id) => {
      const r = await submitProposal(id);
      if (!r.ok) return refuse(r);
      await reread(id);
      if (!proposal) router.push(proposalPath(id) as Route);
    });

  return (
    <>
      <PlanEditPage
        form={form}
        onChange={(patch) => {
          if (patch.newcomer === "date") setDateField(true);
          setForm((f) => ({ ...f, ...patch }));
        }}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
        impact={proposal ? impactOf(impact, { price_monthly: num(form.price), name: form.planName }) : null}
        {...(proposal && impact?.kind !== "ok" ? { impactNote: IMPACT_FAILED } : {})}
        errors={errors}
        alert={alert ?? w.offline}
        busy={w.busy}
        dateField={dateField}
        hrefs={plansHrefs(open.first)}
      />
      {w.stepUpNode}
    </>
  );
}

/** 決める人の形（待っている・決めた・差し戻した案） */
function ProposalReview({
  me,
  plan,
  proposal: p,
  impact,
  open,
}: {
  me: string | null;
  plan: PlanOps | undefined;
  proposal: PlanProposal;
  impact: Read<PlanImpact> | undefined;
  open: { count: number; first: string | null };
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const w = useWriter();
  const data = impact?.kind === "ok" ? impact.data : null;
  const [notice, setNotice] = useState(() => defaultNotice(p, data));
  const [refused, setRefused] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const self = refused || (!p.can_decide && me !== null && p.proposer.member_id === me);
  const facts = reviewFacts(p, data, plan ?? {});

  const done = async (text: string) => {
    setFlash(text);
    await Promise.all([
      qc.invalidateQueries({ queryKey: PLANS_KEY }),
      qc.invalidateQueries({ queryKey: PROPOSALS_KEY }),
      qc.invalidateQueries({ queryKey: ["k991", "history"] }),
    ]);
    router.push(PLANS_PATH as Route);
  };
  const refuse = (r: CallErr) => {
    if (r.code === SELF_REFUSED) return setRefused(true);
    setAlert(failText(r));
  };
  const body = notice;
  const onDecide = () => {
    setAlert(null);
    void w.send(
      () => decideProposal(p.id, body),
      async (r) => (r.ok ? done(DECIDED) : refuse(r)),
    );
  };
  const onReturn = () => {
    const why = reason.trim();
    if (!why) return;
    void w.send(
      () => returnProposal(p.id, why),
      async (r) => {
        setReturning(false);
        return r.ok ? done(RETURNED) : refuse(r);
      },
    );
  };

  return (
    <>
      <PlanReviewPage
        self={self}
        locked={!p.can_decide}
        proposal={{
          title: `${p.plan_name} v${p.from_version} → v${p.to_version} の案`,
          head: reviewHead(p, me),
          price: facts.price,
          members: facts.members,
          trial: facts.trial,
          existing: facts.existing,
          newcomer: facts.newcomer,
          reason: p.reason,
          steps: decideSteps(p, data),
        }}
        impact={impactOf(impact, { price_monthly: p.changes.price_monthly ?? 0, name: p.plan_name })}
        {...(data ? {} : { impactNote: IMPACT_FAILED })}
        notice={notice}
        onNotice={setNotice}
        onDecide={onDecide}
        onReturn={() => setReturning(true)}
        busy={w.busy}
        alert={alert ?? w.offline}
        hrefs={plansHrefs(open.first)}
        proposals={open.count}
      />
      <Dialog
        title="差し戻す理由"
        open={returning}
        onOpenChange={(o) => setReturning(o)}
        actions={
          <>
            <Button variant="outlined" onClick={() => setReturning(false)}>
              やめる
            </Button>
            <Button onClick={onReturn} disabled={w.busy || reason.trim() === ""}>
              差し戻す
            </Button>
          </>
        }
      >
        <TextArea
          label="理由"
          name="return_reason"
          rows={3}
          required
          description="作った人に届き、記録に残る"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Dialog>
      {w.stepUpNode}
    </>
  );
}

export function PlanProposalScreen({ id, plan: planKey }: { id: string | null; plan: string | null }) {
  const plans = useOpsPlans();
  const proposals = usePlanProposals(id !== null);
  const impact = usePlanImpact(id);
  const me = useMe(id !== null);
  const reads = [plans.data, id ? proposals.data : undefined, id ? impact.data : undefined];
  useRelogin(reads.some((r) => r?.kind === "login"));

  const waiting = plans.isPending || (id !== null && (proposals.isPending || impact.isPending || me.isPending));
  if (waiting || reads.some((r) => r?.kind === "login")) return null;
  const title = "プラン";
  const fallback = (res: Read<unknown> | undefined, retry: () => void): ReactNode =>
    res?.kind === "forbidden" ? (
      <PlansFallback title={title} kind="forbidden" />
    ) : (
      <PlansFallback title={title} kind="failed" retry={retry} />
    );
  if (plans.data?.kind !== "ok") return fallback(plans.data, () => void plans.refetch());
  const rows = plans.data.data;
  const open = openProposals(rows);

  if (id === null) {
    const row = rows.find((r) => r.plan_key === planKey);
    if (!row) return <PlansFallback title={title} kind="missing" />;
    return (
      <ProposalEdit
        key={row.plan_key}
        planKey={row.plan_key}
        plan={row}
        proposal={null}
        impact={undefined}
        open={open}
      />
    );
  }
  if (proposals.data?.kind !== "ok") return fallback(proposals.data, () => void proposals.refetch());
  const p = proposals.data.data.find((x) => x.id === id);
  if (!p) return <PlansFallback title={title} kind="missing" />;
  const row = rows.find((r) => r.plan_key === p.plan_key);
  if (p.can_edit)
    return (
      <ProposalEdit
        key={`${p.id}-${p.state}`}
        planKey={p.plan_key}
        plan={row}
        proposal={p}
        impact={impact.data}
        open={open}
      />
    );
  return (
    <ProposalReview
      key={`${p.id}-${p.state}`}
      me={me.data ?? null}
      plan={row}
      proposal={p}
      impact={impact.data}
      open={open}
    />
  );
}
