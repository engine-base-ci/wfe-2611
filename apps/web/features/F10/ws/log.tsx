"use client";
// ワークスペースの管理 › 記録（キャンバス WsLog）。記録は追記だけ（消せない・直せない）。値を受け取って描くだけ（口は呼ばない）。
//   書き出し（持ち出し）は作らない（D-154.4）。記録を開けるのは管理者と、自分のグループの分を見るマネージャーだけ（D-154.2・.11）。
//   「運営がしたこと」「消した」の行の「戻す」は後のフェーズなので、出すが押せない形（D-145.9）。キャンバスに無い状態の字は仮
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

export function LogPage({ entries, query = "", tab = null, status = "ok", manager = false }: LogPageProps) {
  const searching = query !== "" || tab !== null;
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
        <SearchField
          label="記録をことばで探す"
          placeholder="鈴木さんの役割を変えたのは誰？ ことばで探せる"
          value={query}
          readOnly
        />
        {manager ? null : (
          <div className="k-f10w-chips" role="group" aria-label="札で絞る">
            {LOG_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className="k-f10w-chip"
                aria-pressed={tab === t.key}
                {...(t.inert ? inert : {})}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {status === "failed" ? (
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => undefined]} />
      ) : status === "empty" ? (
        <Empty title="見つかりませんでした">ことばを変えるか、札をはずして探してみてください</Empty>
      ) : (
        <div className="k-inv-body">
          {searching ? <p className="k-inv-sub">{`${entries.length} 件見つかりました`}</p> : null}
          <ul className="k-f10w-entries">
            {entries.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ul>
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
