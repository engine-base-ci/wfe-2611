"use client";
// 依頼を出す（キャンバス CpNew）と、依頼のやり取り。部品は口を呼ばない。
//   値と動きは props で受ける（K-912）。props を渡さなければ見本を描く（モックの見た目は変わらない・K-873）。
//   会社の名前は文脈（usePortalCompany・口の tenant_name）だけから出す。直書きしない（本物の画面はホームの読みが済んでから描く）
//   担当の分身が聞く所は、担当の PC がつながっている時点（PS2）だけ。閉じている時点（PS0）は依頼がそのまま届く文にする。
//   先方の書いた字（本文・返事・質問）は文字として出す（HTML として解釈しない・ZT8）
import { useRef, type ChangeEvent } from "react";
import { Badge, Band, BandLine, Button, Callout, Empty, Select, TextArea, type SelectOption } from "@/components/k";
import { usePortalCompany } from "./frame";
import "./portal.css";

export type NewPhase = "input" | "empty" | "attach-bad" | "saving" | "failed" | "sent";

const BODY = "来年 1 月から請求書の宛先を経理部の佐野に変えたいです";
const SAMPLE_NOTE = "この依頼は、セイコー株式会社（ゲスト）の皆さんと ENGINE BASE に見えます。";
const FAILED_BODY = "もう一度押してください。書いた内容は、この画面に残っています。";
const ATTACH_BAD_BODY = "ファイルが大きすぎるか、足せない種類です。小さくするか別の形にして、もう一度足してください。";
const SAMPLE_DUE: SelectOption[] = [
  { value: "1220", label: "12/20" },
  { value: "1226", label: "12/26" },
  { value: "none", label: "決めない" },
];

/** 分身が聞いた質問（口の questions の 1 つ） */
export interface Question {
  id: string;
  text: string;
}
/** 足せた添付（口が返した id と、足したファイルの名前） */
export interface AttachedFile {
  id: string;
  name: string;
}
/** 足せなかった添付（名前と、断りの文） */
export interface BadFile {
  key: string;
  name: string;
  reason: string;
}
/** いつまでに（任意）の選び肢と今の値 */
export interface DueField {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  error?: string | null;
}
/** 囲みに出す知らせ（見出しと続き） */
export interface FormError {
  title: string;
  body?: string;
}

export interface NewRequestFormProps {
  /** 見本の時点（props を渡さないときだけ使う） */
  ps?: "PS0" | "PS2";
  phase?: NewPhase;
  /** 「何をしてほしいか」の今の字（渡せば値と動きは props から） */
  value?: string;
  onChange?: (v: string) => void;
  /** 欄を離れたとき（分身に聞くか決めるのは呼ぶ側） */
  onBlurBody?: () => void;
  bodyError?: string | null;
  /** 分身の質問。null はまだ聞いていない */
  questions?: Question[] | null;
  /** 担当の PC がつながっているか。null はまだ分からない */
  pcOpen?: boolean | null;
  due?: DueField;
  files?: AttachedFile[];
  badFiles?: BadFile[];
  onAddFile?: (files: File[]) => void;
  onRemoveFile?: (id: string) => void;
  /** 添付をもう足せない（数の上限）。その文 */
  attachFull?: string | null;
  busy?: boolean;
  error?: FormError | null;
  onSubmit?: () => void;
  /** 出した後の「やり取りに戻る」 */
  onBack?: () => void;
  /** 見える範囲の一文（空の字なら出さない） */
  note?: string;
}

function AiBox({
  live,
  ps,
  pcOpen,
  questions,
}: {
  live: boolean;
  ps: "PS0" | "PS2";
  pcOpen?: boolean | null;
  questions?: Question[] | null;
}) {
  const company = usePortalCompany();
  const closed = live ? pcOpen === false : ps === "PS0";
  if (closed) {
    return (
      <div className="k-f11p-ai" aria-disabled="true">
        <span className="k-f11p-ai-text">
          <span>いまは担当の席が閉じているので、ここでは聞き返しません。</span>
          <small>依頼はそのまま担当に届きます。足りないことがあれば、あとで依頼のやり取りで聞きます</small>
        </span>
      </div>
    );
  }
  if (live && (pcOpen !== true || !questions || questions.length === 0)) return null;
  return (
    <div className="k-f11p-ai">
      <span className="k-f11p-ai-mark" aria-hidden="true">
        AI
      </span>
      <span className="k-f11p-ai-text">
        {live && questions ? (
          <span>
            伝わりやすくするために、ひとつ教えてください：
            {questions.map((q, i) => (
              <span key={q.id}>
                {i > 0 ? "と、" : null}
                <b>{q.text}</b>
              </span>
            ))}
            。
          </span>
        ) : (
          <span>
            伝わりやすくするために、ひとつ教えてください：<b>佐野様のメールアドレス</b>と、
            <b>CC は今と同じ鈴木様のままでよいか</b>。
          </span>
        )}
        <small>
          {company} の AI が聞いています。答えなくても出せます（担当が席にいないときは、あとで依頼のやり取りで聞きます）
        </small>
      </span>
    </div>
  );
}

