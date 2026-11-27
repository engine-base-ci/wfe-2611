"use client";
// 請求 › 請求書の型（/ops/billing/template・K-1108）。getOpsInvoiceTemplate を 1 回読み → 部品 InvoiceTemplatePage に値と押したときの関数を渡す。
//   お金を持たない運営の人（外枠の答えの operator.caps に money が無い）は「見る権限がありません」で口を呼ばない。口の 403 も同じ。
//   ［直す］で欄・［やめる］で捨てて見るに戻る（送らない）・［保存する］は欄の誤りが無いときだけ PUT（読んだ版）。送っている間は 2 回目を送らない。
//   403 STEP_UP_REQUIRED → getMySecurity を 1 回読み StepUp → 通ったら同じ体で 1 回だけやり直す（K-972・K-984 と同じ形）。
//   409 E-BILL-007・503・網の切れは「保存できませんでした」（書いた値は残し欄のまま）。409 は裏で 1 回読み直して版だけを新しくする（D-156.76）。
//   読めない（503・網の切れ・形が違う）は ErrorState（E-PAGE-007・「もう一度」）
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { StepUp } from "@/features/F1/security/step-up";
import { useOpsCrumbs } from "@/features/F12/ops/ops-frame";
import { useOpsShell } from "@/features/F12/ops/use-ops-shell";
import { FALLBACKS } from "@/lib/nav";
import {
  bodyOf,
  errorsOf,
  isInvoiceTemplate,
  viewOf,
  type InvoiceTemplateAnswer,
  type InvoiceTemplateBody,
  type InvoiceTemplateErrors,
  type InvoiceTemplateValues,
} from "./invoice-template-shape";
import {
  INVOICE_TEMPLATE_KEY,
  capsOf,
  fetchInvoiceTemplate,
  saveInvoiceTemplate,
  stepUpShape,
  useInvoiceTemplate,
  type TemplateRead,
  type TemplateWrite,
} from "./use-invoice-template";
import { InvoiceTemplatePage, type InvoiceTemplateMode } from "./views-invoice-template";

export const INVOICE_TEMPLATE_PATH = "/ops/billing/template";
const BILLING_PATH = "/ops/billing";
const TITLE = "請求書の型";
const MONEY = "money";
const STEP_UP_REASON = "請求書の型を直す前に、本人か確かめます"; // （仮）
const CRUMBS = [{ label: "請求", href: BILLING_PATH }, { label: TITLE }];

type Shape = { withCode: boolean; withPasskey: boolean };

/** 見られない・読めないときの頁（見出しと中身だけ） */
function Fallback({ kind, retry }: { kind: "forbidden" | "failed"; retry?: () => void }) {
  return (
    <PageBody labelledBy="oq-invoice-template-fallback">
      <PageHeader
        id="oq-invoice-template-fallback"
        title={TITLE}
        {...(kind === "forbidden" ? { sub: FALLBACKS.forbidden.title } : {})}
      />
      {kind === "forbidden" ? <NoAccess /> : <ErrorState code={PAGE_ERROR.loadFailed} acts={retry ? [retry] : []} />}
    </PageBody>
  );
}

/** 入り直し（401）なら運営のログインへ移す */
function useRelogin(need: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (need) router.replace(`/ops/login?next=${encodeURIComponent(pathname)}` as Route);
  }, [need, router, pathname]);
}

export function InvoiceTemplateScreen() {
  useOpsCrumbs(CRUMBS);
  const shell = useOpsShell();
  // 外枠を読んでいる間は何も出さず口も呼ばない（お金を持たない人に口を 1 回も呼ばせない・K-984 と同じ形）。
  //   外枠が読めた後に caps を拾えないときだけ「分からない」として口を呼び、口の 403 で見分ける
  const caps = shell.isPending ? null : capsOf(shell.data);
  const allowed = !shell.isPending && (caps === null || caps.includes(MONEY));
  const tpl = useInvoiceTemplate(allowed);
  useRelogin(tpl.data?.kind === "login");

  if (shell.isPending) return null;
  if (!allowed) return <Fallback kind="forbidden" />;
  if (tpl.isPending || tpl.data?.kind === "login") return null;
  const res = tpl.data;
  if (res?.kind === "forbidden") return <Fallback kind="forbidden" />;
  if (res?.kind !== "ok") return <Fallback kind="failed" retry={() => void tpl.refetch()} />;
  return <TemplateBody answer={res.data} />;
}

