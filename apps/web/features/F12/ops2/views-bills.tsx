"use client";
// 運営の請求：月ごと・入金を記録（段 13・領域 ops2・キャンバス OpBills・OpPay）。値を受け取って描くだけ
//   本番の画面（K-984 の bills-screen.tsx）は任意の props で値と押したときの関数を渡す。渡さない呼び方（モック）は下絵のまま。
//   部品の中に開発用の道（/dev/…）を持たない：［請求書の型］は templateHref を渡したときだけ押せるリンク、止める案は行の stopHref
import { Fingerprint } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Confirm, Dialog, PageBody, PageHeader, Select, TextField } from "@/components/k";
import { Chip, Note, Stat, StatGrid, StatusBadge } from "@/features/F12/ops/ops-parts";
import { BILL_ROWS, PAYMENT_ROWS, type BillRow, type PaymentRow } from "./ops2-sample";
import "@/features/F12/ops/ops.css";
import "./ops2.css";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

/** 月の選び肢（12 か月・モックの下絵の値） */
const MONTHS = [
  "10 月分",
  "9 月分",
  "8 月分",
  "7 月分",
  "6 月分",
  "5 月分",
  "4 月分",
  "3 月分",
  "2 月分",
  "1 月分",
  "12 月分",
  "11 月分（2025 年）",
] as const;

/** 一覧の 1 行（止める案の行き先は入れ物が組んで渡す） */
export type BillsRow = BillRow & { stopHref?: string | null };
/** 小窓の中の赤い箱（字と、あれば［もう一度］） */
export interface BillsAlert {
  text: string;
  retry?: () => void;
}

function AlertBox({ alert }: { alert: BillsAlert }) {
  return (
    <div role="alert" className="k-op-alert">
      {alert.text}
      {alert.retry ? (
        <>
          {" "}
          <Button size="sm" variant="outlined" onClick={alert.retry}>
            もう一度
          </Button>
        </>
      ) : null}
    </div>
  );
}

const cols = (onPay?: (id: string) => void): RespColumn<BillsRow>[] => [
  { key: "ws", header: "ワークスペース", cell: (r) => r.ws },
  { key: "plan", header: "プラン", cell: (r) => r.plan },
  { key: "amount", header: "金額（税込）", num: true, cell: (r) => r.amount },
  {
    key: "state",
    header: "状態",
    cell: (r) => (
      <span className="k-op-inline">
        <StatusBadge tone={r.tone}>{r.state}</StatusBadge>
        {r.stopHref ? (
          <a className="k-link" href={r.stopHref}>
            止める案
          </a>
        ) : r.stopProposal ? (
          <a className="k-link">止める案</a>
        ) : null}
      </span>
    ),
  },
  { key: "paid", header: "入金", cell: (r) => r.paid },
  {
    key: "act",
    header: <span className="sr-only">操作</span>,
    card: "action",
    cell: (r) =>
      r.canPay ? (
        <Button
          size="sm"
          variant="outlined"
          aria-label={`${r.ws} の入金を記録`}
          {...(onPay ? { onClick: () => onPay(r.id) } : {})}
        >
          入金を記録
        </Button>
      ) : null,
  },
];

/** 札（数と、押したときの関数） */
export interface BillsChip {
  key: string;
  label: string;
  count: number;
  on: boolean;
}
/** 上の数 */
export interface BillsStat {
  label: string;
  value: string;
  sub: string;
  tone?: "danger";
}
/** 月の選び肢（値・選んだ値・選んだとき） */
export interface BillsMonths {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}
/** 出した後の知らせ（role=status・1 行目と、あれば 2 行目） */
export interface BillsStatus {
  text: string;
  extra?: string | null;
}
export interface BillsPageProps {
  months?: BillsMonths;
  chips?: readonly BillsChip[];
  onChip?: (key: string) => void;
  stats?: readonly BillsStat[];
  rows?: readonly BillsRow[];
  /** 頭の下の 1 行（「10 月分 ・ 5 件」） */
  sub?: string;
  /** ［<先月> 月分をまとめて出す］の字 */
  issueLabel?: string;
  onIssue?: () => void;
  onPay?: (id: string) => void;
  status?: BillsStatus | null;
  /** 渡したときだけ［請求書の型］を押せるリンクにする（渡さなければ href の無い押せない形） */
  templateHref?: string;
}

const SAMPLE_CHIPS: readonly BillsChip[] = [
  { key: "all", label: "すべて", count: 5, on: true },
  { key: "unpaid", label: "お支払い待ち", count: 1, on: false },
  { key: "paid", label: "払われた", count: 2, on: false },
  { key: "overdue", label: "期限を過ぎた（前の月の分）", count: 2, on: false },
];
const SAMPLE_STATS: readonly BillsStat[] = [
  { label: "10 月分", value: "¥ 104,500", sub: "税込 ・ 3 件 ・ 無料は請求なし" },
  { label: "お支払い待ち", value: "1 件", sub: "期限 11/30 ・ 払われた 2 件" },
  { label: "期限を過ぎた", value: "¥ 49,500", sub: "2 件 ・ 前の月の分", tone: "danger" },
];

