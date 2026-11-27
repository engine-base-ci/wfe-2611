"use client";
// 届いた依頼の小窓：チケットを作る・断る（理由を返す）・返事を送って詳しく聞く。キャンバスには小窓の絵が無い（ボタンの字だけ）ので、字は仮。値を渡して描くだけ
//   本物の画面は live（開け閉め・送る・押している間・失敗の知らせ）を渡す（K-898）。渡さなければ下絵の見本
import { useState } from "react";
import { Badge, Button, Callout, Dialog, Select, TextArea, TextField } from "@/components/k";
import "../choice.css";
import "./requests.css";

const noop = () => undefined;

/** 本物の画面が渡す小窓の動き（K-898）。口は呼ばない：送る・閉じるの結果は画面の入れ物が決める */
export interface LiveDialog {
  open: boolean;
  onClose: () => void;
  /** 書いた字を渡す（空のときは呼ばない） */
  onSubmit: (text: string) => void;
  /** 小窓の頭の字（依頼の題・ゲストのグループ・誰から） */
  target: string;
  /** 答えを待っている間（送るを押せない・やめるを押せない） */
  busy?: boolean;
  /** 送れなかった等の知らせ（見出しと本文。片方だけでもよい） */
  failure?: { title?: string; body?: string } | null;
  /** 欄の初めの値 */
  initial?: string;
}

interface TextDialogSpec {
  title: string;
  field: { name: string; label: string; rows: number; description: string; empty: string };
  submit: string;
  danger?: boolean;
  footnote?: boolean;
}

/** 書いて送る小窓（断る・返事を送る）の本物の形。空なら誤りを出して送らない。失敗しても書いた字は残る */
function LiveTextDialog({ live, spec }: { live: LiveDialog; spec: TextDialogSpec }) {
  const [text, setText] = useState(live.initial ?? "");
  const [empty, setEmpty] = useState(false);
  const busy = Boolean(live.busy);
  const submit = () => {
    if (busy) return;
    if (text.trim() === "") {
      setEmpty(true);
      return;
    }
    live.onSubmit(text);
  };
  return (
    <Dialog
      open={live.open}
      onOpenChange={(o) => {
        if (!o && !busy) live.onClose();
      }}
      title={spec.title}
      target={live.target}
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={live.onClose}>
            やめる
          </Button>
          <Button {...(spec.danger ? { variant: "danger" as const } : {})} loading={busy} onClick={submit}>
            {spec.submit}
          </Button>
        </>
      }
    >
      {live.failure ? (
        <Callout tone="danger" {...(live.failure.title ? { title: live.failure.title } : {})}>
          {live.failure.body ?? null}
        </Callout>
      ) : null}
      <TextArea
        name={spec.field.name}
        label={spec.field.label}
        required
        rows={spec.field.rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() !== "") setEmpty(false);
        }}
        error={empty ? spec.field.empty : undefined}
        description={spec.field.description}
      />
      {spec.footnote ? (
        <p className="k-f11c-sub-text">
          <Badge tone="progress">先方に見える</Badge> 断った依頼は「さばいたもの」に移ります。
        </p>
      ) : null}
    </Dialog>
  );
}

const DECLINE: TextDialogSpec = {
  title: "この依頼を断る",
  field: {
    name: "decline-reason",
    label: "先方に返す理由",
    rows: 4,
    description: "この理由は先方に見えます。",
    empty: "理由を書いてください（先方に届きます）",
  },
  submit: "断る",
  danger: true,
  footnote: true,
};
const ASK: TextDialogSpec = {
  title: "返事を送って詳しく聞く",
  field: {
    name: "ask-body",
    label: "先方に送る返事",
    rows: 5,
    description: "先方の返事が来るまで、この依頼は「聞いている」に入ります。",
    empty: "送る返事を書いてください",
  },
  submit: "送る",
};

export function DeclineDialog({
  phase = "input",
  live,
}: {
  phase?: "input" | "error" | "saving" | "failed";
  live?: LiveDialog;
}) {
  if (live) return <LiveTextDialog live={live} spec={DECLINE} />;
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="この依頼を断る"
      target="12 月分の作業報告書もほしい ・ セイコー ・ 鈴木 様"
      actions={
        <>
          <Button variant="outlined" disabled={phase === "saving"}>
            やめる
          </Button>
          <Button variant="danger" loading={phase === "saving"}>
            断る
          </Button>
        </>
      }
    >
      {phase === "failed" ? (
        <Callout tone="danger" title="断れませんでした">
          もう一度押してください。書いた理由は、この小窓に残っています。
        </Callout>
      ) : null}
      <TextArea
        name="decline-reason"
        label="先方に返す理由"
        required
        rows={4}
        defaultValue={
          phase === "error"
            ? ""
            : "作業報告書は四半期ごとにまとめてお送りしているため、12 月分だけではお出しできません。1 月に 10〜12 月分をまとめてお送りします。"
        }
        error={phase === "error" ? "理由を書いてください（先方に届きます）" : undefined}
        description="この理由は先方に見えます。"
      />
      <p className="k-f11c-sub-text">
        <Badge tone="progress">先方に見える</Badge> 断った依頼は「さばいたもの」に移ります。
      </p>
    </Dialog>
  );
}