/** 新しい方の答え（版が大きい方・同じなら書いた口の答え） */
const newer = (saved: InvoiceTemplateAnswer, read: TemplateRead | undefined): InvoiceTemplateAnswer =>
  read?.kind === "ok" && read.data.version > saved.version ? read.data : saved;

function TemplateBody({ answer }: { answer: InvoiceTemplateAnswer }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const view = viewOf(answer, new Date());
  const [mode, setMode] = useState<InvoiceTemplateMode>("view");
  const [values, setValues] = useState<InvoiceTemplateValues>(view.values);
  const [version, setVersion] = useState(answer.version);
  const [errors, setErrors] = useState<InvoiceTemplateErrors>({});
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<Shape | null>(null);
  const sending = useRef(false);
  const pending = useRef<InvoiceTemplateBody | null>(null);

  /** 読み直す（鍵の答えを入れ替える）。読めた答えを返す */
  const reread = async (): Promise<TemplateRead | undefined> => {
    await qc.refetchQueries({ queryKey: INVOICE_TEMPLATE_KEY, exact: true });
    return qc.getQueryData<TemplateRead>(INVOICE_TEMPLATE_KEY);
  };

  const fail = async (conflict: boolean) => {
    setMode("failed");
    if (!conflict) return;
    const r = await fetchInvoiceTemplate().catch(() => undefined); // 版だけを新しくする（書いた値は替えない）
    if (r?.kind === "ok") {
      qc.setQueryData(INVOICE_TEMPLATE_KEY, r);
      setVersion(r.data.version);
    }
  };

  const put = async (body: InvoiceTemplateBody, retried: boolean): Promise<void> => {
    let r: TemplateWrite;
    try {
      r = await saveInvoiceTemplate(body);
    } catch {
      return fail(false); // 網が切れた
    }
    if (r.ok) {
      const saved = isInvoiceTemplate(r.data) ? r.data : null;
      const read = await reread();
      if (saved) qc.setQueryData(INVOICE_TEMPLATE_KEY, { kind: "ok", data: newer(saved, read) });
      setErrors({});
      setMode("view");
      return;
    }
    if (r.kind === "step_up" && !retried) {
      pending.current = body;
      setStepUp(await stepUpShape());
      return;
    }
    if (r.status === 401) {
      router.replace(`/ops/login?next=${encodeURIComponent(pathname)}` as Route);
      return;
    }
    if (r.status === 403) {
      qc.setQueryData(INVOICE_TEMPLATE_KEY, { kind: "forbidden" });
      return;
    }
    return fail(r.status === 409);
  };

  const send = async (body: InvoiceTemplateBody, retried = false) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await put(body, retried);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const onSave = () => {
    if (sending.current) return;
    const errs = errorsOf(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return; // 誤りが 1 つでもあれば送らない
    void send(bodyOf(values, version));
  };
  const onEdit = () => {
    setValues(view.values);
    setVersion(answer.version);
    setErrors({});
    setMode("edit");
  };
  const onCancel = () => {
    setValues(view.values);
    setErrors({});
    setMode("view");
  };

  const editing = mode !== "view";
  return (
    <>
      <InvoiceTemplatePage
        mode={mode}
        values={editing ? values : view.values}
        aside={view.aside}
        onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
        errors={errors}
        onEdit={onEdit}
        onCancel={onCancel}
        onSave={onSave}
        busy={busy}
      />
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId="ops-billing"
        onDone={() => {
          setStepUp(null);
          const again = pending.current;
          pending.current = null;
          if (again) void send(again, true); // 同じ体で 1 回だけやり直す
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null; // やめた：何も送らない
        }}
      />
    </>
  );
}