function Attach({
  live,
  phase,
  files = [],
  badFiles = [],
  onAddFile,
  onRemoveFile,
  attachFull,
}: Pick<NewRequestFormProps, "files" | "badFiles" | "onAddFile" | "onRemoveFile" | "attachFull"> & {
  live: boolean;
  phase: NewPhase;
}) {
  const input = useRef<HTMLInputElement>(null);
  const full = Boolean(attachFull);
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じファイルを選び直せるように
    if (list.length > 0) onAddFile?.(list);
  };
  const bad = live
    ? badFiles
    : phase === "attach-bad"
      ? [{ key: "sample", name: "議事メモ.exe", reason: "足せない種類のファイルです" }]
      : [];
  return (
    <div className="k-f11p-attach">
      <span className="k-label">添付（任意）</span>
      {bad.length > 0 ? (
        <>
          <Callout tone="danger" title="このファイルは足せませんでした">
            {ATTACH_BAD_BODY}
          </Callout>
          {bad.map((f) => (
            <div key={f.key} className="k-f11p-file" data-bad="true">
              <span>{f.name}</span>
              <span className="k-f11p-row-meta">{f.reason}</span>
            </div>
          ))}
        </>
      ) : null}
      {live
        ? files.map((f) => (
            <div key={f.id} className="k-f11p-file">
              <span>{f.name}</span>
              <Button variant="ghost" size="sm" aria-label={`${f.name} を外す`} onClick={() => onRemoveFile?.(f.id)}>
                外す
              </Button>
            </div>
          ))
        : null}
      <div>
        <Button variant="outlined" size="sm" disabled={full} onClick={live ? () => input.current?.click() : undefined}>
          ＋ ファイルを足す
        </Button>
        {live ? <input ref={input} type="file" multiple hidden disabled={full} onChange={pick} /> : null}
      </div>
      {attachFull ? <p className="k-f11p-row-meta">{attachFull}</p> : null}
    </div>
  );
}

