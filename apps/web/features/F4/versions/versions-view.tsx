"use client";
// 版と差分の本体（K-449）。見た目は下絵 v2 の VersionsView（features/F4/doc/detail-views.tsx）と同じ class（doc.css の k-f4d-*）。
//   左：比べる物（本文・項目の変更）と版の一覧（幅 375 では一覧を出さない・doc.css）。右：比べる元と先・差分・戻す／コピー・注。
//   戻すの押せる・押せないは口の答え（meta.can_restore）と、チケットの完了（getTicket の completed）で決める（役の名前で出し分けない）
//   項目の変更の戻す（K-579）：押せる形にし、口 restoreTicketItems（item-restore.ts）につなぐ。戻せなかった項目の並びは本体の一番下
//     （下絵 f4v2-versions-items-restored と同じ場所）に置き、戻した後の読み直しが失敗しても残す
import type { ReactNode } from "react";
import { Button, Loading, NoticeBox, Select, errorText, useNotify, type SelectOption } from "@/components/k";
import { compareTitle, copyText, KIND_LABEL } from "./diff-lines";
import type { RestoreNote } from "./item-restore";
import { SkippedList } from "./item-restore-notes";
import { FIELD_OF, type Loaded, type Of, type Sel, type Ver, type View } from "./use-versions";

const CANT_RESTORE = "このチケットを直せる人だけが戻せます";
const NOT_YET = "まだ使えません";
const ONLY: Record<Of, string> = {
  body: "版は 1 つだけです。本文を書き終えるたびに、版が増えます。",
  items: "版は 1 つだけです。項目を変えるたびに、版が増えます。",
};
const NO_DIFF = "変わった項目はありません";
const COMPLETED: Record<Of, string> = { body: "E-SEC-005", items: "E-ITM-001" };

