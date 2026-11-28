"use client";
// 1 社の小窓と帯（段 13・領域 ops・キャンバス OpPeek・OpStop）：中を見る・中を見ている間・止める・お知らせを送る。値を受け取って描くだけ
//   K-972：値と関数（value・onChange・onSubmit・busy・error）を任意の props で受ける。渡さない呼び方（モック）は今の見た目のまま
import { Fingerprint } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { Band, Button, Callout, Dialog, Select, TextArea, TextField } from "@/components/k";
import { Bullets, Card, Note, RadioChoice } from "./ops-parts";
import { STOP_REASONS } from "./ops-sample";

const noop = () => undefined;

/** 小窓の中の赤い箱（口が断った・送れなかった） */
function DialogError({ error }: { error?: string | null | undefined }) {
  return error ? <Callout tone="danger">{error}</Callout> : null;
}
/** ラジオの組の変わり目（RadioChoice は押す関数を持たないので、組の欄で受ける） */
const radioValue = (e: FormEvent<HTMLFieldSetElement>): string | null => {
  const t = e.target as HTMLInputElement;
  return t.type === "radio" && t.checked ? t.value : null;
};

const PEEK_SAMPLE_REASONS = [
  { value: "inquiry", label: "問い合わせ「承認したのに動かない」（湊 さくら・11/02）" },
  { value: "incident", label: "障害の調べ" },
  { value: "billing", label: "請求の確認" },
  { value: "other", label: "ほか（書く）" },
];

export interface PeekDialogValue {
  choice: string;
  minutes: number;
  other: string;
}
export interface PeekDialogProps {
  onClose?: () => void;
  /** 頭の下の対象（会社の名前） */
  target?: string;
  /** 理由の選び肢（その会社の済みでない問い合わせ・障害の調べ・請求の確認・ほか） */
  reasons?: { value: string; label: string }[];
  value?: PeekDialogValue;
  onChange?: (v: PeekDialogValue) => void;
  onSubmit?: () => void;
  busy?: boolean;
  error?: string | null;
}

/** 中を見る小窓：理由・見る時間・できること・本人確認 */
export function PeekDialog({
  onClose = noop,
  target = "合同会社ミナト企画",
  reasons = PEEK_SAMPLE_REASONS,
  value,
  onChange = noop,
  onSubmit = noop,
  busy = false,
  error,
}: PeekDialogProps) {
  const controlled = value !== undefined;
  const ready = !controlled || value.choice !== "other" || value.other.trim() !== "";
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="中を見る"
      target={target}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button icon={<Fingerprint size={14} />} loading={busy} disabled={!ready} onClick={onSubmit}>
            見るだけで開く
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        <Select
          label="理由"
          name="reason"
          {...(controlled
            ? { value: value.choice, onValueChange: (v) => onChange({ ...value, choice: v ?? value.choice }) }
            : { defaultValue: "inquiry" })}
          description="問い合わせを選ぶか、書く（障害の調べ・請求の確認 など）"
          options={reasons}
        />
        {controlled && value.choice === "other" ? (
          <TextField
            label="ほかの理由"
            name="other"
            maxLength={200}
            value={value.other}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, other: e.target.value })}
          />
        ) : null}
        <Select
          label="見る時間"
          name="minutes"
          {...(controlled
            ? {
                value: String(value.minutes),
                onValueChange: (v) => onChange({ ...value, minutes: Number(v ?? value.minutes) }),
              }
            : { defaultValue: "60" })}
          options={[
            { value: "30", label: "30 分" },
            { value: "60", label: "1 時間" },
          ]}
        />
        <div className="k-op-form-group">
          <b>できること</b>
          <Bullets
            label="見るだけで できること"
            items={[
              "見るだけ（何も変えられない）",
              "規約で先に許可をもらっているので、顧客に聞かずに開ける",
              "誰が・いつ・何を見たか・理由は、運営の記録と顧客のワークスペースの記録の両方に残る",
              "預けたログイン情報の値は運営にも見えない",
              "見ている間は画面のいちばん上に帯が出る",
            ]}
          />
        </div>
        <Callout tone="info">開く前に本人確認を取り直します（パスキー）</Callout>
        <DialogError error={error} />
      </div>
    </Dialog>
  );
}

export interface PeekBandProps {
  title?: string;
  /** 「残り 38 分」 */
  rest?: string;
  /** 開いたときの理由（分からなければ出さない） */
  reason?: string | null;
  onClose?: () => void;
  busy?: boolean;
}

