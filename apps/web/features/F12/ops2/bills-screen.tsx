"use client";
// 運営の請求の画面（/ops/billing・K-984）。URL の月と状態を読み → 外枠の答え（caps）と一覧の口を読み → 部品（views-bills.tsx）に形の値と押したときの関数を渡す。
//   caps に money が無ければ本文は「見る権限がない」で、請求の口を呼ばない。一覧が読めなければ「もう一度」（E-PAGE-007・ふつうに見せない）。
//   まとめて出す：下書き（dry_run）→ 確かめ → 出す。入金を記録・取り消す：答えの 1 行で一覧の行を置き換える。
//   書く口が 403 STEP_UP_REQUIRED → getMySecurity を 1 回読み StepUp → 通ったら同じ体で 1 回だけやり直す。送っている間は 2 回目を送らない。
//   外枠の「請求（数）」は外枠の口が数える（この画面は数えない）。書いた後は外枠の鍵を捨てて読み直させる
import type { Route } from "next";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";
import { FALLBACKS } from "@/lib/nav";
import { StepUp } from "@/features/F1/security/step-up";
import { OPS_SHELL_KEY } from "@/features/F12/ops/use-ops-shell";
import {
  billRowView,
  billsQuery,
  billsSearch,
  issueLabelOf,
  issueView,
  lastMonth,
  listQueryOf,
  monthOptions,
  payBody,
  payFormOf,
  payView,
  reverseBody,
  statsView,
  type BillAnswer,
  type BillDraft,
  type BillsQuery,
  type PayForm,
} from "./bills-shape";
import {
  billsKey,
  capsOf,
  issueInvoices,
  recordPayment,
  stepUpShape,
  useOpsBills,
  useOpsShellData,
  type BillWrite,
  type BillsRead,
} from "./use-ops-bills";
import { BillsIssueConfirm, BillsPage, PayDialog, type BillsAlert, type BillsStatus } from "./views-bills";

const PATH = "/ops/billing";
const ISSUE_STEP_UP = "請求書を出す前に、本人か確かめます"; // （仮）
const PAY_STEP_UP = "入金を記録する前に、本人か確かめます"; // （仮）
const PAY_INVALID = "入金日と金額（1 円以上の整数）を入れてください"; // （仮）
const MAIL_FAILED = (n: number) =>
  `${n} 通のメールを送れませんでした。請求書は出ています（鈴と請求書の画面で見られます）`;
const textOf = (code: string): string => CATALOG[code]?.message ?? "";
const failText = (r: CallErr): string =>
  r.message ?? (textOf(r.code) || textOf(errorCodeOf(r)) || textOf(PAGE_ERROR.loadFailed));
/** 409（口が断った）は字だけ。ほかの失敗は［もう一度］つき */
const alertOf = (r: CallErr, retry: () => void): BillsAlert =>
  r.status === 409 ? { text: failText(r) } : { text: failText(r), retry };
const offline = (retry: () => void): BillsAlert => ({ text: textOf(PAGE_ERROR.loadFailed), retry });

function Frame({ sub, children }: { sub?: string; children: ReactNode }) {
  return (
    <PageBody labelledBy="oq-bills-title">
      <PageHeader id="oq-bills-title" title="請求" {...(sub ? { sub } : {})} />
      {children}
    </PageBody>
  );
}

export function BillsScreen() {
  const sp = useSearchParams();
  const [now] = useState(() => new Date());
  const q = useMemo(() => billsQuery(sp, now), [sp, now]);
  const shell = useOpsShellData();
  if (shell.isPending) return null;
  if (!capsOf(shell.data).includes("money"))
    return (
      <Frame sub={FALLBACKS.forbidden.title}>
        <NoAccess />
      </Frame>
    );
  return <BillsBody q={q} now={now} />;
}

type Issue = { draft: BillDraft | null; error: BillsAlert | null } | null;
type Pay = { id: string; form: PayForm; error: BillsAlert | null } | null;
type Job<T> = () => Promise<BillWrite<T>>;

