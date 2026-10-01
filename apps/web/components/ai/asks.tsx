"use client";
// 自分のAI からの問い合わせ（D-104.7）と、許可の 3 択（D-104.14）。どちらも答えは証跡に残る（D-093.8）。
//   問い合わせ：1〜4 問・選択肢（説明・推奨の印）・複数選べる問い・「その他（自分で書く）」・一言。全部答えてから送る
//   許可：今回だけ／いつも／しない ＋ 一言（許さないときは理由として自分のAI に渡る）。AI社員からは名前とアイコン
import { Bot, Check, MessageSquare, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Asking } from "@/lib/auth/ext";

export interface AskQuestion {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: { label: string; description?: string; preview?: string }[];
}
/** 問い合わせの中身（AskUserQuestion の input）を読む。形が違えば null（許可の問いとして出す） */
export function questionsOf(a: Asking): AskQuestion[] | null {
  if (a.tool !== "AskUserQuestion") return null;
  const qs = (a.input as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(qs) || !qs.length) return null;
  return qs.slice(0, 4).map((q) => {
    const x = (q ?? {}) as Record<string, unknown>;
    const opts = Array.isArray(x["options"]) ? (x["options"] as Record<string, unknown>[]) : [];
    return {
      question: String(x["question"] ?? ""),
      header: typeof x["header"] === "string" ? x["header"] : undefined,
      multiSelect: x["multiSelect"] === true,
      options: opts.map((o) => ({
        label: String(o["label"] ?? ""),
        ...(typeof o["description"] === "string" ? { description: o["description"] } : {}),
        ...(typeof o["preview"] === "string" ? { preview: o["preview"] } : {}),
      })),
    };
  });
}
const RECOMMENDED = /[（(]\s*(推奨|おすすめ|Recommended)\s*[）)]\s*$/i;

export function QCard({
  who,
  questions,
  onSend,
  busy,
}: {
  who: string;
  questions: AskQuestion[];
  onSend: (answers: Record<string, string>) => void;
  busy?: boolean;
}) {
  const [at, setAt] = useState(0);
  const [sel, setSel] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [memo, setMemo] = useState("");
  const q = questions[at] ?? questions[0]!;
  const answered = (i: number) => (sel[i]?.length ?? 0) > 0 || !!other[i]?.trim();
  const toggle = (label: string) =>
    setSel((s) => {
      const cur = s[at] ?? [];
      const next = q.multiSelect ? (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]) : [label];
      return { ...s, [at]: next };
    });
  const send = () => {
    const answers: Record<string, string> = {};
    questions.forEach((x, i) => {
      const parts = [...(sel[i] ?? []), ...(other[i]?.trim() ? [other[i]!.trim()] : [])];
      answers[x.question] = parts.join("、");
    });
    if (memo.trim()) answers["（一言）"] = memo.trim();
    onSend(answers);
  };
  const last = at === questions.length - 1;
  const preview = q.options.find((o, i) => (sel[at] ?? []).includes(o.label) || (i === 0 && !(sel[at] ?? []).length))?.preview;
  return (
    <div className="qcard" role="group" aria-label={`${who}からの問い合わせ`} data-part="question">
      <div className="qhd">
        <MessageSquare />
        {who}からの問い合わせ
        <span className="muted">{questions.length} 問 · 全部答えてから送ります</span>
      </div>
      {questions.length > 1 ? (
        <div className="qtabs" role="tablist">
          {questions.map((x, i) => (
            <button
              key={`${i}-${x.question}`}
              type="button"
              role="tab"
              aria-selected={i === at}
              className={`${i === at ? "on" : ""}${answered(i) && i !== at ? " ok" : ""}`}
              onClick={() => setAt(i)}
            >
              {answered(i) && i !== at ? <Check /> : null}
              {x.header ?? `問 ${i + 1}`}
            </button>
          ))}
        </div>
      ) : null}
      <div className="qq">
        {q.question}
        {q.multiSelect ? "（いくつでも）" : ""}
      </div>
      <div className="qbody" style={preview ? undefined : { gridTemplateColumns: "minmax(0,1fr)" }}>
        <div className="qopts" role={q.multiSelect ? "group" : "radiogroup"}>
          {q.options.map((o) => {
            const on = (sel[at] ?? []).includes(o.label);
            const rec = RECOMMENDED.test(o.label);
            return (
              <button
                key={o.label}
                type="button"
                role={q.multiSelect ? "checkbox" : "radio"}
                aria-checked={on}
                className={`qo${on ? " on" : ""}`}
                onClick={() => toggle(o.label)}
                style={{ textAlign: "left" }}
              >
                <span className={`box${q.multiSelect ? " m" : ""}`}>{on ? <Check /> : null}</span>
                <span className="ql">
                  <b>
                    {o.label.replace(RECOMMENDED, "")}
                    {rec ? <em>おすすめ</em> : null}
                  </b>
                  {o.description ? <span>{o.description}</span> : null}
                </span>
              </button>
            );
          })}
          <label className="qo other">
            <span className={`box${q.multiSelect ? " m" : ""}`} />
            <span className="ql">
              <b>その他（自分で書く）</b>
              <input
                placeholder="ここに書く"
                aria-label="その他の答え"
                value={other[at] ?? ""}
                onChange={(e) => setOther((s) => ({ ...s, [at]: e.target.value }))}
              />
            </span>
          </label>
        </div>
        {preview ? (
          <div className="qprev">
            <div className="qph">見本</div>
            <pre>{preview}</pre>
          </div>
        ) : null}
      </div>
      <div className="qfoot">
        <input className="memo" placeholder="一言添える（なくてもよい）" aria-label="一言添える" value={memo} onChange={(e) => setMemo(e.target.value)} />
        {at > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setAt(at - 1)}>
            戻る
          </Button>
        ) : null}
        {last ? (
          <Button size="sm" disabled={busy || !questions.every((_, i) => answered(i))} onClick={send} data-answer="send">
            送る
          </Button>
        ) : (
          <Button size="sm" disabled={!answered(at)} onClick={() => setAt(at + 1)}>
            次へ
          </Button>
        )}
      </div>
    </div>
  );
}

