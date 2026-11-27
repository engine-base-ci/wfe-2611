"use client";
// 依頼を出す（キャンバス CpNew）と、依頼のやり取り。値は見本を受け取って描くだけ（口は呼ばない）。
//   担当の分身が聞く所は、担当の PC がつながっている時点（PS2）だけ。閉じている時点（PS0）は依頼がそのまま届く文にする。
//   キャンバスに絵が無い（入力の誤り・添付の断り・出している間・出せなかった・出したあと・やり取り・受けた／断られた帯）の字は仮
import { Badge, Band, BandLine, Button, Callout, Empty, Select, TextArea } from "@/components/k";
import "./portal.css";

export type NewPhase = "input" | "empty" | "attach-bad" | "saving" | "failed" | "sent";

const BODY = "来年 1 月から請求書の宛先を経理部の佐野に変えたいです";

export function NewRequestForm({ ps, phase = "input" }: { ps: "PS0" | "PS2"; phase?: NewPhase }) {
  if (phase === "sent") {
    return (
      <Empty title="依頼を出しました" icon="✓" action={<Button variant="primary">やり取りに戻る</Button>}>
        ENGINE BASE に届きました。返事が来たら、この場所とメールでお知らせします。
      </Empty>
    );
  }
  const bad = phase === "empty";
  return (
    <div className="k-f11p-form">
      {phase === "failed" ? (
        <Callout tone="danger" title="依頼を出せませんでした">
          もう一度押してください。書いた内容は、この画面に残っています。
        </Callout>
      ) : null}
      <TextArea
        name="body"
        label="何をしてほしいか"
        required
        rows={4}
        {...(bad ? {} : { defaultValue: BODY })}
        error={bad ? "何をしてほしいかを書いてください" : undefined}
      />
      {ps === "PS2" ? (
        <div className="k-f11p-ai">
          <span className="k-f11p-ai-mark" aria-hidden="true">
            AI
          </span>
          <span className="k-f11p-ai-text">
            <span>
              伝わりやすくするために、ひとつ教えてください：<b>佐野様のメールアドレス</b>と、
              <b>CC は今と同じ鈴木様のままでよいか</b>。
            </span>
            <small>
              ENGINE BASE の AI
              が聞いています。答えなくても出せます（担当が席にいないときは、あとで依頼のやり取りで聞きます）
            </small>
          </span>
        </div>
      ) : (
        <div className="k-f11p-ai" aria-disabled="true">
          <span className="k-f11p-ai-text">
            <span>いまは担当の席が閉じているので、ここでは聞き返しません。</span>
            <small>依頼はそのまま担当に届きます。足りないことがあれば、あとで依頼のやり取りで聞きます</small>
          </span>
        </div>
      )}
      <div className="k-f11p-two">
        <Select
          label="いつまでに（任意）"
          name="due"
          defaultValue="1220"
          options={[
            { value: "1220", label: "12/20" },
            { value: "1226", label: "12/26" },
            { value: "none", label: "決めない" },
          ]}
        />
        <div className="k-f11p-attach">
          <span className="k-label">添付（任意）</span>
          {phase === "attach-bad" ? (
            <>
              <Callout tone="danger" title="このファイルは足せませんでした">
                ファイルが大きすぎるか、足せない種類です。小さくするか別の形にして、もう一度足してください。
              </Callout>
              <div className="k-f11p-file" data-bad="true">
                <span>議事メモ.exe</span>
                <span className="k-f11p-row-meta">足せない種類のファイルです</span>
              </div>
            </>
          ) : null}
          <div>
            <Button variant="outlined" size="sm">
              ＋ ファイルを足す
            </Button>
          </div>
        </div>
      </div>
      <p className="k-f11p-note">この依頼は、セイコー株式会社（ゲスト）の皆さんと ENGINE BASE に見えます。</p>
      <div className="k-f11p-acts">
        <Button variant="primary" loading={phase === "saving"}>
          依頼を出す
        </Button>
      </div>
    </div>
  );
}

export type ThreadKind = "reply" | "accepted" | "declined";

export function Msg({
  from,
  name,
  when,
  children,
}: {
  from: "they" | "we";
  name: string;
  when: string;
  children: string;
}) {
  return (
    <div className="k-f11p-msg" data-from={from}>
      <span className="k-f11p-av" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <div className="k-f11p-msg-body">
        <span className="k-f11p-msg-name">
          {name} ・ {when}
        </span>
        <p className="k-f11p-msg-text">{children}</p>
      </div>
    </div>
  );
}

/** 依頼のやり取り（先方が読み書きする）。受けた・断られた帯は仮 */
export function RequestThread({ kind = "reply" }: { kind?: ThreadKind }) {
  return (
    <>
      <div className="k-f11p-titlebar">
        <h1>12 月分の作業報告書もほしい</h1>
        <Badge tone={kind === "accepted" ? "success" : kind === "declined" ? "danger" : "neutral"}>
          {kind === "accepted" ? "受けました" : kind === "declined" ? "受けられませんでした" : "返事あり"}
        </Badge>
      </div>
      <p className="k-f11p-sub">鈴木 健太 様が今日 10:20 に出した ・ セイコー株式会社（ゲスト）の皆さんにも見えます</p>
      {kind === "accepted" ? (
        <Band
          tone="ok"
          title="ENGINE BASE が依頼を受けました"
          sub="チケットになりました。ホームの「見せてもらったチケット」から開けます。このやり取りは、チケットのやり取りの頭に残ります"
        />
      ) : null}
      {kind === "declined" ? (
        <Band tone="danger" title="この依頼は受けられませんでした" sub="ENGINE BASE から理由が届いています">
          <BandLine>
            理由：作業報告書は四半期ごとにまとめてお送りしているため、12 月分だけではお出しできません。1 月に 10〜12
            月分をまとめてお送りします。
          </BandLine>
        </Band>
      ) : null}
      <section className="k-f11p-thread" aria-label="やり取り">
        <Msg from="they" name="鈴木 健太 様" when="今日 10:20">
          12 月分の作業報告書もほしいです。
        </Msg>
        <Msg from="we" name="高本さん（ENGINE BASE）" when="今日 10:42">
          12/26 までにお送りします。宛先は山田様でよろしいですか？
        </Msg>
        {kind === "reply" ? (
          <Msg from="they" name="鈴木 健太 様" when="今日 11:05">
            はい、山田宛でお願いします。
          </Msg>
        ) : null}
      </section>
      {kind === "declined" ? null : (
        <div className="k-f11p-form">
          <TextArea name="reply" label="返事を書く" rows={3} />
          <div className="k-f11p-acts">
            <Button variant="primary">返事を送る</Button>
          </div>
        </div>
      )}
    </>
  );
}
