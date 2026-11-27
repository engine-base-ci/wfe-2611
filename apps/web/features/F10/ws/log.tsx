"use client";
// ワークスペースの管理 › 記録（キャンバス WsLog）。記録は追記だけ（消せない・直せない）。値を受け取って描くだけ（口は呼ばない）。
//   書き出し（持ち出し）は作らない（D-154.4）。記録を開けるのは管理者と、自分のグループの分を見るマネージャーだけ（D-154.2・.11）。
//   「運営がしたこと」「消した」の行の「戻す」は後のフェーズなので、出すが押せない形（D-145.9）。キャンバスに無い状態の字は仮
//   本番の画面（K-825）は任意の props（onTab・onSearch・searchLabel・filterNote・more・onRetry・emptyHint）を渡す。渡さない呼び方（下絵）は今の見た目のまま
import { useEffect, useState } from "react";
import { Button, Empty, ErrorState, PAGE_ERROR, SearchField } from "@/components/k";
import "@/features/F10/invite/invite.css";
import "./ws.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

export type LogTab = "perm" | "out" | "device" | "ai" | "deleted" | "ops";
export const LOG_TABS: readonly { key: LogTab; label: string; inert?: boolean }[] = [
  { key: "perm", label: "権限が変わった" },
  { key: "out", label: "外に出した" },
  { key: "device", label: "新しい端末で入った" },
  { key: "ai", label: "分身に許可した" },
  { key: "deleted", label: "消した（30 日は戻せる）" },
  { key: "ops", label: "運営がしたこと", inert: true },
];

export interface LogEntry {
  id: string;
  when: string;
  who: string;
  /** 「が」より後ろの文 */
  text: string;
  reason?: string;
  device?: string;
  stepUp?: boolean;
  /** 消したものの行（戻すは押せない形） */
  deleted?: boolean;
}

export interface LogPageProps {
  entries: readonly LogEntry[];
  query?: string;
  tab?: LogTab | null;
  /** ok＝並びを出す・empty＝見つからない・failed＝読めない */
  status?: "ok" | "empty" | "failed";
  /** マネージャー：自分のグループの分（自分のグループのチケットと、その人たちの操作の記録）だけ（D-154.11） */
  manager?: boolean;
  /** 札を押したとき（押した札をもう一度押すと null）。無ければ札は描くだけ */
  onTab?: (t: LogTab | null) => void;
  /** ことばの欄で Enter を押したとき。無ければ欄は読むだけ */
  onSearch?: (q: string) => void;
  /** 探したときの件数の字（無ければ「N 件見つかりました」） */
  searchLabel?: string;
  /** URL で 1 人（とチケット）に絞っている札と、外す関数 */
  filterNote?: { text: string; clearLabel: string; onClear: () => void };
  /** 続きを読む（無ければ出さない） */
  more?: { onClick: () => void; busy: boolean; failed: boolean };
  /** 読めなかったときの「もう一度」 */
  onRetry?: () => void;
  /** 見つからないときの下の字（無ければ「ことばを変えるか…」） */
  emptyHint?: string;
}

const Q_MAX = 100;
const SEARCH_LABEL = "記録をことばで探す";
const SEARCH_HINT = "鈴木さんの役割を変えたのは誰？ ことばで探せる";
const EMPTY_HINT = "ことばを変えるか、札をはずして探してみてください";
const MORE_FAILED = "続きを読めませんでした。もう一度押してください";
const noop = (): void => undefined;

/** ことばの欄：onSearch があれば入力できる（Enter で送る・打つたびには送らない）。外から query が変われば欄も合わせる */
function SearchBox({ query, onSearch }: { query: string; onSearch?: (q: string) => void }) {
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  if (!onSearch) return <SearchField label={SEARCH_LABEL} placeholder={SEARCH_HINT} value={query} readOnly />;
  return (
    <SearchField
      label={SEARCH_LABEL}
      placeholder={SEARCH_HINT}
      value={text}
      maxLength={Q_MAX}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        e.preventDefault();
        onSearch(text);
      }}
    />
  );
}

function Entry({ e }: { e: LogEntry }) {
  const sub = [e.reason ? `理由：${e.reason}` : null, e.device ?? null, e.stepUp ? "本人確認を取り直した" : null]
    .filter(Boolean)
    .join(" ・ ");
  return (
    <li className="k-f10w-entry">
      <time className="k-f10w-when">{e.when}</time>
      <div className="k-f10w-what">
        <p className="k-f10w-line">
          <b>{e.who}</b> が {e.text}
        </p>
        {sub ? <p className="k-inv-sub">{sub}</p> : null}
      </div>
      {e.deleted ? (
        <Button variant="outlined" size="sm" {...inert}>
          戻す
        </Button>
      ) : null}
    </li>
  );
}

export function LogPage({
  entries,
  query = "",
  tab = null,
  status = "ok",
  manager = false,
  onTab,
  onSearch,
  searchLabel,
  filterNote,
  more,
  onRetry,
  emptyHint,
}: LogPageProps) {
  const searching = query !== "" || tab !== null || filterNote !== undefined;
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="log-title">
      <header className="k-page-head">
        <h1 id="log-title">記録</h1>
        <p className="k-page-sub">
          {manager
            ? "自分のグループのチケットと、その人たちの操作の記録（仮）"
            : "ワークスペースで起きた大事なこと。消せない・直せない"}
        </p>
      </header>
      <div className="k-f10w-tools">
        <SearchBox query={query} {...(onSearch ? { onSearch } : {})} />
        {manager ? null : (
          <div className="k-f10w-chips" role="group" aria-label="札で絞る">
            {LOG_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className="k-f10w-chip"
                aria-pressed={tab === t.key}
                {...(t.inert ? inert : onTab ? { onClick: () => onTab(tab === t.key ? null : t.key) } : {})}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {filterNote ? (
          <p className="k-inv-sub">
            {filterNote.text}{" "}
            <Button variant="outlined" size="sm" onClick={filterNote.onClear} aria-label={filterNote.clearLabel}>
              外す
            </Button>
          </p>
        ) : null}
      </div>
      {status === "failed" ? (
        <>
          <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry ?? noop]} />
          {onRetry ? (
            <Button variant="outlined" onClick={onRetry}>
              もう一度読む
            </Button>
          ) : null}
        </>
      ) : status === "empty" ? (
        <Empty title="見つかりませんでした">{emptyHint ?? EMPTY_HINT}</Empty>
      ) : (
        <div className="k-inv-body">
          {searching ? <p className="k-inv-sub">{searchLabel ?? `${entries.length} 件見つかりました`}</p> : null}
          <ul className="k-f10w-entries">
            {entries.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ul>
          {more ? (
            <>
              {more.failed ? <p className="k-inv-sub">{MORE_FAILED}</p> : null}
              <Button variant="outlined" onClick={more.onClick} disabled={more.busy} aria-busy={more.busy || undefined}>
                続きを読む
              </Button>
            </>
          ) : null}
          <p className="k-inv-sub">
            {manager
              ? "ワークスペース全体の記録は、管理者だけが見られる（仮）"
              : "ワークスペース全体は管理者、自分のグループの分はマネージャーが見られる。契約中はずっと残る（仮）"}
          </p>
        </div>
      )}
    </section>
  );
}
