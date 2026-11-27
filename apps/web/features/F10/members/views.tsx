"use client";
// メンバーの画面の本文（段 11・F10）。段 10 の GroupMembersBody（グループごとの行・押すと開く）を土台に、
//   段 9・10 でグレーだった物（役割の ▾・行の「⋯」・＋ グループ・このグループに招く・送り直す）を押せる形にした版。
//   グループの見出しの右の「直す」・頭の「並びを替える」（「＋ グループ」の隣）は D-154.53 の置き場（K-806 がつなぐ）。
//   キャンバス WsPeople・EdMemberMenu。値は props で受け取って描くだけ（口は呼ばない）。画面に出る文は、キャンバスに無い所だけ「仮」
//   押す関数は任意の props（渡さない呼び方＝モックは今の見た目のまま）。招待中の行の送り直す・取り消すと「＋ このグループに招く」は K-809、
//   開き閉じ・上の 1 行・まだつないでいない入口（disabledButtons）は K-818 の形
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Band, Button } from "@/components/k";
import "@/features/F10/invite/invite.css";
import { PersonRow, type MemberRowData, type MenuKind } from "./person-row";
import "./members.css";

export interface GroupData {
  /** 口のグループの id（口につないだとき。key と見出しの id に使う） */
  id?: string;
  code: string;
  name: string;
  tone: "teal" | "plum" | "amber" | "indigo";
  /** そのグループのマネージャー */
  manager: string;
  rows: readonly MemberRowData[];
}

/** グループの鍵：口の id（口につないだとき）・無ければ短い名前（モック）。開き閉じと行の key に使う（短い名前は一意でない・K-818 と同じ） */
export const groupKey = (d: Pick<GroupData, "id" | "code">): string => d.id ?? d.code;

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

/** まだつないでいない入口（押せない形・title「まだ使えません」）。addGroup は K-805・reorder と editGroup は K-806 が外す */
export type MembersButton = "addGroup" | "reorder" | "editGroup" | "inviteGroup";
const NOT_YET = { "aria-disabled": true as const, title: "まだ使えません" };

/** 行と見出しに渡す押す関数（任意） */
interface Acts {
  onToggle?: ((key: string) => void) | undefined;
  onInviteGroup?: ((key: string) => void) | undefined;
  onResend?: ((id: string) => void) | undefined;
  onRevoke?: ((id: string) => void) | undefined;
  resentIds?: readonly string[] | undefined;
  busyId?: string | null | undefined;
  disabledButtons?: readonly MembersButton[] | undefined;
}

function GroupCard({
  d,
  open,
  menu,
  acts = {},
}: {
  d: GroupData;
  open: boolean;
  menu?: { row: string; kind: MenuKind } | undefined;
  acts?: Acts;
}) {
  const blocked = (b: MembersButton) => acts.disabledButtons?.includes(b) ?? false;
  const off = (b: MembersButton) => (blocked(b) ? NOT_YET : {});
  const invited = d.rows.filter((r) => r.invitedLeft).length;
  const people = d.rows.length - invited;
  const gid = groupKey(d);
  return (
    <section className="k-inv-group k-f10m-group" aria-labelledby={`group-${gid}`} data-open={open || undefined}>
      <div className="k-f10m-head">
        <button
          type="button"
          className="k-f10m-toggle"
          aria-expanded={open}
          aria-controls={`group-rows-${gid}`}
          onClick={acts.onToggle ? () => acts.onToggle?.(gid) : undefined}
        >
          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          <span className="k-inv-code" data-tone={d.tone} aria-hidden="true">
            {d.code}
          </span>
          <span id={`group-${gid}`} className="k-inv-group-name">
            {d.name}
          </span>
          <span className="k-inv-sub">{`${people} 人${invited ? ` ＋ 招待中 ${invited}` : ""}`}</span>
          <span className="k-inv-sub k-f10m-manager">{`マネージャー：${d.manager}`}</span>
        </button>
        <Button variant="ghost" size="sm" aria-label={`${d.name}を直す`} {...off("editGroup")}>
          直す
        </Button>
        <Button
          variant="ghost"
          size="sm"
          {...off("inviteGroup")}
          onClick={acts.onInviteGroup && !blocked("inviteGroup") ? () => acts.onInviteGroup?.(gid) : undefined}
        >
          ＋ このグループに招く
        </Button>
      </div>
      {open ? (
        <ul className="k-inv-rows" id={`group-rows-${gid}`}>
          {d.rows.map((r) => {
            const key = `${gid}:${r.id}`;
            const id = r.invitedId;
            const rowActs = id
              ? {
                  ...(acts.onResend ? { onResend: () => acts.onResend?.(id) } : {}),
                  ...(acts.onRevoke ? { onRevoke: () => acts.onRevoke?.(id) } : {}),
                  busy: acts.busyId === id,
                }
              : {};
            const row = id && acts.resentIds?.includes(id) ? { ...r, resent: true } : r;
            return <PersonRow key={key} r={row} menu={menu?.row === key ? menu.kind : undefined} {...rowActs} />;
          })}
        </ul>
      ) : null}
    </section>
  );
}