const WHEN = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** 日本時間の「MM/DD HH:MM」 */
export function whenOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(WHEN.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p["month"]}/${p["day"]} ${p["hour"]}:${p["minute"]}`;
}
/** 選びの字：「版 2 ・ 鈴木 11/21 10:05」・今の版は「版 3（いま）・ 高本 11/21 10:42」 */
const optionOf = (v: Ver): SelectOption => ({
  value: String(v.n),
  label: `版 ${v.n}${v.current ? "（いま）・ " : " ・ "}${v.by} ${whenOf(v.at)}`,
});

export interface VersionsViewProps {
  sel: Sel;
  loaded: Loaded;
  completed: boolean;
  sending: boolean;
  restoreError: string | null;
  /** 項目を戻すを送っている間（K-579） */
  itemSending: boolean;
  /** 項目を戻すの失敗の文（K-579） */
  itemError: string | null;
  /** 項目を戻した結果（K-579） */
  restoreNote: RestoreNote | null;
  choose: (next: Sel) => void;
  reload: () => void;
  restore: () => void;
  restoreItems: () => void;
}

export function VersionsView(p: VersionsViewProps): ReactNode {
  const view = p.loaded.state === "ok" ? p.loaded.view : null;
  const field = FIELD_OF[p.sel.of];
  const pick = (of: Of) => {
    if (of !== p.sel.of) p.choose({ of, from: null, to: null });
  };
  return (
    <div className="k-f4d-ver">
      <aside className="k-f4d-ver-side" aria-label="版の一覧">
        <p className="k-f4d-sub">比べる物</p>
        <ul className="k-f4d-pick">
          {(["body", "items"] as const).map((of) => (
            <li key={of}>
              <button type="button" aria-pressed={of === p.sel.of} onClick={() => pick(of)}>
                {FIELD_OF[of]}
              </button>
            </li>
          ))}
        </ul>
        {view && view.of === p.sel.of ? <VersionList view={view} field={field} /> : null}
      </aside>
      <div className="k-f4d-ver-main">
        {p.loaded.state === "loading" ? <Loading /> : null}
        {p.loaded.state === "error" ? (
          <ReadFailed code={p.loaded.code} retry={p.loaded.retry} reload={p.reload} />
        ) : null}
        {view && view.of === p.sel.of ? <Compare {...p} view={view} /> : null}
        {p.sel.of === "items" && p.restoreNote ? <SkippedList items={p.restoreNote.skipped} /> : null}
      </div>
    </div>
  );
}

function VersionList({ view, field }: { view: View; field: string }): ReactNode {
  return (
    <>
      <p className="k-f4d-sub k-f4d-vlist-wrap">{field}の版</p>
      <ol className="k-f4d-vlist k-f4d-vlist-wrap">
        {view.versions.map((v) => (
          <li key={v.n} data-from={v.n === view.from} data-to={v.n === view.to}>
            版 {v.n}
            {v.current ? "（いま）" : ""}
            <small>{`${v.by} ・ ${whenOf(v.at)} ・ ${v.summary}`}</small>
          </li>
        ))}
      </ol>
    </>
  );
}

function ReadFailed({ code, retry, reload }: { code: string; retry: boolean; reload: () => void }): ReactNode {
  return (
    <>
      <NoticeBox>{errorText(code).entry.message}</NoticeBox>
      {retry ? (
        <div className="k-f4d-ver-acts">
          <Button variant="outlined" onClick={reload}>
            もう一度読む
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Compare(p: VersionsViewProps & { view: View }): ReactNode {
  const notify = useNotify();
  const { view } = p;
  const field = FIELD_OF[view.of];
  if (view.versions.length <= 1 || view.from === null || view.to === null) return <p role="status">{ONLY[view.of]}</p>;
  const from = view.from;
  const to = view.to;
  const current = view.versions.find((v) => v.current)?.n ?? to;
  const fromOptions = view.versions
    .filter((v) => v.n < to)
    .sort((a, b) => b.n - a.n)
    .map(optionOf);
  const toOptions = view.versions
    .filter((v) => v.n > from)
    .sort((a, b) => a.n - b.n)
    .map(optionOf);
  const body = view.of === "body";
  const completed = p.completed;
  const sending = body ? p.sending : p.itemSending;
  const failure = body ? p.restoreError : p.itemError;
  // 押せない訳（title）。完了は title を付けず、注の場所に正本の文を出す。項目の変更は差分が空なら title なしで押せない形（K-579）
  const empty = view.lines.length === 0;
  //   完了したチケットは版の一覧の can_restore も false なので、項目の変更では完了を先に見て title を付けない
  const why = body && empty ? NOT_YET : !view.canRestore && (body || !completed) ? CANT_RESTORE : null;
  const inert = why !== null || empty || completed || sending;
  const copy = () => {
    const text = copyText(field, from, to, view.lines);
    const done = () => notify("差分をコピーしました");
    const failed = () => notify("差分をコピーできませんでした", { type: "error" });
    try {
      navigator.clipboard.writeText(text).then(done, failed);
    } catch {
      failed();
    }
  };
  return (
    <>
      <div className="k-f4d-items">
        <Select
          label="比べる元"
          name="from"
          value={String(from)}
          options={fromOptions}
          onValueChange={(v) => v !== null && p.choose({ of: view.of, from: Number(v), to })}
        />
        <Select
          label="比べる先"
          name="to"
          value={String(to)}
          options={toOptions}
          onValueChange={(v) => v !== null && p.choose({ of: view.of, from, to: Number(v) })}
        />
      </div>
      <p className="k-f4d-sub">{compareTitle(field, from, to)}</p>
      {view.lines.length === 0 && !body ? (
        <p>{NO_DIFF}</p>
      ) : (
        <ul className="k-f4d-diff" aria-label="差分">
          {view.lines.map((l, i) => (
            <li key={`${i}-${l.kind}`} data-kind={l.kind}>
              <span className="k-f4d-sr">{KIND_LABEL[l.kind]}</span>
              {l.text}
            </li>
          ))}
        </ul>
      )}
      <div className="k-f4d-ver-acts">
        <Button
          variant="outlined"
          aria-disabled={inert || undefined}
          aria-busy={sending || undefined}
          {...(why && !sending ? { title: why } : {})}
          onClick={() => {
            if (inert) return;
            if (body) p.restore();
            else p.restoreItems();
          }}
        >
          {`${field}を版 ${from} に戻す`}
        </Button>
        <Button variant="outlined" onClick={copy}>
          この差分をコピー
        </Button>
      </div>
      {failure ? <NoticeBox>{failure}</NoticeBox> : null}
      {completed ? (
        <p>{errorText(COMPLETED[view.of]).entry.message}</p>
      ) : (
        <p className="k-f4d-hint">{`戻すと、いまの版は消えずに新しい版（版 ${current + 1}）ができ、確認の結果が古くなります`}</p>
      )}
    </>
  );
}
