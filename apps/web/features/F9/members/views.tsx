"use client";
// メンバーの画面（段 10 の作り直し・代表の指摘）：グループごとに分けて見せ、グループを押すと、そのグループのメンバーが出る。
//   1 人 1 行は段 9 の招く葉の部品（features/F10/invite/views.tsx の Person）をそのまま使う。
//   見た目だけ（値は props・口は呼ばない）。口につないだ画面（K-710）は任意の props（開き閉じ・招く・読めないとき・見出しの字・空のグループの文）を渡す。
//   渡さない呼び方（モック）は今の見た目のまま
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button, Callout } from "@/components/k";
import { Person, type MemberGroup, type MembersFailure } from "@/features/F10/invite/views";
import "./members.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

export interface Group extends MemberGroup {
  /** そのグループのマネージャー（K-710 は「マネージャー：」の後ろの字） */
  manager: string;
  /** グループの id（aria の id に使う。同じ札の字が重なっても id が重ならない・無ければ札の字） */
  key?: string;
}

interface GroupCardProps {
  d: Group;
  open: boolean;
  onToggle?: (code: string) => void;
  empty?: string;
}

function GroupCard({ d, open, onToggle, empty }: GroupCardProps) {
  const invited = d.rows.filter((r) => r.invitedLeft).length;
  const people = d.rows.length - invited;
  const id = d.key ?? d.code;
  const rowsId = `group-rows-${id}`;
  return (
    <section className="k-inv-group k-f9m-group" aria-labelledby={`group-${id}`} data-open={open || undefined}>
      <button
        type="button"
        className="k-f9m-head"
        aria-expanded={open}
        {...(open ? { "aria-controls": rowsId } : {})}
        {...(onToggle ? { onClick: () => onToggle(d.code) } : {})}
      >
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="k-inv-code" data-tone={d.tone} aria-hidden="true">
          {d.code}
        </span>
        <span id={`group-${id}`} className="k-inv-group-name">
          {d.name}
        </span>
        <span className="k-inv-sub">{`${people} 人${invited ? ` ＋ 招待中 ${invited}` : ""}`}</span>
        <span className="k-inv-sub k-f9m-manager">{`マネージャー：${d.manager}`}</span>
      </button>
      {open ? (
        d.rows.length === 0 && empty ? (
          <p className="k-inv-sub k-f9m-empty" id={rowsId}>
            {empty}
          </p>
        ) : (
          <ul className="k-inv-rows" id={rowsId}>
            {d.rows.map((r) => (
              <Person key={r.id} r={r} />
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

export interface GroupMembersBodyProps {
  groups: readonly Group[];
  /** 開いているグループの札の字 */
  open: readonly string[];
  /** グループの行を押したとき（札の字）。無ければ押しても変わらない（モック） */
  onToggle?: (code: string) => void;
  /** 「＋ 招く」を押したとき */
  onInvite?: () => void;
  /** 並びが読めるまで「＋ 招く」は押せない */
  inviteDisabled?: boolean;
  /** 並びを読めなかったとき（本文を「読み込めませんでした」と「もう一度読む」に替える） */
  failure?: MembersFailure;
  /** 見出しの下の字（無ければ行の人数から作る） */
  sub?: string;
  /** 人がいないグループを開いたときの文（無ければ空の一覧） */
  empty?: string;
}

/** メンバーの画面の本文（グループの並び。open のグループだけメンバーが出ている） */
export function GroupMembersBody({
  groups,
  open,
  onToggle,
  onInvite,
  inviteDisabled = false,
  failure,
  sub,
  empty,
}: GroupMembersBodyProps) {
  const total = groups.reduce((n, d) => n + d.rows.filter((r) => !r.invitedLeft).length, 0);
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="members-title">
      <header className="k-page-head">
        <h1 id="members-title">メンバー</h1>
        {failure ? null : (
          <p className="k-page-sub">
            {sub ?? `${groups.length} つのグループ ・ ${total} 人。グループを押すと、そのグループのメンバーが出ます`}
          </p>
        )}
        <div className="k-page-acts">
          <Button variant="outlined" {...inert}>
            ＋ グループ
          </Button>
          <Button {...(onInvite ? { onClick: onInvite } : {})} disabled={inviteDisabled}>
            ＋ 招く
          </Button>
        </div>
      </header>
      <div className="k-inv-body">
        {failure ? (
          <Callout tone="danger">
            <p>{failure.text}</p>
            <Button variant="outlined" size="sm" onClick={failure.onRetry}>
              もう一度読む
            </Button>
          </Callout>
        ) : (
          groups.map((d) => (
            <GroupCard
              key={d.key ?? d.code}
              d={d}
              open={open.includes(d.code)}
              {...(onToggle ? { onToggle } : {})}
              {...(empty ? { empty } : {})}
            />
          ))
        )}
      </div>
    </section>
  );
}
