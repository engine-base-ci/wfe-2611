"use client";
// 請求書・請求先・プランを変える・値段が変わる知らせ（段 13・領域 user・下絵）。値を受け取って描くだけ（口は呼ばない・欄は読むだけ）。
//   キャンバス WsBills・EdPlan・WsPriceChange を写す。値段は仮（無料 ¥0・チーム ¥15,000・ビジネス ¥40,000）。カード払いは後のフェーズ（押せない形で出す）。
import {
  Badge,
  Button,
  Callout,
  Confirm,
  Dialog,
  Empty,
  PageBody,
  PageHeader,
  Row,
  Section,
  TextField,
  TextLink,
  type BadgeTone,
} from "@/components/k";
import type { ChangeEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import "./billing.css";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

export type BillState = "お支払い待ち" | "払われた" | "期限を過ぎた";
export interface BillView {
  /** 請求書の id（本番の画面が PDF の口に渡す・K-960。モックは持たない） */
  id?: string;
  month: string;
  amount: string;
  issued: string;
  due: string;
  state: BillState;
  /** 入金を確かめた日（まだなら無し） */
  paid?: string;
}
const BILL_TONE: Record<BillState, BadgeTone> = {
  お支払い待ち: "warning",
  払われた: "success",
  期限を過ぎた: "danger",
};

export interface ContactView {
  company: string;
  attn: string;
  email: string;
}
export interface BillsProps {
  terms: string;
  bank: readonly string[];
  contact: ContactView;
  bills: readonly BillView[];
  /** 期限を過ぎた請求がある（上に注意） */
  overdue?: string;
  /** 無料のプラン（請求書が出ない） */
  free?: boolean;
  /** 「設定に戻る」の行き先（既定 /settings・K-960） */
  backHref?: string;
  /** 「PDF」を押したとき（渡さなければ今のリンクのまま・K-960） */
  onPdf?: (bill: BillView) => void;
  /** 「変える」を押したとき（K-960） */
  onEditContact?: () => void;
  /** false なら「変える」を押せない形（D-145.9・既定 true） */
  canEditContact?: boolean;
  /** PDF が開けなかったなどの知らせ（表の上・K-960） */
  alert?: string;
}

const columnsOf = (onPdf?: (bill: BillView) => void): RespColumn<BillView>[] => [
  { key: "month", header: "月", cell: (b) => b.month },
  { key: "amount", header: "金額（税込）", cell: (b) => b.amount, num: true },
  { key: "issued", header: "出した日", cell: (b) => b.issued },
  { key: "due", header: "期限", cell: (b) => b.due },
  { key: "state", header: "状態", cell: (b) => <Badge tone={BILL_TONE[b.state]}>{b.state}</Badge> },
  { key: "paid", header: "入金を確かめた日", cell: (b) => b.paid ?? "—" },
  {
    key: "pdf",
    header: "請求書",
    cell: (b) => (
      <TextLink
        href="#"
        aria-label={`${b.month}の請求書（PDF）`}
        {...(onPdf
          ? {
              onClick: (e: MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                onPdf(b);
              },
            }
          : {})}
      >
        PDF
      </TextLink>
    ),
  },
];

export function Bills({
  terms,
  bank,
  contact,
  bills,
  overdue,
  free,
  backHref = "/settings",
  onPdf,
  onEditContact,
  canEditContact = true,
  alert,
}: BillsProps) {
  return (
    <PageBody labelledBy="bills-title">
      <PageHeader
        id="bills-title"
        title="請求書"
        sub={`${terms}`}
        actions={<TextLink href={backHref}>設定に戻る</TextLink>}
      />
      <div className="k-ub-top">
        {alert ? <Callout tone="danger">{alert}</Callout> : null}
        {overdue ? (
          <Callout tone="warn" title="期限を過ぎた請求があります">
            {overdue}
          </Callout>
        ) : null}
        <dl className="k-ub-terms">
          <div>
            <dt>振込先</dt>
            <dd>
              {bank.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </dd>
          </div>
          <div>
            <dt>請求先</dt>
            <dd>
              {contact.company} {contact.attn}
              <div>{contact.email}</div>
            </dd>
            <Button
              variant="outlined"
              size="sm"
              {...(canEditContact ? {} : { "aria-disabled": true })}
              {...(onEditContact ? { onClick: () => (canEditContact ? onEditContact() : undefined) } : {})}
            >
              変える
            </Button>
          </div>
        </dl>
        <Section title="請求書の一覧">
          {free ? (
            <Empty title="まだ請求書がありません">
              無料のプランでは請求書は出ません。プランを上げると、月末締めで翌月 1 日に出ます。
            </Empty>
          ) : (
            <RespTable
              caption="請求書の一覧"
              columns={columnsOf(onPdf)}
              rows={[...bills]}
              rowKey={(b) => b.id ?? b.month}
            />
          )}
        </Section>
        <p className="k-ub-note">
          請求書は請求先のメールにも届く。入金は運営が確かめてから「払われた」になる（数日かかることがある）。期限を過ぎると管理者にお知らせが出る。値段は仮。カード払いは後のフェーズ
        </p>
      </div>
    </PageBody>
  );
}

export type ContactField = keyof ContactView;
export interface ContactDialogProps {
  contact: ContactView;
  open?: boolean;
  /** 打っている値（渡せば欄を書ける・K-960。渡さなければ今の読むだけの見た目） */
  values?: ContactView;
  /** 欄の下の字 */
  errors?: Partial<Record<ContactField, string>>;
  /** 保存できなかった知らせ（小窓の中） */
  alert?: string;
  /** 送っている間（保存するを押せない） */
  busy?: boolean;
  onChange?: (field: ContactField, value: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

/** 請求先を変える小窓 */
export function ContactDialog({
  contact,
  open = true,
  values,
  errors = {},
  alert,
  busy = false,
  onChange,
  onSave,
  onCancel,
}: ContactDialogProps) {
  const field = (name: ContactField) =>
    values && onChange
      ? { value: values[name], onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(name, e.target.value) }
      : { defaultValue: contact[name], readOnly: true };
  const err = (name: ContactField) => (errors[name] ? { error: errors[name] } : {});
  return (
    <Dialog
      open={open}
      {...(onCancel ? { onOpenChange: (o: boolean) => (o ? undefined : onCancel()) } : {})}
      title="請求先を変える"
      subtitle="請求書の宛名と届け先のメール。次に出す請求書から変わる"
      actions={
        <>
          <Button variant="outlined" {...(onCancel ? { onClick: onCancel } : {})}>
            やめる
          </Button>
          <Button variant="primary" loading={busy} {...(onSave ? { onClick: onSave } : {})}>
            保存する
          </Button>
        </>
      }
    >
      <div className="k-ub-form">
        {alert ? <Callout tone="danger">{alert}</Callout> : null}
        <TextField label="会社名" name="company" required {...field("company")} {...err("company")} />
        <TextField label="宛名" name="attn" {...field("attn")} {...err("attn")} />
        <TextField label="メール" name="email" type="email" required {...field("email")} {...err("email")} />
      </div>
    </Dialog>
  );
}

// ---- プランを変える ----
//   K-962 が足した任意の props（見た目と並びは変えない）。渡さない呼び方（モック）は前の見た目のまま
export interface PlanView {
  id: string;
  name: string;
  price: string;
  limit: string;
  current?: boolean;
  recommended?: boolean;
}
export interface PlanDialogProps {
  workspace: string;
  members: number;
  plans: readonly PlanView[];
  nextBill: string;
  open?: boolean;
  /** 「このプランにする」を押したとき（プランの id・K-962） */
  onChoose?: (id: string) => void;
  /** 「やめる」・× を押したとき（K-962） */
  onCancel?: () => void;
  /** 「請求書」の行き先（既定 /settings/billing） */
  billingHref?: string;
  /** 変えられなかったなどの知らせ（小窓の中・K-962） */
  alert?: string;
}

export function PlanDialog({
  workspace,
  members,
  plans,
  nextBill,
  open = true,
  onChoose,
  onCancel,
  billingHref = "/settings/billing",
  alert,
}: PlanDialogProps) {
  return (
    <Dialog
      open={open}
      {...(onCancel ? { onOpenChange: (o: boolean) => (o ? undefined : onCancel()) } : {})}
      title="プランを変える"
      subtitle={`${workspace} ・ いま ${members} 人`}
      actions={
        <Button variant="outlined" {...(onCancel ? { onClick: onCancel } : {})}>
          やめる
        </Button>
      }
    >
      <div className="k-ub-form">
        {alert ? <Callout tone="danger">{alert}</Callout> : null}
        <ul className="k-ub-plans" aria-label="プラン">
          {plans.map((p) => (
            <li key={p.id} className="k-ub-plan" data-current={p.current ? "true" : undefined}>
              <h3 className="k-ub-plan-name">
                {p.current ? <Badge tone="progress">いま</Badge> : null}
                {p.recommended ? <Badge tone="success">おすすめ</Badge> : null}
                <span>{p.name}</span>
                <span className="k-ub-plan-price">{p.price}</span>
              </h3>
              <p className="k-ub-plan-limit">{p.limit}</p>
              {p.current ? null : (
                <Button
                  className="k-ub-plan-act"
                  variant={p.recommended ? "primary" : "outlined"}
                  size="sm"
                  {...(onChoose ? { onClick: () => onChoose(p.id) } : {})}
                >
                  このプランにする
                </Button>
              )}
            </li>
          ))}
        </ul>
        <p className="k-ub-note">
          上げるとすぐ使える（今月の残り日数分だけ払う）。下げると次の請求日（{nextBill}
          ）から。人数が上限を超えるときは下げられない
        </p>
        <p className="k-ub-note">
          払い方：請求書払い（月末締め・翌月 1 日に出す・月末払い） ・ <TextLink href={billingHref}>請求書</TextLink> ・
          値段は仮 ・{" "}
          <span className="k-ub-inert" aria-disabled="true" tabIndex={-1} title="まだ使えません">
            カード払いは後のフェーズ
          </span>
        </p>
      </div>
    </Dialog>
  );
}

export interface PlanConfirmProps {
  plan: string;
  /** 上げる（既定）・下げる（K-962） */
  mode?: "up" | "down";
  /** 上げる：今月の残り日数・金額・請求書の日 */
  days?: number;
  amount?: string;
  due?: string;
  /** 下げる：変わる日（次の請求日） */
  from?: string;
  /** 答えを待っている間（K-962） */
  busy?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/** 上げる確かめ（今月の残り日数分・本人確認の取り直し）と、下げる確かめ（次の請求日から） */
export function PlanConfirm({
  plan,
  mode = "up",
  days,
  amount,
  due,
  from,
  busy = false,
  onConfirm,
  onCancel,
}: PlanConfirmProps) {
  const down = mode === "down";
  return (
    <Confirm
      open
      tone="primary"
      title={down ? `${plan} に下げる` : `${plan} に上げる`}
      description={
        down
          ? `次の請求日（${from}）から ${plan} になります。それまでは今のプランのまま使えます。`
          : `上げるとすぐ使えます。今月の残り ${days} 日分（${amount}）を、${due} に出す請求書に足します。`
      }
      confirmLabel={down ? "下げる" : "上げる"}
      busy={busy}
      onOpenChange={(o) => (o ? undefined : onCancel?.())}
      onConfirm={() => onConfirm?.()}
    >
      {down ? null : (
        <ol className="k-ub-steps">
          <li>このあと、本人確認をもう一度します（パスキーなど、ふだんのログインと同じ方法）</li>
          <li>確かめられると、プランが変わり、管理者全員にお知らせが届きます</li>
        </ol>
      )}
    </Confirm>
  );
}

export interface PlanBlockedProps {
  plan: string;
  limit: number;
  members: number;
  /** 「やめる」・× を押したとき（K-962） */
  onCancel?: () => void;
  /** 「メンバーを見る」の行き先（K-962） */
  membersHref?: string;
}

/** 下げられない（人数が上限を超える） */
export function PlanBlocked({ plan, limit, members, onCancel, membersHref }: PlanBlockedProps) {
  const router = useRouter();
  return (
    <Dialog
      open
      {...(onCancel ? { onOpenChange: (o: boolean) => (o ? undefined : onCancel()) } : {})}
      title="このプランには下げられません"
      subtitle={`${plan} は ${limit} 人まで`}
      actions={
        <>
          <Button variant="outlined" {...(membersHref ? { onClick: () => router.push(membersHref) } : {})}>
            メンバーを見る
          </Button>
          <Button variant="primary" disabled aria-disabled="true">
            このプランにする
          </Button>
        </>
      }
    >
      <div className="k-ub-form">
        <Callout tone="danger" title={`いまのメンバーは ${members} 人で、上限（${limit} 人）を超えています`}>
          先にメンバーを減らすか、いまのプランのままにしてください。減らして {limit} 人以内になると下げられます。
        </Callout>
      </div>
    </Dialog>
  );
}

export interface PriceChangeProps {
  line: string;
  change?: string;
  noticeDate?: string;
  /** 真なら頁の頭と区画を出さず、1 行の中身（.k-ub-setting）だけ（設定の画面の差し込み口に置く・K-962） */
  bare?: boolean;
  /** 「プランを変える」を押したとき（K-962） */
  onChangePlan?: () => void;
  /** 「請求書」の行き先（既定 /settings/billing） */
  billingHref?: string;
  /** 押せない形（権限が無い・D-145.9。隠さない） */
  disabled?: boolean;
}

/** 設定の「プランと支払い」の 1 行と、値段が変わる知らせ */
export function PriceChange({
  line,
  change,
  noticeDate,
  bare = false,
  onChangePlan,
  billingHref = "/settings/billing",
  disabled = false,
}: PriceChangeProps) {
  const body = (
    <div className="k-ub-setting">
      <div className="k-ub-setting-line">
        <span>{line}</span>
        {change ? <Badge tone="warning">変わる</Badge> : null}
      </div>
      {change ? (
        <p className="k-ub-change" role="status">
          {change}（お知らせ {noticeDate}）
        </p>
      ) : null}
      <Row>
        <Button
          variant="outlined"
          size="sm"
          {...(disabled ? { "aria-disabled": true, tabIndex: -1 } : onChangePlan ? { onClick: onChangePlan } : {})}
        >
          プランを変える
        </Button>
        {disabled ? (
          <span className="k-ub-inert" aria-disabled="true" tabIndex={-1}>
            請求書
          </span>
        ) : (
          <TextLink href={billingHref}>請求書</TextLink>
        )}
      </Row>
    </div>
  );
  if (bare) return body;
  return (
    <PageBody labelledBy="settings-title">
      <PageHeader id="settings-title" title="設定" sub="変えることがあるものだけ" />
      <div className="k-ub-top">
        <Section title="プランと支払い">{body}</Section>
      </div>
    </PageBody>
  );
}
