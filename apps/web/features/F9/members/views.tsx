"use client";
// メンバーの画面（段 10 の作り直し・代表の指摘）：グループごとに分けて見せ、グループを押すと、そのグループのメンバーが出る。
//   1 人 1 行は段 9 の招く葉の部品（features/F10/invite/views.tsx の Person）をそのまま使う。
//   見た目だけ（値は props・口は呼ばない）
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/k";
import { Person, type MemberGroup } from "@/features/F10/invite/views";
import "./members.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

export interface Group extends MemberGroup {
  /** そのグループのマネージャー */
  manager: string;
}

function GroupCard({ d, open }: { d: Group; open: boolean }) {
  const invited = d.rows.filter((r) => r.invitedLeft).length;
  const people = d.rows.length - invited;
  return (
    <section className="k-inv-group k-f9m-group" aria-labelledby={`group-${d.code}`} data-open={open || undefined}>
      <button type="button" className="k-f9m-head" aria-expanded={open} aria-controls={`group-rows-${d.code}`}>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="k-inv-code" data-tone={d.tone} aria-hidden="true">
          {d.code}
        </span>
        <span id={`group-${d.code}`} className="k-inv-group-name">
          {d.name}
        </span>
        <span className="k-inv-sub">{`${people} 人${invited ? ` ＋ 招待中 ${invited}` : ""}`}</span>
        <span className="k-inv-sub k-f9m-manager">{`マネージャー：${d.manager}`}</span>
      </button>
      {open ? (
        <ul className="k-inv-rows" id={`group-rows-${d.code}`}>
          {d.rows.map((r) => (
            <Person key={r.id} r={r} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** メンバーの画面の本文（グループの並び。open のグループだけメンバーが出ている） */
export function GroupMembersBody({ groups, open }: { groups: readonly Group[]; open: readonly string[] }) {
  const total = groups.reduce((n, d) => n + d.rows.filter((r) => !r.invitedLeft).length, 0);
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="members-title">
      <header className="k-page-head">
        <h1 id="members-title">メンバー</h1>
        <p className="k-page-sub">{`${groups.length} つのグループ ・ ${total} 人。グループを押すと、そのグループのメンバーが出ます`}</p>
        <div className="k-page-acts">
          <Button variant="outlined" {...inert}>
            ＋ グループ
          </Button>
          <Button>＋ 招く</Button>
        </div>
      </header>
      <div className="k-inv-body">
        {groups.map((d) => (
          <GroupCard key={d.code} d={d} open={open.includes(d.code)} />
        ))}
      </div>
    </section>
  );
}
