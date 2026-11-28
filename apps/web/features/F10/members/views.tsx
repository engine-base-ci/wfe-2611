"use client";
// メンバーの画面の本文（段 11・F10）。段 10 の GroupMembersBody（グループごとの行・押すと開く）を土台に、
//   段 9・10 でグレーだった物（役割の ▾・行の「⋯」・＋ グループ・このグループに招く・送り直す）を押せる形にした版。
//   グループの見出しの右の「直す」・頭の「並びを替える」（「＋ グループ」の隣）は D-154.53 の置き場（K-806 がつなぐ）。
//   キャンバス WsPeople・EdMemberMenu。値は props で受け取って描くだけ（口は呼ばない）。画面に出る文は、キャンバスに無い所だけ「仮」
//   押す関数は任意の props（渡さない呼び方＝モックは今の見た目のまま）。招待中の行の送り直す・取り消すと「＋ このグループに招く」は K-809。
//   画面が口につながったあと（K-818）：開き閉じ（onToggle）・上の 1 行（band）・押せない入口（disabledButtons）・招く・行の操作（rowActs）・
//   読めないとき（failure）を任意の props で受ける。渡さない呼び方（モック）は今の見た目のまま
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Band, Button, Callout } from "@/components/k";
import "@/features/F10/invite/invite.css";
import { PersonRow, type MemberRowData, type MenuKind, type MoreAction, type RoleName } from "./person-row";
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

/** グループの鍵：口の id（口につないだとき）・無ければ短い名前（モック）。開き閉じと行の key に使う（短い名前は一意でない） */
export const groupKey = (d: Pick<GroupData, "id" | "code">): string => d.id ?? d.code;

/** まだ押せない入口（それぞれの葉が押せる形にする：addGroup は K-805・reorder と editGroup は K-806・inviteGroup は K-809） */
export type PendingButton = "addGroup" | "reorder" | "editGroup" | "inviteGroup";
/** K-809 の呼び名（PendingButton と同じ） */
export type MembersButton = PendingButton;
const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;
const inertIf = (on: boolean) => (on ? inert : {});

/** 行の操作（口につないだとき） */
export interface RowActs {
  onRole: (group: GroupData, row: MemberRowData, role: RoleName) => void;
  onMore: (group: GroupData, row: MemberRowData, action: MoreAction) => void;
  /** 答えを待っている行の key（「グループの鍵:人の id」・鍵は groupKey） */
  busy: string | null;
  /** 名前のリンク先 */
  hrefOf: (row: MemberRowData) => string;
  /** 一時的に止めている人の id */
  suspended: ReadonlySet<string>;
}

/** 招待中の行と「＋ このグループに招く」に渡す押す関数（任意・K-809） */
interface InviteActs {
  onInviteGroup?: ((key: string) => void) | undefined;
  onResend?: ((id: string) => void) | undefined;
  onRevoke?: ((id: string) => void) | undefined;
  resentIds?: readonly string[] | undefined;
  busyId?: string | null | undefined;
}

/** 上の 1 行：気づいてほしいことを知らせるだけ（催促のボタンは持たない・D-154.1）。名前は姓と名（K-818 の上の 1 行・K818-UI-019） */
function Notice() {
  return (
    <Band
      tone="wait"
      title="田中 美咲さんの PC が 3 日つながっていません"
      sub="田中 美咲さんの分身は止まっています ・ 招待中 1 人（kimura@…）"
    />
  );
}

interface GroupCardProps {
  d: GroupData;
  open: boolean;
  menu?: { row: string; kind: MenuKind } | undefined;
  onToggle?: ((key: string) => void) | undefined;
  emptyText?: string | undefined;
  pending: readonly PendingButton[];
  acts?: RowActs | undefined;
  inv?: InviteActs | undefined;
  /** 見出しの「直す」（K-806） */
  onEdit?: (() => void) | undefined;
}

