"use client";
// メンバーの画面の本文（段 11・F10）。段 10 の GroupMembersBody（グループごとの行・押すと開く）を土台に、
//   段 9・10 でグレーだった物（役割の ▾・行の「⋯」・＋ グループ・このグループに招く・送り直す）を押せる形にした版。
//   グループの見出しの右の「直す」・頭の「並びを替える」（「＋ グループ」の隣）は D-154.53 の置き場（K-806 がつなぐ）。
//   キャンバス WsPeople・EdMemberMenu。値は props で受け取って描くだけ（口は呼ばない）。画面に出る文は、キャンバスに無い所だけ「仮」
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Band, Button } from "@/components/k";
import "@/features/F10/invite/invite.css";
import { PersonRow, type MemberRowData, type MenuKind } from "./person-row";
import "./members.css";

export interface GroupData {
  code: string;
  name: string;
  tone: "teal" | "plum" | "amber" | "indigo";
  /** そのグループのマネージャー */
  manager: string;
  rows: readonly MemberRowData[];
}

/** 上の 1 行：気づいてほしいことを知らせるだけ（催促のボタンは持たない・D-154.1） */
function Notice() {
  return (
    <Band
      tone="wait"
      title="田中さんの PC が 3 日つながっていません"
      sub="田中さんの分身は止まっています ・ 招待中 1 人（kimura@…）"
    />
  );
}

function GroupCard({
  d,
  open,
  menu,
}: {
  d: GroupData;
  open: boolean;
  menu?: { row: string; kind: MenuKind } | undefined;
}) {
  const invited = d.rows.filter((r) => r.invitedLeft).length;
  const people = d.rows.length - invited;
  return (
    <section className="k-inv-group k-f10m-group" aria-labelledby={`group-${d.code}`} data-open={open || undefined}>
      <div className="k-f10m-head">
        <button type="button" className="k-f10m-toggle" aria-expanded={open} aria-controls={`group-rows-${d.code}`}>
          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          <span className="k-inv-code" data-tone={d.tone} aria-hidden="true">
            {d.code}
          </span>
          <span id={`group-${d.code}`} className="k-inv-group-name">
            {d.name}
          </span>
          <span className="k-inv-sub">{`${people} 人${invited ? ` ＋ 招待中 ${invited}` : ""}`}</span>
          <span className="k-inv-sub k-f10m-manager">{`マネージャー：${d.manager}`}</span>
        </button>
        <Button variant="ghost" size="sm" aria-label={`${d.name}を直す`}>
          直す
        </Button>
        <Button variant="ghost" size="sm">
          ＋ このグループに招く
        </Button>
      </div>
      {open ? (
        <ul className="k-inv-rows" id={`group-rows-${d.code}`}>
          {d.rows.map((r) => {
            const key = `${d.code}:${r.id}`;
            return <PersonRow key={key} r={r} menu={menu?.row === key ? menu.kind : undefined} />;
          })}
        </ul>
      ) : null}
    </section>
  );
}

export interface MembersPageProps {
  groups: readonly GroupData[];
  /** 開いているグループの短い名前 */
  open: readonly string[];
  /** 開いているメニュー（行の key は「グループの短い名前:人の id」） */
  menu?: { row: string; kind: MenuKind };
  /** 上に出す知らせ（Callout など） */
  notice?: ReactNode;
}

/** メンバーの画面の本文（上の 1 行・グループの並び） */
export function MembersPage({ groups, open, menu, notice }: MembersPageProps) {
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="members-title">
      <header className="k-page-head">
        <h1 id="members-title">メンバー</h1>
        <p className="k-page-sub">グループごとに並ぶ。役割はその場で変えられる</p>
        <div className="k-page-acts">
          <Button variant="outlined">＋ グループ</Button>
          <Button variant="outlined">並びを替える</Button>
          <Button>＋ 招く</Button>
        </div>
      </header>
      <div className="k-inv-body k-f10m-body">
        {notice}
        <Notice />
        {groups.map((d) => (
          <GroupCard key={d.code} d={d} open={open.includes(d.code)} menu={menu} />
        ))}
        <p className="k-inv-sub">
          「⋯」から：グループを移す・兼ねる・一時的に止める・ワークスペースから外す（外すときは担当しているチケットの引き継ぎ先を選ぶ）
        </p>
      </div>
    </section>
  );
}