/** 中を見ている間の帯（外枠の banner に渡す）：残り時間・閉じる */
export function PeekBand({
  title = "合同会社ミナト企画 の中を見ています（見るだけ）",
  rest = "残り 38 分",
  reason = "問い合わせ「承認したのに動かない」",
  onClose = noop,
  busy = false,
}: PeekBandProps) {
  return (
    <Band
      tone="info"
      title={title}
      sub={`${rest}${reason ? ` ・ 理由：${reason}` : ""}。何も変えられません。見たことは運営の記録と顧客の記録に残ります`}
      acts={
        <Button size="sm" variant="outlined" loading={busy} onClick={onClose}>
          閉じる
        </Button>
      }
    />
  );
}

/** 中を見ている間に見られる物（見るだけ。開く行は押せない形） */
export function PeekPanel() {
  const rows = [
    ["チケット", "4 件（承認待ちの 1 件を含む）"],
    ["承認待ち", "「請求書の送付先を変えて送る」湊さんの分身が待っている"],
    ["分身の実行の記録", "湊さんの分身 ・ 11/02 09:12 の実行が止まった"],
  ] as const;
  return (
    <Card title="いま見られる物（見るだけ）" aside="預けたログイン情報の値は運営にも見えない">
      <ul className="k-op-reasons">
        {rows.map(([k, v]) => (
          <li key={k}>
            <span className="k-op-reason-text">
              <b>{k}</b>
              <span>{v}</span>
            </span>
            <Button size="sm" variant="outlined" aria-disabled="true" tabIndex={-1} title="まだ使えません">
              開く（見るだけ）
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export interface StopDialogValue {
  reason: string;
  mode: "scheduled" | "now";
  stopOn: string;
  notice: string;
  note: string;
}
export interface StopDialogProps {
  onClose?: () => void;
  target?: string;
  value?: StopDialogValue;
  onChange?: (v: StopDialogValue) => void;
  onSubmit?: () => void;
  /** 押すボタンの字（「11/09 に止める」・「すぐ止める」） */
  submitLabel?: string;
  /** 「先に知らせて…」の下の字（「管理者にお知らせが出る ・ 止める日 11/09（7 日後）」） */
  laterDesc?: string;
  /** 選んだ理由ですぐ止められるか（規約に反する・危ないときだけ） */
  canNow?: boolean;
  /** 止める日の欄の一番前の日（明日・YYYY-MM-DD） */
  minDate?: string;
  /** 送れる形か（押せない形にする） */
  ready?: boolean;
  busy?: boolean;
  error?: string | null;
}

/** 止める小窓：理由・いつ止めるか・管理者への知らせ・止めると */
export function StopDialog({
  onClose = noop,
  target = "合同会社ミナト企画 ・ 8 人",
  value,
  onChange = noop,
  onSubmit = noop,
  submitLabel = "11/09 に止める",
  laterDesc = "管理者にお知らせが出る ・ 止める日 11/09（7 日後）",
  canNow = true,
  minDate,
  ready = true,
  busy = false,
  error,
}: StopDialogProps) {
  const controlled = value !== undefined;
  const later = !controlled || value.mode === "scheduled";
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="止める"
      target={target}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button variant="danger" loading={busy} disabled={!ready} onClick={onSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        <Select
          label="理由"
          name="reason"
          {...(controlled
            ? { value: value.reason, onValueChange: (v) => onChange({ ...value, reason: v ?? value.reason }) }
            : { defaultValue: "unpaid" })}
          options={[...STOP_REASONS]}
        />
        <fieldset
          className="k-op-fieldset"
          key={controlled ? `can-now-${canNow}` : "mock"}
          onChange={(e) => {
            const v = controlled ? radioValue(e) : null;
            if (controlled && v) onChange({ ...value, mode: v === "now" ? "now" : "scheduled" });
          }}
        >
          <legend>いつ止めるか</legend>
          <RadioChoice
            name="when"
            value="later"
            checked={later}
            title="先に知らせて、日を決めて止める"
            desc={laterDesc}
          />
          <RadioChoice
            name="when"
            value="now"
            checked={!later}
            disabled={!canNow}
            title="すぐ止める"
            desc="規約に反する・危ないときだけ"
          />
        </fieldset>
        {controlled ? (
          <TextField
            label="止める日"
            name="date"
            type="date"
            value={value.stopOn}
            min={minDate}
            disabled={!later}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, stopOn: e.target.value })}
          />
        ) : (
          <TextField label="止める日" name="date" type="date" defaultValue="2026-11-09" readOnly />
        )}
        {controlled ? (
          <TextArea
            label="管理者へのお知らせ"
            name="notice"
            rows={4}
            maxLength={2000}
            value={value.notice}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ ...value, notice: e.target.value })}
          />
        ) : (
          <TextArea
            label="管理者へのお知らせ"
            name="notice"
            rows={4}
            readOnly
            defaultValue="10 月分の請求書（¥16,500・期限 11/30）のお支払いが確かめられていません。11/09 までに確かめられない場合、ワークスペースを止めます。"
          />
        )}
        <div className="k-op-form-group">
          <b>止めると</b>
          <Bullets
            label="止めると どうなるか"
            items={[
              "止めた後にメンバーが入ると、止められた画面になる（理由・問い合わせ先・「問い合わせる」だけ使える）",
              "分身の実行も止まる。実行待ちのものは消さずに残す",
              "チケット・記録・分身の記憶はそのまま残る。再開すれば元に戻る",
            ]}
          />
        </div>
        <Note>止めるのは「止める」ができる運営の人だけ・記録に残る</Note>
        <DialogError error={error} />
      </div>
    </Dialog>
  );
}