function TemplateLink({ href }: { href?: string | undefined }) {
  return href ? (
    <a className="k-btn" data-variant="outlined" data-size="md" href={href}>
      請求書の型
    </a>
  ) : (
    <a className="k-btn" data-variant="outlined" data-size="md" aria-disabled="true">
      請求書の型
    </a>
  );
}

/** 請求：月ごと・お支払い待ち・払われた・期限を過ぎた（前の月の分も上） */
export function BillsPage({
  months,
  chips = SAMPLE_CHIPS,
  onChip,
  stats = SAMPLE_STATS,
  rows = BILL_ROWS,
  sub = "10 月分 ・ 5 件",
  issueLabel = "10 月分をまとめて出す",
  onIssue,
  onPay,
  status,
  templateHref,
}: BillsPageProps = {}): ReactNode {
  return (
    <PageBody labelledBy="oq-bills-title">
      <PageHeader id="oq-bills-title" title="請求" sub={sub} actions={<TemplateLink href={templateHref} />} />
      <div className="k-op-body">
        {months ? (
          <Select
            label="月"
            name="month"
            value={months.value}
            onValueChange={(v) => v && months.onChange(v)}
            options={months.options.map((o) => ({ value: o.value, label: o.label }))}
          />
        ) : (
          <Select
            label="月"
            name="month"
            defaultValue="10 月分"
            options={MONTHS.map((m) => ({ value: m, label: m }))}
          />
        )}
        <div className="k-op-chips" role="group" aria-label="絞り込み">
          {chips.map((c) => (
            <Chip key={c.key} on={c.on} count={c.count} {...(onChip ? { onClick: () => onChip(c.key) } : {})}>
              {c.label}
            </Chip>
          ))}
        </div>
        <StatGrid>
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} sub={s.sub} {...(s.tone ? { tone: s.tone } : {})} />
          ))}
        </StatGrid>
        {status ? (
          <div role="status" className="k-op-note-text">
            <p className="k-op-note-text">{status.text}</p>
            {status.extra ? <p className="k-op-note-text">{status.extra}</p> : null}
          </div>
        ) : null}
        <RespTable
          caption="請求の一覧（期限を過ぎたものが上）"
          columns={cols(onPay)}
          rows={[...rows]}
          rowKey={(r) => r.id}
        />
        <Note>
          ［まとめて出す］を押すと、締めた月の請求書を確かめてからまとめて出す。出すと各ワークスペースの請求書の画面に出る。期限を過ぎたものは前の月の分も上に出し、期限から
          7 日を過ぎたら「止める案」が出る（止めるかは人が決める）。入金は 1
          件ずつ記録する（銀行とつないだ自動の消し込み・カード払いは後のフェーズ）。値段は仮
        </Note>
        <div className="k-oq-end">
          <Button variant="secondary" {...(onIssue ? { onClick: onIssue } : {})}>
            {issueLabel}
          </Button>
        </div>
      </div>
    </PageBody>
  );
}

/** 確かめの小窓の値（下書きの答えから） */
export interface BillsIssueView {
  title: string;
  count: string;
  total: string;
  due: string;
  /** 件数の下の補足（既定は下絵の字） */
  countSub?: string;
}
const SAMPLE_ISSUE: BillsIssueView = {
  title: "10 月分の請求書をまとめて出す",
  count: "46 件",
  total: "¥ 1,207,800",
  due: "期限 11/30",
};

/** 今月の請求書をまとめて出す確かめ：件数・合計・本人確認 */
export function BillsIssueConfirm({
  onClose,
  onConfirm,
  open = true,
  view = SAMPLE_ISSUE,
  busy = false,
  error,
}: {
  onClose?: () => void;
  onConfirm?: () => void;
  open?: boolean;
  view?: BillsIssueView;
  busy?: boolean;
  error?: BillsAlert | null;
}) {
  return (
    <Confirm
      open={open}
      onOpenChange={(o) => !o && onClose?.()}
      onConfirm={() => onConfirm?.()}
      busy={busy}
      tone="primary"
      confirmLabel="本人確認をして出す"
      title={view.title}
      description="下書きの請求書を、各ワークスペースの請求書の画面に出します。出したあとは取り消せません"
    >
      <div className="k-op-form">
        <StatGrid>
          <Stat label="件数" value={view.count} sub={view.countSub ?? "無料は請求なし"} />
          <Stat label="合計（税込）" value={view.total} sub={view.due} />
        </StatGrid>
        <Note>
          <Fingerprint size={14} aria-hidden="true" />{" "}
          出す前に本人確認を取り直します（パスキー）。出した人・時刻・件数は運営の記録に残ります。値段は仮
        </Note>
        {error ? <AlertBox alert={error} /> : null}
      </div>
    </Confirm>
  );
}