export function NewRequestForm(props: NewRequestFormProps) {
  const {
    ps = "PS2",
    phase = "input",
    value,
    onChange,
    onBlurBody,
    bodyError,
    due,
    busy,
    error,
    onSubmit,
    onBack,
    note,
  } = props;
  const company = usePortalCompany();
  const live = onChange !== undefined;
  if (phase === "sent") {
    return (
      <Empty
        title="依頼を出しました"
        icon="✓"
        action={
          <Button variant="primary" onClick={onBack}>
            やり取りに戻る
          </Button>
        }
      >
        {company} に届きました。返事が来たら、この場所とメールでお知らせします。
      </Empty>
    );
  }
  const bad = phase === "empty";
  const shown = error ?? (phase === "failed" ? { title: "依頼を出せませんでした", body: FAILED_BODY } : null);
  const noteText = note ?? SAMPLE_NOTE;
  return (
    <div className="k-f11p-form">
      {shown ? (
        <Callout tone="danger" title={shown.title}>
          {shown.body ?? ""}
        </Callout>
      ) : null}
      <TextArea
        name="body"
        label="何をしてほしいか"
        required
        rows={4}
        {...(live
          ? { value: value ?? "", onChange: (e) => onChange(e.target.value), onBlur: () => onBlurBody?.() }
          : bad
            ? {}
            : { defaultValue: BODY })}
        error={live ? bodyError : bad ? "何をしてほしいかを書いてください" : undefined}
      />
      <AiBox live={live} ps={ps} pcOpen={props.pcOpen} questions={props.questions} />
      <div className="k-f11p-two">
        {due ? (
          <Select
            label="いつまでに（任意）"
            name="due"
            value={due.value}
            options={due.options}
            onValueChange={(v) => due.onChange(v ?? "none")}
            error={due.error}
          />
        ) : (
          <Select label="いつまでに（任意）" name="due" defaultValue="1220" options={SAMPLE_DUE} />
        )}
        <Attach
          live={live}
          phase={phase}
          files={props.files}
          badFiles={props.badFiles}
          onAddFile={props.onAddFile}
          onRemoveFile={props.onRemoveFile}
          attachFull={props.attachFull}
        />
      </div>
      {noteText ? <p className="k-f11p-note">{noteText}</p> : null}
      <div className="k-f11p-acts">
        <Button variant="primary" loading={busy || phase === "saving"} onClick={onSubmit}>
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

/** 依頼のやり取りの値（口 getPortalRequest を画面の形に直した物） */
export interface ThreadView {
  title: string;
  /** 見出しの下の行（出した人・いつ・見える範囲） */
  sub: string;
  state: "open" | "accepted" | "declined";
  declinedReason?: string;
  messages: { id: string; side: "they" | "we"; name: string; at: string; text: string }[];
  canWrite: boolean;
}

export interface RequestThreadProps {
  /** 見本の形（thread を渡さないときだけ使う） */
  kind?: ThreadKind;
  thread?: ThreadView;
  reply?: string;
  onReplyChange?: (v: string) => void;
  onSend?: () => void;
  sending?: boolean;
  replyError?: string | null;
  sendError?: FormError | null;
}

const kindOf = (t: ThreadView): ThreadKind =>
  t.state === "accepted" ? "accepted" : t.state === "declined" ? "declined" : "reply";

function badgeOf(kind: ThreadKind, thread?: ThreadView): string | null {
  if (kind === "accepted") return "受けました";
  if (kind === "declined") return "受けられませんでした";
  if (!thread) return "返事あり";
  return thread.messages.some((m) => m.side === "we") ? "返事あり" : null;
}

/** 依頼のやり取り（先方が読み書きする）。値を渡さなければ見本 */
export function RequestThread({
  kind: sampleKind = "reply",
  thread,
  reply,
  onReplyChange,
  onSend,
  sending,
  replyError,
  sendError,
}: RequestThreadProps) {
  const company = usePortalCompany();
  const kind = thread ? kindOf(thread) : sampleKind;
  const badge = badgeOf(kind, thread);
  const canWrite = thread ? thread.canWrite : kind !== "declined";
  return (
    <>
      <div className="k-f11p-titlebar">
        <h1>{thread ? thread.title : "12 月分の作業報告書もほしい"}</h1>
        {badge ? (
          <Badge tone={kind === "accepted" ? "success" : kind === "declined" ? "danger" : "neutral"}>{badge}</Badge>
        ) : null}
      </div>
      <p className="k-f11p-sub">
        {thread ? thread.sub : "鈴木 健太 様が今日 10:20 に出した ・ セイコー株式会社（ゲスト）の皆さんにも見えます"}
      </p>
      {kind === "accepted" ? (
        <Band
          tone="ok"
          title={`${company} が依頼を受けました`}
          sub="チケットになりました。ホームの「見せてもらったチケット」から開けます。このやり取りは、チケットのやり取りの頭に残ります"
        />
      ) : null}
      {kind === "declined" ? (
        <Band tone="danger" title="この依頼は受けられませんでした" sub={`${company} から理由が届いています`}>
          {thread ? (
            thread.declinedReason ? (
              <BandLine>{`理由：${thread.declinedReason}`}</BandLine>
            ) : null
          ) : (
            <BandLine>
              理由：作業報告書は四半期ごとにまとめてお送りしているため、12 月分だけではお出しできません。1 月に 10〜12
              月分をまとめてお送りします。
            </BandLine>
          )}
        </Band>
      ) : null}
      <section className="k-f11p-thread" aria-label="やり取り">
        {thread ? (
          thread.messages.map((m) => (
            <Msg key={m.id} from={m.side} name={m.name} when={m.at}>
              {m.text}
            </Msg>
          ))
        ) : (
          <>
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
          </>
        )}
      </section>
      {canWrite ? (
        <div className="k-f11p-form">
          {sendError ? (
            <Callout tone="danger" title={sendError.title}>
              {sendError.body ?? ""}
            </Callout>
          ) : null}
          <TextArea
            name="reply"
            label="返事を書く"
            rows={3}
            {...(onReplyChange ? { value: reply ?? "", onChange: (e) => onReplyChange(e.target.value) } : {})}
            error={replyError}
          />
          <div className="k-f11p-acts">
            <Button variant="primary" loading={sending} onClick={onSend}>
              返事を送る
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
