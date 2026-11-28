"use client";
// ナレッジの管理の面（管理者・マネージャー）：承認待ち／見直すページ（使われていない・食い違い・よく破られる）。
//   見た目だけ（値は props・口は呼ばない）
import { ArrowRight, ArrowUpToLine, Share2 } from "lucide-react";
import { Fragment, useEffect, useRef, type ChangeEvent, type ReactNode } from "react";
import { Badge, Button, Callout, TextArea } from "@/components/k";
import type { ApprovalItem, BrokenRow, ConflictRow, UnusedRow } from "./types";
import "./knowledge.css";
import "./admin.css";

export type { ApprovalItem, BrokenRow, ConflictRow, UnusedRow };

// ---------------------------------------------------------------- 承認待ち

/** 承認待ちの動き（渡さなければ見た目だけ・下絵と同じ） */
export interface ApprovalHandlers {
  approve: (id: string) => void;
  startDecline: (id: string) => void;
  cancelDecline: (id: string) => void;
  decline: (id: string) => void;
  reason: (id: string, text: string) => void;
  toggleBody: (id: string) => void;
}

interface CardProps {
  a: ApprovalItem;
  handlers?: ApprovalHandlers | undefined;
  busy: boolean;
  open: boolean;
  body?: ReactNode;
}

function ApprovalCard({ a, handlers, busy, open, body }: CardProps) {
  const declineBtn = useRef<HTMLButtonElement>(null);
  const wasDeclining = useRef(Boolean(a.declining));
  // 断るをやめたら焦点を「断る…」に戻す
  useEffect(() => {
    if (wasDeclining.current && !a.declining) declineBtn.current?.focus();
    wasDeclining.current = Boolean(a.declining);
  }, [a.declining]);
  const on = (fn: ((id: string) => void) | undefined) => (fn ? { onClick: () => fn(a.id) } : {});
  // 本文が無い頼み（フォルダの共有）には「中身を見る」を出さない。動きを渡さない呼び方（下絵）は今の見た目のまま
  const showBody = !handlers || body !== undefined;
  return (
    <li className="k-f9-ap" aria-label={`${a.from}：${a.title}`}>
      <div className="k-f9-ap-head">
        <Badge tone={a.kind === "raise" ? "progress" : "neutral"}>
          {a.kind === "raise" ? (
            <>
              <ArrowUpToLine size={12} aria-hidden="true" /> 上の棚に上げる
            </>
          ) : (
            <>
              <Share2 size={12} aria-hidden="true" /> 共有
            </>
          )}
        </Badge>
        <span className="k-f9-ap-route">
          {a.fromShelf}
          <ArrowRight size={12} aria-hidden="true" />
          <b>{a.toShelf}</b>
        </span>
        <span className="k-f9-sub">{`${a.from} ・ ${a.at}`}</span>
      </div>
      <h3 className="k-f9-ap-title">{a.title}</h3>
      <p className="k-f9-ap-desc">{a.desc}</p>
      {a.message ? <p className="k-f9-ap-msg">{`ひとこと：${a.message}`}</p> : null}
      {a.similar ? (
        <Callout tone="warn" title="似たページがあります">
          {a.similar}
        </Callout>
      ) : null}
      {open && body !== undefined ? (
        <div role="region" aria-label="中身">
          {body}
        </div>
      ) : null}
      {a.declining ? (
        <div className="k-f9-ap-decline">
          <TextArea
            label="断る理由"
            name={`decline-${a.id}`}
            value={a.declining.reason}
            {...(handlers
              ? {
                  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => handlers.reason(a.id, e.target.value),
                  autoFocus: true,
                }
              : { readOnly: true })}
            required
            rows={2}
            error={a.declining.error}
            description="頼んだ人のページに、この理由が出ます。"
          />
          <div className="k-f9-ap-acts">
            <Button variant="outlined" size="sm" {...on(handlers?.cancelDecline)}>
              やめる
            </Button>
            <Button variant="danger" size="sm" disabled={busy} {...on(handlers?.decline)}>
              断る
            </Button>
          </div>
        </div>
      ) : (
        <div className="k-f9-ap-acts">
          {showBody ? (
            <Button
              variant="ghost"
              size="sm"
              {...(handlers ? { "aria-expanded": open } : {})}
              {...on(handlers?.toggleBody)}
            >
              {open ? "中身を閉じる" : "中身を見る"}
            </Button>
          ) : null}
          <Button ref={declineBtn} variant="outlined" size="sm" disabled={busy} {...on(handlers?.startDecline)}>
            断る…
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} {...on(handlers?.approve)}>
            承認する
          </Button>
        </div>
      )}
    </li>
  );
}