export function AskDialog({ phase = "input", live }: { phase?: "input" | "error" | "saving"; live?: LiveDialog }) {
  if (live) return <LiveTextDialog live={live} spec={ASK} />;
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="返事を送って詳しく聞く"
      target="12 月分の作業報告書もほしい ・ セイコー ・ 鈴木 様"
      actions={
        <>
          <Button variant="outlined" disabled={phase === "saving"}>
            やめる
          </Button>
          <Button loading={phase === "saving"}>送る</Button>
        </>
      }
    >
      <TextArea
        name="ask-body"
        label="先方に送る返事"
        required
        rows={5}
        defaultValue={
          phase === "error"
            ? ""
            : "鈴木様 承知しました。報告書の形は 11 月分と同じでよいでしょうか。宛先は山田様か鈴木様か、教えてください。"
        }
        error={phase === "error" ? "送る返事を書いてください" : undefined}
        description="先方の返事が来るまで、この依頼は「聞いている」に入ります。"
      />
    </Dialog>
  );
}

export type CreatePhase = "input" | "bad" | "saving" | "failed";

/** 届いた依頼から「チケットを作る」小窓。題・本文は依頼から入る。期限・担当など必須の欄は社内が入れる（ゲストには見えない）。
 *  見せる相手は依頼を出したゲストのグループが最初から入っている。普通のチケットを作るだけで、違いは依頼のやり取りがチャットの頭に残ること */
export function CreateTicketDialog({ phase = "input" }: { phase?: CreatePhase }) {
  const bad = phase === "bad";
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="チケットを作る"
      target="12 月分の作業報告書もほしい ・ 鈴木 様"
      actions={
        <>
          <Button variant="outlined" disabled={phase === "saving"}>
            やめる
          </Button>
          <Button loading={phase === "saving"}>作る</Button>
        </>
      }
    >
      {phase === "failed" ? (
        <Callout tone="danger" title="チケットを作れませんでした">
          もう一度押してください。入れた内容は、この小窓に残っています。
        </Callout>
      ) : null}
      <TextField name="tk-title" label="題" required defaultValue="セイコー様 12 月分の作業報告書を作って送る" />
      <TextArea
        name="tk-body"
        label="本文"
        rows={3}
        defaultValue="11 月分と同じ形で、12 月分の作業報告書をお送りする。年内に先方の社内に回したいとのこと。"
      />
      <Select
        label="担当"
        name="tk-owner"
        required
        placeholder="担当の人を選ぶ"
        {...(bad ? {} : { defaultValue: "takamoto" })}
        options={[
          { value: "takamoto", label: "高本 聖斗" },
          { value: "sato", label: "佐藤 花子" },
          { value: "kimura", label: "木村 翔" },
        ]}
        error={bad ? "担当の人を選んでください" : undefined}
      />
      <TextField
        name="tk-due"
        label="期限"
        required
        placeholder="例：12/26"
        {...(bad ? {} : { defaultValue: "12/26" })}
        error={bad ? "期限を入れてください" : undefined}
      />
      <Select
        label="グループ"
        name="tk-group"
        defaultValue="eg"
        options={[
          { value: "eg", label: "営業（EG）" },
          { value: "jd", label: "受託開発（JD）" },
          { value: "kr", label: "経理（KR）" },
        ]}
      />
      <div className="k-f11c-fieldset">
        <span className="k-label">ゲストに見せる相手</span>
        <ul className="k-f11v-vis" aria-label="見せる相手">
          <li>
            <label>
              <input type="checkbox" defaultChecked />
              <span>
                セイコー株式会社（ゲスト）
                <span className="k-f11c-sub-text">依頼を出したゲストのグループ。最初から入っている</span>
              </span>
            </label>
          </li>
        </ul>
      </div>
      <p className="k-f11c-sub-text">
        <Badge tone="progress">ゲストに見える</Badge>{" "}
        題・本文・詳細・チャットと、段の札だけ。担当・期限などはゲストに見えません。
        依頼のやり取りは、チケットのチャットの頭に残ります。
      </p>
    </Dialog>
  );
}
