"use client";
// チケットの側に出るナレッジの分（段 5・段 6 の詳細に足す物だけ）：
//   ① 始める前に AI が出す「このチケットで守る物」の一覧（やり取りに残る）
//   ② AI が開いたページの 1 行（やり取りに残る）
//   ③ 確認項目の行の「ナレッジから」の印と、必ず守る物にチェックが付くまで完了に進めない小窓
//   見た目だけ（値は props・口は呼ばない）
import { BookOpen, ShieldCheck } from "lucide-react";
import { Button, Callout, Dialog } from "@/components/k";
import "./knowledge.css";
import "./ticket.css";

const noop = (): void => undefined;

export interface GuardPage {
  id: string;
  title: string;
  place: string;
}

/** ① このチケットで守る物（AI の書き込みの中身） */
export function GuardList({ must, opened }: { must: readonly GuardPage[]; opened: readonly GuardPage[] }) {
  return (
    <div className="k-f9-guard" aria-label="このチケットで守る物">
      <p className="k-f9-guard-lead">始める前に、このチケットで守る物を並べました。</p>
      <section aria-label="必ず守る">
        <h4>
          <ShieldCheck size={13} aria-hidden="true" />
          {`必ず守る（${must.length}）`}
          <small>確認項目に入れました</small>
        </h4>
        <ul>
          {must.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`}>{p.title}</a>
              <small>{p.place}</small>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="このチケットのために開いたページ">
        <h4>
          <BookOpen size={13} aria-hidden="true" />
          {`このチケットのために開いたページ（${opened.length}）`}
        </h4>
        <ul>
          {opened.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`}>{p.title}</a>
              <small>{p.place}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** ② やり取りの 1 行の字：AI が開いたページ */
export function OpenedText({ ai, title, place }: { ai: string; title: string; place: string }) {
  return (
    <>
      <b>{ai}</b> がナレッジの{" "}
      <a href="#page" className="k-f9-inline-link">
        {title}
      </a>
      <small className="k-f9-inline-place">（{place}）</small> を開いた
    </>
  );
}

// ---------------------------------------------------------------- ③ 確認項目
export interface SpecRow {
  id: string;
  text: string;
  done: boolean;
  /** ナレッジの「必ず守る」から入った行（どのページから来たか） */
  from?: string;
  /** 誰が付けたか（付いているとき） */
  by?: string;
}

/** 右のパネルの確認項目（段 5 の形：チェックだけ。ナレッジから入った行に小さな印） */
export function SpecList({ rows }: { rows: readonly SpecRow[] }) {
  const left = rows.filter((r) => !r.done).length;
  return (
    <section aria-label="確認項目" className="k-detail-panel-sec k-f9-specs">
      <h2>
        確認項目
        <small>{left ? `あと ${left} つ` : "全部付きました"}</small>
      </h2>
      <ul>
        {rows.map((r) => (
          <li key={r.id} data-done={r.done}>
            <input type="checkbox" id={`spec-${r.id}`} defaultChecked={r.done} className="k-f9-checkbox" />
            <label htmlFor={`spec-${r.id}`}>
              <span>{r.text}</span>
              {r.from ? (
                <small className="k-f9-spec-from">
                  <ShieldCheck size={11} aria-hidden="true" />
                  {`ナレッジ：${r.from}`}
                </small>
              ) : null}
              {r.by ? <small className="k-f9-spec-by">{r.by}</small> : null}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 完了を止める小窓（「完了にする」を押したとき）。止めるのは「必ず守る」から入った確認項目だけ。
 * 人が足した確認項目は止めない（段 5 のとおり注意だけ出す）。left には、チェックの付いていない行を全部渡す
 */
export function CompleteBlockedDialog({ target, left }: { target: string; left: readonly SpecRow[] }) {
  const blocking = left.filter((r) => r.from);
  const caution = left.length - blocking.length;
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="まだ完了にできません"
      target={target}
      actions={
        <>
          <Button variant="outlined">閉じる</Button>
          <Button>確認項目に戻る</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <Callout
          tone="warn"
          title={`「必ず守る」から入った確認項目に、チェックの付いていない物が ${blocking.length} つあります`}
        >
          これにチェックが付くと、完了にできます。
        </Callout>
        <ul className="k-f9-pick-list" aria-label="チェックの付いていない、必ず守る確認項目">
          {blocking.map((r) => (
            <li key={r.id} className="k-f9-pick-row">
              <span className="k-f9-pick-main">
                <b>{r.text}</b>
                <small>{`ナレッジ：${r.from}`}</small>
              </span>
            </li>
          ))}
        </ul>
        {caution ? (
          <p className="k-f9-note">{`人が足した確認項目にも、チェックの付いていない物が ${caution} つあります。完了は止めませんが、見直してください。`}</p>
        ) : null}
        <p className="k-f9-note">メールを送るなど、外に出る操作は、チェックとは別に人の承認が要ります。</p>
      </div>
    </Dialog>
  );
}
