"use client";
// 自分の設定の小窓とメールの確かめの先（メールを変える・抜ける・端末を切る）。キャンバス EdLeaveWs と、無い物は仮。
//   値を受け取って描くだけ。確かめの先は外枠の外の画面（F1 の verify-email と同じ入口の枠 AuthFrame・同じ部品）
import { useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, Callout, Confirm, Dialog, TextField } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { SettingNote } from "@/components/k/setting-parts";
import { AuthFrame } from "@/features/F1/sign-up/frame";
import "./account.css";

const noop = () => undefined;

// ---------------------------------------------------------------- メールを変える
const MAIL_FORM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TAKEN = "sato@engine-base.example";

/** 本番（K-840）が渡す値と操作。どれも任意で、渡さなければモックの見た目と動きのまま */
export interface EmailDialogProps {
  /** 最初に入っている字（モック） */
  start?: string;
  /** 打った字（渡すと親が持つ） */
  value?: string;
  onChange?: (text: string) => void;
  /** 欄の下の誤り（形・使われている・同じ） */
  error?: string;
  /** 小窓の中の赤い箱（送りすぎ・送れなかった・調子が悪い） */
  notice?: ReactNode;
  /** 答えを待っている間（主ボタンが処理中・閉じない） */
  busy?: boolean;
  onSend?: () => void;
  onCancel?: () => void;
  /** 今のメール */
  current?: string;
}