/** その請求書の入金の並び（入金日・額・振込名義・取り消す）。取り消した行は押せない */
function Payments({
  rows,
  onReverse,
  busy = false,
}: {
  rows: readonly PaymentRow[];
  onReverse?: ((id: string) => void) | undefined;
  busy?: boolean;
}) {
  const cols: RespColumn<PaymentRow>[] = [
    { key: "on", header: "入金日", cell: (r) => r.paidOn },
    { key: "amount", header: "額", num: true, cell: (r) => r.amount },
    { key: "payer", header: "振込名義", cell: (r) => r.payer },
    {
      key: "act",
      header: <span className="sr-only">操作</span>,
      card: "action",
      cell: (r) =>
        r.reversed ? (
          <Button size="sm" variant="ghost" aria-disabled="true" tabIndex={-1} title="取り消し済み">
            取り消し済み
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outlined"
            aria-label={`${r.paidOn} の ${r.amount} の入金を取り消す`}
            disabled={busy}
            {...(onReverse ? { onClick: () => onReverse(r.id) } : {})}
          >
            取り消す
          </Button>
        ),
    },
  ];
  return <RespTable caption="この請求書の入金" columns={cols} rows={[...rows]} rowKey={(r) => r.id} />;
}

/** 入金の小窓の値（答えの 1 行と書いている額から） */
export interface PayDialogView {
  target: string;
  payments: readonly PaymentRow[];
  diff: string;
  /** 差がある（赤い字） */
  alert: boolean;
}
/** 入金の欄（書いている値） */
export interface PayDialogForm {
  amount: string;
  paidOn: string;
  payer: string;
}
export interface PayDialogProps {
  /** 渡すと差がある形（モックの下絵の値・足りないのでお支払い待ちのまま） */
  diff?: boolean;
  onClose?: () => void;
  open?: boolean;
  view?: PayDialogView;
  form?: PayDialogForm;
  onForm?: (form: PayDialogForm) => void;
  onSubmit?: () => void;
  onReverse?: (paymentId: string) => void;
  busy?: boolean;
  error?: BillsAlert | null;
}

/** 入金を記録する小窓：入金の並び・入金日・金額・振込名義・差。diff を渡すと差がある形（足りないのでお支払い待ちのまま） */
export function PayDialog({
  diff = false,
  onClose,
  open = true,
  view,
  form,
  onForm,
  onSubmit,
  onReverse,
  busy = false,
  error,
}: PayDialogProps) {
  const sample = diff ? "¥10,000" : "¥16,500";
  const shown: PayDialogView = view ?? {
    target: "北村デザイン事務所 ・ 9 月分 ¥16,500（期限 10/31）",
    payments: PAYMENT_ROWS,
    diff: diff
      ? "差 ¥6,500 ・ 請求額より足りません。差を残して「お支払い待ち」のままにします"
      : "差 ¥0 ・ 請求額と同じ → 払われた にする",
    alert: diff,
  };
  const set = (k: keyof PayDialogForm) => (e: { target: { value: string } }) =>
    form && onForm?.({ ...form, [k]: e.target.value });
  const field = (k: keyof PayDialogForm, sampleValue: string) =>
    form ? { value: form[k], onChange: set(k) } : { readOnly: true, defaultValue: sampleValue };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose?.()}
      title="入金を記録"
      target={shown.target}
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            やめる
          </Button>
          <Button loading={busy} {...(onSubmit ? { onClick: onSubmit } : {})}>
            記録する
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        <div className="k-op-form-group">
          <b>これまでの入金</b>
          <Payments rows={shown.payments} onReverse={onReverse} busy={busy} />
        </div>
        <TextField label="入金日" name="date" type="date" {...field("paidOn", "2026-11-02")} />
        <TextField label="金額" name="amount" inputMode="numeric" {...field("amount", sample)} />
        <TextField label="振込名義" hint="任意" name="payer" {...field("payer", "キタムラデザイン")} />
        {shown.alert ? (
          <p className="k-op-alert" role="status">
            {shown.diff}
          </p>
        ) : (
          <Note>{shown.diff}</Note>
        )}
        {error ? <AlertBox alert={error} /> : null}
        <Note>
          足りない・多いときは差を残して「お支払い待ち」のまま（次の入金で足せる）。打ち間違いは「取り消す」で打ち消しの行を足す（消さない）。記録すると、顧客の請求書の画面にも出て、運営の記録に残る
        </Note>
      </div>
    </Dialog>
  );
}