export interface ApprovalsViewProps {
  items: readonly ApprovalItem[];
  /** 押したときの動き（渡さなければ見た目だけ） */
  handlers?: ApprovalHandlers | undefined;
  /** 口の答えを待っている行 */
  busyIds?: ReadonlySet<string> | undefined;
  /** 中身を開いている行 */
  openIds?: ReadonlySet<string> | undefined;
  /** 行の id → 本文（本文の無い行は持たない） */
  bodies?: Readonly<Record<string, ReactNode>> | undefined;
}

export function ApprovalsView({ items, handlers, busyIds, openIds, bodies }: ApprovalsViewProps) {
  return (
    <section className="k-f9-admin" aria-labelledby="kn-admin-title">
      <header className="k-f9-admin-head">
        <h1 id="kn-admin-title">承認待ち</h1>
        <p className="k-f9-sub">
          上の棚に上げる頼みと、ほかのグループからの共有の頼みが並びます。承認するまで、上の棚には出ません。
        </p>
      </header>
      {items.length ? (
        <ul className="k-f9-ap-list">
          {items.map((a) => (
            <ApprovalCard
              key={a.id}
              a={a}
              handlers={handlers}
              busy={Boolean(busyIds?.has(a.id))}
              open={Boolean(openIds?.has(a.id))}
              body={bodies?.[a.id]}
            />
          ))}
        </ul>
      ) : (
        <p className="k-f9-none">承認待ちはありません</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- 見直すページ

export type ReviewListKey = "unused" | "conflicts" | "broken";
export interface ReviewHandlers {
  open: (id: string) => void;
  fix: (id: string) => void;
  compare: (id: string) => void;
}
export interface ReviewProps {
  unused: readonly UnusedRow[];
  conflicts: readonly ConflictRow[];
  broken: readonly BrokenRow[];
  /** 押したときの動き（渡さない呼び方＝モックは今の見た目のまま） */
  handlers?: ReviewHandlers;
  /** 並べて開いている食い違いの行 */
  openIds?: ReadonlySet<string>;
  /** 食い違いの行の id → その行の下に並べる領域 */
  panes?: Readonly<Record<string, ReactNode>>;
  /** 一覧ごとの注記（上限ちょうど など） */
  limitNotes?: Partial<Record<ReviewListKey, string | null>>;
  /** 一覧ごとの空の字（渡したときだけ 0 件で出す） */
  emptyTexts?: Partial<Record<ReviewListKey, string>>;
}

function Block({
  id,
  title,
  n,
  lead,
  children,
  empty,
  note,
}: {
  id: string;
  title: string;
  n: number;
  lead: string;
  children: ReactNode;
  /** 0 件のときの字（渡したときだけ一覧の代わりに出す） */
  empty?: string | undefined;
  /** 説明の次の注記 */
  note?: string | null | undefined;
}) {
  return (
    <section className="k-f9-rv" aria-labelledby={id}>
      <div className="k-f9-rv-head">
        <h2 id={id}>
          {title}
          <span className="k-f9-count">{n}</span>
        </h2>
        <p className="k-f9-sub">{lead}</p>
        {note ? <p className="k-f9-sub">{note}</p> : null}
      </div>
      {n === 0 && empty ? <p className="k-f9-none">{empty}</p> : children}
    </section>
  );
}

export function ReviewView({
  unused,
  conflicts,
  broken,
  handlers,
  openIds,
  panes,
  limitNotes,
  emptyTexts,
}: ReviewProps) {
  return (
    <section className="k-f9-admin" aria-labelledby="kn-admin-title">
      <header className="k-f9-admin-head">
        <h1 id="kn-admin-title">見直すページ</h1>
        <p className="k-f9-sub">
          AI が読んでいないページ・上と下で違うことが書いてあるページ・守られていない決まりを、ここで見つけて直します。
        </p>
      </header>

      <Block
        id="rv-unused"
        empty={emptyTexts?.unused}
        note={limitNotes?.unused}
        title="使われていないページ"
        n={unused.length}
        lead="AI が 90 日のあいだ 1 度も開いていないページです。要らなければ消し、要るなら題名と 1 行の説明を直します。"
      >
        <ul className="k-f9-rows">
          {unused.map((r) => (
            <li key={r.id} className="k-f9-row">
              <span className="k-f9-row-main">
                <b id={`rv-tu-${r.id}`}>{r.title}</b>
                <small>{r.place}</small>
              </span>
              <span className="k-f9-row-meta">{r.lastOpened}</span>
              <Button
                variant="outlined"
                size="sm"
                aria-describedby={`rv-tu-${r.id}`}
                {...(handlers ? { onClick: () => handlers.open(r.id) } : {})}
              >
                開く
              </Button>
            </li>
          ))}
        </ul>
      </Block>

      <Block
        id="rv-conflict"
        empty={emptyTexts?.conflicts}
        note={limitNotes?.conflicts}
        title="食い違っているページ"
        n={conflicts.length}
        lead="上の棚と下の棚で、違うことが書いてあります。AI には上の棚（会社 › グループ › 自分 の順）が効きます。"
      >
        <ul className="k-f9-rows">
          {conflicts.map((r) => (
            <Fragment key={r.id}>
              <li className="k-f9-row" data-stack>
                <span className="k-f9-row-main">
                  <span className="k-f9-pair">
                    <span>
                      <b>{r.upper}</b>
                      <small>{r.upperPlace}</small>
                    </span>
                    <span className="k-f9-pair-vs" aria-hidden="true" />
                    <span>
                      <b>{r.lower}</b>
                      <small>{r.lowerPlace}</small>
                    </span>
                  </span>
                  <span className="k-f9-row-point">{r.point}</span>
                </span>
                <Button
                  variant="outlined"
                  size="sm"
                  aria-label={`${r.upper}と${r.lower}を並べて見る`}
                  {...(handlers
                    ? {
                        onClick: () => handlers.compare(r.id),
                        "aria-expanded": Boolean(openIds?.has(r.id)),
                        ...(openIds?.has(r.id) ? { "aria-controls": `rv-pair-${r.id}` } : {}),
                      }
                    : {})}
                >
                  並べて見る
                </Button>
              </li>
              {openIds?.has(r.id) && panes?.[r.id] ? (
                <li className="k-f9-pair-open">
                  <div id={`rv-pair-${r.id}`} role="region" aria-label="2 つのページを並べて見る">
                    {panes[r.id]}
                  </div>
                </li>
              ) : null}
            </Fragment>
          ))}
        </ul>
      </Block>

      <Block
        id="rv-broken"
        empty={emptyTexts?.broken}
        note={limitNotes?.broken}
        title="よく破られる決まり"
        n={broken.length}
        lead="この 30 日に、AI が守れなかった数の多い順です。書き方があいまいなことが多いので、直します。"
      >
        <ul className="k-f9-rows">
          {broken.map((r) => (
            <li key={r.id} className="k-f9-row">
              <span className="k-f9-row-main">
                <b id={`rv-tb-${r.id}`}>{r.title}</b>
                <small>{r.place}</small>
                <span className="k-f9-row-point">{r.how}</span>
              </span>
              <span className="k-f9-row-num">
                <b>{r.count}</b> 回
              </span>
              <Button
                variant="outlined"
                size="sm"
                aria-describedby={`rv-tb-${r.id}`}
                {...(handlers ? { onClick: () => handlers.fix(r.id) } : {})}
              >
                書き方を直す
              </Button>
            </li>
          ))}
        </ul>
      </Block>
    </section>
  );
}