export interface NoticeDialogValue {
  title: string;
  body: string;
  where: string;
  to: "all" | "admins";
}
export interface NoticeDialogProps {
  onClose?: () => void;
  target?: string;
  value?: NoticeDialogValue;
  onChange?: (v: NoticeDialogValue) => void;
  onSubmit?: () => void;
  /** 送れる形か（題か本文が空のうちは押せない） */
  ready?: boolean;
  busy?: boolean;
  error?: string | null;
}

const WHERE_OPTIONS = [
  { value: "band", label: "画面の上の帯" },
  { value: "list", label: "お知らせの一覧" },
  { value: "both", label: "どちらも" },
];

/** 1 社にお知らせを送る小窓（この 1 社の人だけに届く） */
export function NoticeDialog({
  onClose = noop,
  target = "合同会社ミナト企画 ・ 8 人",
  value,
  onChange = noop,
  onSubmit = noop,
  ready = true,
  busy = false,
  error,
}: NoticeDialogProps) {
  const controlled = value !== undefined;
  const adminsOnly = controlled && value.to === "admins";
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="お知らせを送る"
      target={target}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button loading={busy} disabled={!ready} onClick={onSubmit}>
            送る
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        {controlled ? (
          <>
            <TextField
              label="題"
              name="title"
              maxLength={100}
              description="100 字まで"
              value={value.title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, title: e.target.value })}
            />
            <TextArea
              label="本文"
              name="body"
              rows={5}
              maxLength={4000}
              value={value.body}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ ...value, body: e.target.value })}
            />
          </>
        ) : (
          <>
            <TextField
              label="題"
              name="title"
              defaultValue="請求書の宛名のご確認"
              readOnly
              maxLength={100}
              description="100 字まで"
            />
            <TextArea
              label="本文"
              name="body"
              rows={5}
              readOnly
              defaultValue="10 月分の請求書の宛名を、ご依頼のとおり「経理 ご担当」に変えました。届いたメールをご確認ください。"
            />
          </>
        )}
        <Select
          label="出す場所"
          name="where"
          {...(controlled
            ? { value: value.where, onValueChange: (v) => onChange({ ...value, where: v ?? value.where }) }
            : { defaultValue: "band" })}
          options={WHERE_OPTIONS.map((o) => (adminsOnly && o.value !== "list" ? { ...o, disabled: true } : o))}
        />
        <fieldset
          className="k-op-fieldset"
          onChange={(e) => {
            const v = controlled ? radioValue(e) : null;
            if (controlled && v) onChange({ ...value, to: v === "admins" ? "admins" : "all" });
          }}
        >
          <legend>誰に</legend>
          <RadioChoice name="to" value="all" checked={!adminsOnly} title="この会社の人みんな" />
          <RadioChoice
            name="to"
            value="admins"
            checked={adminsOnly}
            title="管理者だけ"
            desc="管理者だけのお知らせは、お知らせの一覧にだけ出ます（上の帯には出しません）"
          />
        </fieldset>
        <Note>
          この会社の人だけに届きます。すべての顧客に出すお知らせは「お知らせ」から作ります。送ったことは運営の記録に残ります
        </Note>
        <DialogError error={error} />
      </div>
    </Dialog>
  );
}