/** 打つと誤りが出る（形が違う・もう使われている）。start は最初に入っている字 */
export function EmailDialog({
  start = "",
  value,
  onChange,
  error,
  notice,
  busy = false,
  onSend,
  onCancel,
  current = "takamoto@engine-base.example",
}: EmailDialogProps) {
  const [own, setOwn] = useState(start);
  const live = value !== undefined;
  const text = live ? value : own;
  const msg = live
    ? error
    : text === ""
      ? undefined
      : !MAIL_FORM.test(text)
        ? "メールの形が違います。「名前@会社.example」のように入れてください"
        : text.toLowerCase() === TAKEN
          ? "このメールは、もう別のアカウントで使われています。別のメールを入れてください"
          : undefined;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) (onCancel ?? noop)();
      }}
      title="メールを変える"
      subtitle="新しいアドレスに確かめのメールを送ります。リンクを押すまでは、今のメールのままです"
      actions={
        <>
          <Button variant="outlined" onClick={onCancel} disabled={busy}>
            やめる
          </Button>
          <Button onClick={onSend} loading={busy}>
            本人確認して送る
          </Button>
        </>
      }
    >
      <TextField label="今のメール" name="cur" defaultValue={current} readOnly />
      <TextField
        label="新しいメール"
        name="next"
        type="email"
        value={text}
        onChange={(e) => (live ? onChange?.(e.target.value) : setOwn(e.target.value))}
        placeholder="new@engine-base.example"
        error={msg}
      />
      {notice ? <Callout tone="danger">{notice}</Callout> : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------- 確かめのリンクを押した先（外枠の外の画面）
//   unusable（使えない・印が無い）は K-840 が足した仮の形（下絵の 3 枚は変えない）。本文は正本 E-PAGE-006 の文
type Done = "changed" | "expired" | "used" | "unusable";
const DONE: Record<Done, { badge: string; tone: "ok" | "warn"; title: string; text: string; act: string }> = {
  changed: {
    badge: "✓",
    tone: "ok",
    title: "メールを変えました",
    text: "これからは新しいメールで入れます。知らせも新しいメールに届きます",
    act: "自分の設定へ戻る",
  },
  expired: {
    badge: "期",
    tone: "warn",
    title: "リンクの期限が切れました",
    text: "確かめのメールのリンクは、送ってから一定の時間で切れます。自分の設定からもう一度メールを変えてください",
    act: "自分の設定へ戻る",
  },
  used: {
    badge: "済",
    tone: "ok",
    title: "このリンクはもう使いました",
    text: "メールはすでに変わっています。もう一度押す必要はありません",
    act: "自分の設定へ戻る",
  },
  unusable: {
    badge: "✕",
    tone: "warn",
    title: "このリンクは使えません",
    text: CATALOG[PAGE_ERROR.linkExpired]?.message ?? "",
    act: "自分の設定へ戻る",
  },
};

/** text は本文の差し替え（本番が口の文を出すとき・任意） */
export function EmailDoneCard({ kind, text }: { kind: Done; text?: string }) {
  const d = DONE[kind];
  return (
    <AuthFrame foot="help">
      <span className="k-auth-badge" data-tone={d.tone} aria-hidden="true">
        {d.badge}
      </span>
      <h1>{d.title}</h1>
      <Callout tone={d.tone === "warn" ? "warn" : "info"}>{text ?? d.text}</Callout>
      <a href="/account" className="k-btn" data-variant="primary" data-size="lg">
        {d.act}
      </a>
    </AuthFrame>
  );
}

// ---------------------------------------------------------------- ワークスペースから抜ける（キャンバス EdLeaveWs）
export type LeaveKind = "assigned" | "ready" | "last-admin";
const SAMPLE_NAME = "京蟻システム株式会社";
const SAMPLE_TICKETS: readonly { number: string; title: string }[] = [
  { number: "JD-201", title: "ログイン画面の文言を直す" },
  { number: "JD-204", title: "追加開発の見積" },
];

/** 本番が渡す値（K-841）。渡さない呼び方（モック）は見本の字のまま */
export interface LeaveDialogProps {
  kind: LeaveKind;
  /** 会社の名前（同じ字で題・説明・注に出す） */
  name?: string;
  /** サブの「あなたは …」の役割の字 */
  role?: string;
  /** 担当しているチケット（口の先頭 10 件） */
  tickets?: readonly { number: string; title: string }[];
  /** 一覧に出ない残りの件数（「ほか N 件」） */
  more?: number;
  onLeave?: () => void;
  onCancel?: () => void;
  /** 抜ける口の答えを待つ間 */
  busy?: boolean;
  /** 小窓の中の赤い箱の字 */
  error?: string;
  /** 切り替えの口の答えを待つ間（渡しにいく・決めにいく・抜けるを押せない） */
  goBusy?: boolean;
  onGoTickets?: () => void;
  onGoAdmin?: () => void;
}

export function LeaveDialog({
  kind,
  name = SAMPLE_NAME,
  role,
  tickets = SAMPLE_TICKETS,
  more = 0,
  onLeave,
  onCancel,
  busy = false,
  error,
  goBusy = false,
  onGoTickets,
  onGoAdmin,
}: LeaveDialogProps) {
  const stuck = kind !== "ready";
  const waiting = busy || goBusy;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !waiting) (onCancel ?? noop)();
      }}
      title={`${name} から抜ける`}
      subtitle={`あなたは ${role ?? (kind === "last-admin" ? "管理者" : "メンバー")}`}
      actions={
        <>
          <Button variant="outlined" disabled={waiting} onClick={onCancel}>
            やめる
          </Button>
          {kind === "assigned" ? (
            <Button variant="secondary" disabled={busy} loading={goBusy} onClick={onGoTickets}>
              担当を渡しにいく
            </Button>
          ) : null}
          {kind === "last-admin" ? (
            <Button variant="secondary" disabled={busy} loading={goBusy} onClick={onGoAdmin}>
              管理者を決めにいく
            </Button>
          ) : null}
          <Button variant="danger" disabled={stuck || goBusy} loading={busy} onClick={onLeave}>
            {kind === "assigned" ? "抜ける（渡し終わってから）" : "抜ける"}
          </Button>
        </>
      }
    >
      <p>抜けると、{name}のチケット・ナレッジは見られなくなり、あなたの分身もそこでは動かなくなります。</p>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {kind === "assigned" ? (
        <Callout tone="warn" title={`担当しているチケット ${tickets.length + more} 件`}>
          {tickets.map((t) => (
            <div key={t.number}>{`${t.number} ${t.title}`}</div>
          ))}
          {more > 0 ? <div>{`ほか ${more} 件`}</div> : null}
          抜ける前に、ほかの人に渡してください（受けてもらうまで抜けられない）
        </Callout>
      ) : null}
      {kind === "ready" ? <Callout>担当しているチケットはありません。このまま抜けられます</Callout> : null}
      {kind === "last-admin" ? (
        <Callout tone="danger" title="最後の管理者です">
          あなたはこのワークスペースの最後の管理者です。ほかの人を管理者にしてから、抜けてください
        </Callout>
      ) : null}
      <p>{`あなたの分身が ${name} で覚えたことは、抜けるとすべて消えます（消えたものは戻りません）`}</p>
      <SettingNote>
        {`${name} のワークスペースに残るのは、あなたが書いたやり取り・決定ログだけ。抜けたあとでも、招待されればまた入れる`}
      </SettingNote>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 端末を切る確かめ（仮・足は「本人確認して切る」）
export function RevokeConfirm({
  all,
  open,
  onOpenChange,
}: {
  all: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={noop}
      confirmLabel="本人確認して切る"
      title={all ? "この端末以外をすべて切ります" : "Windows ・ Edge を切ります"}
      description={
        all
          ? "iPhone ・ Kaname アプリと Windows ・ Edge が切れます。この端末はそのまま使えます。切れた端末は、入り直すまで使えません"
          : "大阪で 10/30 に入った端末です。切ると、この端末は入り直すまで使えません。覚えがなければ、パスワードかパスキーも見直してください"
      }
    />
  );
}