/** 「いつも許可」の対象の言い方（Bash はそのコマンド、ファイル系はそのファイル） */
const alwaysLabel = (tool: string | null) =>
  /^bash$/i.test(tool ?? "") ? "このコマンド" : /^(read|write|edit|multiedit|notebookedit)$/i.test(tool ?? "") ? "このファイル" : "この道具";
function detailOf(input: unknown): string {
  if (input === null || input === undefined) return "";
  const i = input as Record<string, unknown>;
  if (typeof i["command"] === "string") return i["command"];
  if (typeof i["file_path"] === "string") return String(i["file_path"]);
  try {
    return JSON.stringify(input, null, 1);
  } catch {
    return "";
  }
}

export function PermCard({
  asking,
  onAnswer,
  busy,
}: {
  asking: Asking;
  onAnswer: (a: { allow: boolean; scope: "once" | "always"; note: string }) => void;
  busy?: boolean;
}) {
  const [note, setNote] = useState("");
  const detail = detailOf(asking.input);
  return (
    <div className="perm" role="group" aria-label="許可の問い" data-part="ask">
      <div className="ph">
        <Shield />
        <b>あなたの PC でこれを実行していいですか</b>
        {asking.by ? (
          <span className="pby">
            <Bot />
            {asking.by}から
          </span>
        ) : null}
      </div>
      <div className="psum" data-ask-summary>
        {asking.summary ?? asking.tool ?? "道具の実行"}
      </div>
      {detail ? <pre className="pcode">{detail}</pre> : null}
      <div className="pbtn">
        <Button size="sm" disabled={busy} onClick={() => onAnswer({ allow: true, scope: "once", note })} data-answer="allow">
          今回だけ許可
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAnswer({ allow: true, scope: "always", note })} data-answer="always">
          いつも許可（{alwaysLabel(asking.tool)}）
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAnswer({ allow: false, scope: "once", note })} data-answer="deny">
          許可しない
        </Button>
        <input
          placeholder="一言添える（例：送る前に下書きを見せて）"
          aria-label="一言添える"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="muted pnote">答えるまで待っています。答えは証跡に残ります。「いつも」にしたものは ルール › 個人 で取り消せます</div>
    </div>
  );
}
