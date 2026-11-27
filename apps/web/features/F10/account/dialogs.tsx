"use client";
// 自分の設定の小窓とメールの確かめの先（メールを変える・抜ける・端末を切る）。キャンバス EdLeaveWs と、無い物は仮。
//   値を受け取って描くだけ。確かめの先は外枠の外の画面（F1 の verify-email と同じ入口の枠 AuthFrame・同じ部品）
import { useState } from "react";
import { Button, Callout, Confirm, Dialog, TextField } from "@/components/k";
import { SettingNote } from "@/components/k/setting-parts";
import { AuthFrame } from "@/features/F1/sign-up/frame";
import "./account.css";

const noop = () => undefined;

// ---------------------------------------------------------------- メールを変える
const MAIL_FORM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TAKEN = "sato@engine-base.example";

/** 打つと誤りが出る（形が違う・もう使われている）。start は最初に入っている字 */
export function EmailDialog({ start = "" }: { start?: string }) {
  const [text, setText] = useState(start);
  const msg =
    text === ""
      ? undefined
      : !MAIL_FORM.test(text)
        ? "メールの形が違います。「名前@会社.example」のように入れてください"
        : text.toLowerCase() === TAKEN
          ? "このメールは、もう別のアカウントで使われています。別のメールを入れてください"
          : undefined;
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="メールを変える"
      subtitle="新しいアドレスに確かめのメールを送ります。リンクを押すまでは、今のメールのままです"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>本人確認して送る</Button>
        </>
      }
    >
      <TextField label="今のメール" name="cur" defaultValue="takamoto@engine-base.example" readOnly />
      <TextField
        label="新しいメール"
        name="next"
        type="email"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="new@engine-base.example"
        error={msg}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------- 確かめのリンクを押した先（外枠の外の画面）
type Done = "changed" | "expired" | "used";
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
};

export function EmailDoneCard({ kind }: { kind: Done }) {
  const d = DONE[kind];
  return (
    <AuthFrame foot="help">
      <span className="k-auth-badge" data-tone={d.tone} aria-hidden="true">
        {d.badge}
      </span>
      <h1>{d.title}</h1>
      <Callout tone={d.tone === "warn" ? "warn" : "info"}>{d.text}</Callout>
      <a href="/account" className="k-btn" data-variant="primary" data-size="lg">
        {d.act}
      </a>
    </AuthFrame>
  );
}

// ---------------------------------------------------------------- ワークスペースから抜ける（キャンバス EdLeaveWs）
export type LeaveKind = "assigned" | "ready" | "last-admin";
const TICKETS = ["JD-201 ログイン画面の文言を直す", "JD-204 追加開発の見積"];

export function LeaveDialog({ kind }: { kind: LeaveKind }) {
  const stuck = kind !== "ready";
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="京蟻システム株式会社 から抜ける"
      subtitle={`あなたは ${kind === "last-admin" ? "管理者" : "メンバー"}`}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          {kind === "assigned" ? <Button variant="secondary">担当を渡しにいく</Button> : null}
          {kind === "last-admin" ? <Button variant="secondary">管理者を決めにいく</Button> : null}
          <Button variant="danger" disabled={stuck}>
            {kind === "assigned" ? "抜ける（渡し終わってから）" : "抜ける"}
          </Button>
        </>
      }
    >
      <p>
        抜けると、京蟻システム株式会社のチケット・ナレッジは見られなくなり、あなたの分身もそこでは動かなくなります。
      </p>
      {kind === "assigned" ? (
        <Callout tone="warn" title="担当しているチケット 2 件">
          {TICKETS.map((t) => (
            <div key={t}>{t}</div>
          ))}
          抜ける前に、ほかの人に渡してください（受けてもらうまで抜けられない）
        </Callout>
      ) : null}
      {kind === "ready" ? <Callout>担当しているチケットはありません。このまま抜けられます</Callout> : null}
      {kind === "last-admin" ? (
        <Callout tone="danger" title="最後の管理者です">
          あなたはこのワークスペースの最後の管理者です。ほかの人を管理者にしてから、抜けてください
        </Callout>
      ) : null}
      <p>あなたの分身が 京蟻システム株式会社 で覚えたことは、抜けるとすべて消えます（消えたものは戻りません）</p>
      <SettingNote>
        京蟻システム株式会社
        のワークスペースに残るのは、あなたが書いたやり取り・決定ログだけ。抜けたあとでも、招待されればまた入れる
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