function GroupCard({ d, open, menu, onToggle, emptyText, pending, acts, inv = {}, onEdit }: GroupCardProps) {
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
          {...(open ? { "aria-controls": `group-rows-${gid}` } : {})}
          {...(onToggle ? { onClick: () => onToggle(gid) } : {})}
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
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${d.name}を直す`}
          {...inertIf(pending.includes("editGroup"))}
          onClick={pending.includes("editGroup") ? undefined : onEdit}
        >
          直す
        </Button>
        <Button
          variant="ghost"
          size="sm"
          {...inertIf(pending.includes("inviteGroup"))}
          onClick={inv.onInviteGroup && !pending.includes("inviteGroup") ? () => inv.onInviteGroup?.(gid) : undefined}
        >
          ＋ このグループに招く
        </Button>
      </div>
      {open ? (
        <ul className="k-inv-rows" id={`group-rows-${gid}`}>
          {d.rows.length === 0 && emptyText ? <li className="k-inv-sub">{emptyText}</li> : null}
          {d.rows.map((r) => {
            const key = `${gid}:${r.id}`;
            const id = r.invitedId;
            const invActs = id
              ? {
                  ...(inv.onResend ? { onResend: () => inv.onResend?.(id) } : {}),
                  ...(inv.onRevoke ? { onRevoke: () => inv.onRevoke?.(id) } : {}),
                  busy: inv.busyId === id,
                }
              : {};
            const row = id && inv.resentIds?.includes(id) ? { ...r, resent: true } : r;
            return (
              <PersonRow
                key={key}
                r={row}
                menu={menu?.row === key ? menu.kind : undefined}
                {...(acts
                  ? {
                      onRole: (role: RoleName) => acts.onRole(d, r, role),
                      onMore: (a: MoreAction) => acts.onMore(d, r, a),
                      roleBusy: acts.busy === key,
                      href: acts.hrefOf(r),
                      suspended: acts.suspended.has(r.id),
                      group: d.name,
                    }
                  : {})}
                {...invActs}
              />
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** 並びを読めなかったとき（本文を「読み込めませんでした」と「もう一度読む」に替える・K-420 と同じ） */
export interface MembersFailure {
  text: string;
  onRetry: () => void;
}

export interface MembersPageProps {
  groups: readonly GroupData[];
  /** 開いているグループの鍵（groupKey） */
  open: readonly string[];
  /** 開いているメニュー（行の key は「グループの鍵:人の id」・鍵は groupKey） */
  menu?: { row: string; kind: MenuKind };
  /** 上に出す知らせ（Callout など） */
  notice?: ReactNode;
  /** グループの行を押したとき（グループの鍵） */
  onToggle?: (key: string) => void;
  /** 上の 1 行（undefined＝下絵の固定の 1 行・null＝出さない） */
  band?: ReactNode | null;
  /** 人がいないグループを開いたときの文 */
  emptyText?: string;
  /** まだ押せない入口（aria-disabled と title「まだ使えません」） */
  disabledButtons?: readonly PendingButton[];
  /** 「＋ 招く」を押したとき（グループを決めずに招く・K-420） */
  onInvite?: () => void;
  /** 並びが読めるまで「＋ 招く」は押せない */
  inviteDisabled?: boolean;
  /** 行の操作（口につないだとき） */
  rowActs?: RowActs;
  /** 並びを読めなかったとき */
  failure?: MembersFailure;
  /** 各グループの「＋ このグループに招く」（グループの鍵 groupKey を渡す・K-809） */
  onInviteGroup?: (key: string) => void;
  /** 招待中の行の送り直す・取り消す（招待の id を渡す・K-809） */
  onResend?: (id: string) => void;
  onRevoke?: (id: string) => void;
  /** 送り直した招待の id（行を「送り直しました」にする・K-809） */
  resentIds?: readonly string[];
  /** 答えを待っている招待の id（その行の操作を押せない形に・K-809） */
  busyId?: string | null;
  /** 頭の「＋ グループ」を押した（K-805・渡さなければモックのまま押しても何もしない） */
  onAddGroup?: () => void;
  /** 「＋ グループ」を押せない形にする（並びが読めない間・K-805） */
  addGroupDisabled?: boolean;
  /** グループの見出しの「直す」（グループの鍵 groupKey・K-806） */
  onEditGroup?: (key: string) => void;
  /** 頭の「並びを替える」（K-806） */
  onReorder?: () => void;
  /** 見出しの下の差し込み口（メンバー／ゲストのタブ・K-874）。渡さなければ何も出さない */
  tabs?: ReactNode;
}

/** メンバーの画面の本文（上の 1 行・グループの並び） */
export function MembersPage({
  groups,
  open,
  menu,
  notice,
  onToggle,
  band,
  emptyText,
  disabledButtons = [],
  onInvite,
  inviteDisabled = false,
  rowActs,
  failure,
  onAddGroup,
  addGroupDisabled,
  onEditGroup,
  onReorder,
  tabs,
  ...inv
}: MembersPageProps) {
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="members-title">
      <header className="k-page-head">
        <h1 id="members-title">メンバー</h1>
        <p className="k-page-sub">グループごとに並ぶ。役割はその場で変えられる</p>
        <div className="k-page-acts">
          <Button
            variant="outlined"
            {...inertIf(disabledButtons.includes("addGroup"))}
            onClick={disabledButtons.includes("addGroup") ? undefined : onAddGroup}
            disabled={addGroupDisabled}
          >
            ＋ グループ
          </Button>
          <Button
            variant="outlined"
            {...inertIf(disabledButtons.includes("reorder"))}
            onClick={disabledButtons.includes("reorder") ? undefined : onReorder}
          >
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
      {tabs}
      <div className="k-inv-body k-f10m-body">
        {notice}
        {failure ? (
          <Callout tone="danger">
            <p>{failure.text}</p>
            <Button variant="outlined" size="sm" onClick={failure.onRetry}>
              もう一度読む
            </Button>
          </Callout>
        ) : (
          <>
            {band === undefined ? <Notice /> : band}
            {groups.map((d) => (
              <GroupCard
                key={groupKey(d)}
                d={d}
                open={open.includes(groupKey(d))}
                menu={menu}
                onToggle={onToggle}
                emptyText={emptyText}
                pending={disabledButtons}
                acts={rowActs}
                inv={inv}
                onEdit={onEditGroup ? () => onEditGroup(groupKey(d)) : undefined}
              />
            ))}
            <p className="k-inv-sub">
              「⋯」から：グループを移す・兼ねる・一時的に止める・ワークスペースから外す（外すときは担当しているチケットの引き継ぎ先を選ぶ）
            </p>
          </>
        )}
      </div>
    </section>
  );
}