export interface MembersPageProps {
  groups: readonly GroupData[];
  /** 開いているグループの鍵（groupKey） */
  open: readonly string[];
  /** 開いているメニュー（行の key は「グループの鍵:人の id」・鍵は groupKey） */
  menu?: { row: string; kind: MenuKind };
  /** 上に出す知らせ（Callout など） */
  notice?: ReactNode;
  /** 上の 1 行（undefined＝下絵の固定の 1 行・null＝出さない・K-818） */
  band?: ReactNode | null;
  /** 頭の「＋ 招く」（グループを決めずに招く・K-420） */
  onInvite?: () => void;
  inviteDisabled?: boolean;
  /** グループの見出しを押して開き閉じする（K-818） */
  onToggle?: (key: string) => void;
  /** 各グループの「＋ このグループに招く」（グループの鍵 groupKey を渡す・K-809） */
  onInviteGroup?: (key: string) => void;
  /** 招待中の行の送り直す・取り消す（招待の id を渡す・K-809） */
  onResend?: (id: string) => void;
  onRevoke?: (id: string) => void;
  /** 送り直した招待の id（行を「送り直しました」にする・K-809） */
  resentIds?: readonly string[];
  /** 答えを待っている招待の id（その行の操作を押せない形に・K-809） */
  busyId?: string | null;
  /** まだつないでいない入口（K-818） */
  disabledButtons?: readonly MembersButton[];
}

/** メンバーの画面の本文（上の 1 行・グループの並び） */
export function MembersPage({
  groups,
  open,
  menu,
  notice,
  band,
  onInvite,
  inviteDisabled = false,
  ...acts
}: MembersPageProps) {
  const off = (b: MembersButton) => (acts.disabledButtons?.includes(b) ? NOT_YET : {});
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="members-title">
      <header className="k-page-head">
        <h1 id="members-title">メンバー</h1>
        <p className="k-page-sub">グループごとに並ぶ。役割はその場で変えられる</p>
        <div className="k-page-acts">
          <Button variant="outlined" {...off("addGroup")}>
            ＋ グループ
          </Button>
          <Button variant="outlined" {...off("reorder")}>
            並びを替える
          </Button>
          <Button
            {...(inviteDisabled ? { "aria-disabled": true as const } : {})}
            onClick={inviteDisabled ? undefined : onInvite}
          >
            ＋ 招く
          </Button>
        </div>
      </header>
      <div className="k-inv-body k-f10m-body">
        {notice}
        {band === undefined ? <Notice /> : band}
        {groups.map((d) => (
          <GroupCard key={groupKey(d)} d={d} open={open.includes(groupKey(d))} menu={menu} acts={acts} />
        ))}
        <p className="k-inv-sub">
          「⋯」から：グループを移す・兼ねる・一時的に止める・ワークスペースから外す（外すときは担当しているチケットの引き継ぎ先を選ぶ）
        </p>
      </div>
    </section>
  );
}