function BillsBody({ q, now }: { q: BillsQuery; now: Date }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const key = billsKey(q.month, q.state);
  const list = useOpsBills(q, listQueryOf(q, now), true);
  const [status, setStatus] = useState<BillsStatus | null>(null);
  const [issue, setIssue] = useState<Issue>(null);
  const [pay, setPay] = useState<Pay>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean; reason: string } | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const sending = useRef(false);

  const relogin = list.data?.kind === "login";
  useEffect(() => {
    if (relogin) router.replace(`/ops/login?next=${encodeURIComponent(PATH + window.location.search)}` as Route);
  }, [relogin, router]);

  const guarded = async (run: () => Promise<void>, onOffline: () => void) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await run();
    } catch {
      onOffline(); // 網が切れた・答えの形が違う
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  /** 書く口を呼ぶ。取り直しが要れば 1 回だけ取り直してから同じ体でやり直す */
  const send = <T,>(
    job: Job<T>,
    done: (w: BillWrite<T>) => Promise<void> | void,
    reason: string,
    onOffline: () => void,
    retried = false,
  ): Promise<void> =>
    guarded(async () => {
      const w = await job();
      if (!w.ok && w.err.kind === "step_up" && !retried) {
        pending.current = () => send(job, done, reason, onOffline, true);
        setStepUp({ ...(await stepUpShape()), reason });
        return;
      }
      if (!w.ok && w.err.status === 401) {
        router.replace(`/ops/login?next=${encodeURIComponent(pathname)}` as Route);
        return;
      }
      await done(w);
    }, onOffline);

  const rereadShell = () => qc.invalidateQueries({ queryKey: OPS_SHELL_KEY });
  /** 一覧の行を答えの 1 行で置き換える */
  const replaceRow = (row: BillAnswer) =>
    qc.setQueryData<BillsRead>(key, (old) =>
      old?.kind === "ok" ? { kind: "ok", rows: old.rows.map((r) => (r.id === row.id ? row : r)) } : old,
    );

  if (list.isPending || relogin) return null;
  const res = list.data;
  if (res?.kind === "forbidden")
    return (
      <Frame sub={FALLBACKS.forbidden.title}>
        <NoAccess />
      </Frame>
    );
  if (res?.kind !== "ok")
    return (
      <Frame>
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void list.refetch()]} />
      </Frame>
    );

  const rows = res.rows;
  const month = lastMonth(now);
  const go = (next: BillsQuery) => router.push(`${PATH}${billsSearch(next, now)}` as Route);
  const s = statsView(rows, q.month);
  const hidden = stepUp !== null; // 取り直しの間は小窓を下げて値を持つ

  /** 下書きを読む（確かめの小窓の値）。keep は出せなかった字を残す */
  const loadDraft = async (keep: BillsAlert | null) => {
    const w = await issueInvoices({ month, dry_run: true });
    if (w.ok) return setIssue({ draft: w.data, error: keep });
    setIssue(null);
    setStatus({ text: failText(w.err) });
  };
  const draft = () =>
    guarded(
      () => loadDraft(null),
      () => {
        setIssue(null);
        setStatus({ text: textOf(PAGE_ERROR.loadFailed) });
      },
    );
  const onIssue = () => {
    setStatus(null);
    void draft();
  };
  const onConfirm = () => {
    const retry = () => onConfirm();
    void send(
      () => issueInvoices({ month }),
      async (w) => {
        if (!w.ok) {
          const err = alertOf(w.err, retry);
          if (w.err.code === "E-BILL-006") {
            // 下書きの後に中身が変わった：字を残して下書きを読み直す
            setIssue((cur) => (cur ? { ...cur, error: err } : cur));
            return loadDraft(err);
          }
          return setIssue((cur) => (cur ? { ...cur, error: err } : cur));
        }
        const mail = (w.meta["mail"] ?? {}) as { failed?: unknown };
        const failed = typeof mail.failed === "number" ? mail.failed : 0;
        setIssue(null);
        setStatus({ text: `${w.data.count} 件の請求書を出しました`, extra: failed > 0 ? MAIL_FAILED(failed) : null });
        await Promise.all([qc.invalidateQueries({ queryKey: key }), rereadShell()]);
      },
      ISSUE_STEP_UP,
      () => setIssue((cur) => (cur ? { ...cur, error: offline(retry) } : cur)),
    );
  };

  const paying = pay ? rows.find((r) => r.id === pay.id) : undefined;
  const setPayError = (error: BillsAlert | null) => setPay((cur) => (cur ? { ...cur, error } : cur));
  const onSubmit = () => {
    if (!pay || !paying) return;
    const body = payBody(pay.form);
    if (!body) return setPayError({ text: PAY_INVALID });
    setPayError(null);
    const retry = () => onSubmit();
    void send(
      () => recordPayment(paying.id, body),
      async (w) => {
        if (!w.ok) return setPayError(alertOf(w.err, retry));
        replaceRow(w.data);
        setPay(null);
        await rereadShell();
      },
      PAY_STEP_UP,
      () => setPayError(offline(retry)),
    );
  };
  const onReverse = (paymentId: string) => {
    const p = paying?.payments?.find((x) => x.id === paymentId);
    if (!paying || !p) return;
    setPayError(null);
    const retry = () => onReverse(paymentId);
    void send(
      () => recordPayment(paying.id, reverseBody(p, now)),
      async (w) => {
        if (!w.ok) return setPayError(alertOf(w.err, retry));
        replaceRow(w.data); // 小窓は閉じない（入金の並びは答えの 1 行で描き直す）
        await rereadShell();
      },
      PAY_STEP_UP,
      () => setPayError(offline(retry)),
    );
  };

  return (
    <>
      <BillsPage
        months={{ options: monthOptions(now), value: q.month, onChange: (v) => go({ ...q, month: v }) }}
        chips={s.chips.map((c) => ({ ...c, on: c.key === q.state }))}
        onChip={(k) => go({ ...q, state: k as BillsQuery["state"] })}
        stats={s.stats}
        rows={rows.map((r) => billRowView(r, now))}
        sub={`${s.stats[0]?.label ?? ""} ・ ${rows.length} 件`}
        issueLabel={issueLabelOf(now)}
        onIssue={onIssue}
        onPay={(id) => {
          const r = rows.find((x) => x.id === id);
          if (r) setPay({ id, form: payFormOf(r, now), error: null });
        }}
        status={status}
      />
      {issue?.draft ? (
        <BillsIssueConfirm
          open={!hidden}
          view={issueView(issue.draft)}
          busy={busy}
          error={issue.error}
          onConfirm={onConfirm}
          onClose={() => setIssue(null)}
        />
      ) : null}
      {pay && paying ? (
        <PayDialog
          open={!hidden}
          view={payView(paying, pay.form.amount)}
          form={pay.form}
          onForm={(form) => setPay((cur) => (cur ? { ...cur, form } : cur))}
          onSubmit={onSubmit}
          onReverse={onReverse}
          busy={busy}
          error={pay.error}
          onClose={() => setPay(null)}
        />
      ) : null}
      <StepUp
        open={stepUp !== null}
        reason={stepUp?.reason ?? ISSUE_STEP_UP}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId="ops-billing"
        onDone={() => {
          setStepUp(null);
          const again = pending.current;
          pending.current = null;
          if (again) void again();
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null; // やめた：何も送らず、入れた値のまま小窓に戻す
        }}
      />
    </>
  );
}
