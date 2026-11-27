"use client";
// メンバーの 1 人 1 行（段 11）：段 9 の Person と同じ並び（丸いアイコン・名前とメール・役割・状態・操作）に、
//   役割の ▾（押すと役割の一覧）・行の「⋯」（メンバーの操作）・招待中の行の「送り直す」「取り消す」を押せる形にした版。
//   値は props で受け取って描くだけ（口は呼ばない）。メニューの開き方（menu）で、開いた形も描ける。
//   招待中の行の「送り直す」「取り消す」は、関数を渡したときだけ押して動く（K-809・渡さない呼び方＝モックは今の見た目のまま）
//   画面が口につながったあと（K-818）：押したときの関数（onRole・onMore）・名前のリンク（href）・止めている人（suspended）を任意の props で受ける。
//   渡さない呼び方（モック）は今の見た目のまま
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import "@/features/F10/invite/invite.css";
import "./members.css";

export const ROLES = ["管理者", "マネージャー", "メンバー", "閲覧のみ"] as const;
export type RoleName = (typeof ROLES)[number];

export interface MemberRowData {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  /** 状態の 1 行（分身 動いている・PC 3 日つながっていない・分身なし） */
  state: string;
  stateTone: "ok" | "warn" | "none";
  /** 名前の横の小さな注（自分・経理も兼ねる・兼ねている） */
  note?: string;
  /** 自分の行（役割は変えられない） */
  self?: boolean;
  /** 最後に使った日（今日・3 日前・12 日前から使っていない）。招待中の行は持たない。字は仮（D-154.1） */
  lastUsed?: string;
  /** 長く使っていない（目立たせる） */
  lastUsedAway?: boolean;
  /** 招待中（まだ入っていない）なら「あと N 日」 */
  invitedLeft?: string;
  /** 招待を送り直した直後 */
  resent?: boolean;
  /** 招待中の行の招待の id（送り直す・取り消すの口が指す・K-809） */
  invitedId?: string;
}
export type MenuKind = "role" | "more";
/** 行の「⋯」の項目（role は同じ行の役割の ▾ を開く・ほかは呼ぶ側が行き先を決める） */
export type MoreAction = "role" | "move" | "also" | "tickets" | "suspend" | "resume" | "remove";

function RoleCell({
  r,
  open,
  onRole,
  busy = false,
}: {
  r: MemberRowData;
  open: boolean;
  onRole?: ((role: RoleName) => void) | undefined;
  busy?: boolean;
}) {
  const admin = r.role === "管理者";
  const cls = admin ? "k-inv-role k-f10m-role k-f10m-admin" : "k-inv-role k-f10m-role";
  const label = `${r.name}の役割を変える（いま ${r.role}）`;
  if (r.self) {
    return (
      <button
        type="button"
        className={cls}
        aria-label={label}
        aria-disabled="true"
        title="自分の役割は、自分では変えられません"
      >
        {`${r.role} ▾`}
      </button>
    );
  }
  return (
    <Menu defaultOpen={open}>
      <MenuTrigger className={cls} label={label} disabled={busy}>
        {`${r.role} ▾`}
      </MenuTrigger>
      <MenuPopup align="start" className="k-f10m-menu">
        <div className="k-f10m-menu-title">{`${r.name}の役割`}</div>
        {ROLES.map((x) => (
          <MenuItem key={x} {...(onRole ? { onSelect: () => onRole(x) } : {})}>
            <span className="k-f10m-check" aria-hidden="true">
              {x === r.role ? "✓" : ""}
            </span>
            {x}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function Item({
  label,
  sub,
  danger = false,
  disabled = false,
  onSelect,
}: {
  label: string;
  sub?: string | undefined;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: (() => void) | undefined;
}) {
  return (
    <MenuItem {...(danger ? { className: "k-f10m-danger" } : {})} disabled={disabled} onSelect={onSelect}>
      <span className="k-f10m-mi">
        <span>{label}</span>
        {sub ? <span className="k-f10m-mi-sub">{sub}</span> : null}
      </span>
    </MenuItem>
  );
}

interface MoreProps {
  r: MemberRowData;
  open: boolean;
  /** 押したときの関数（無ければモックの見た目だけ） */
  onMore?: ((action: MoreAction) => void) | undefined;
  /** 押した行のグループの名前（「グループを移す」の「いま：」） */
  group?: string | undefined;
  suspended?: boolean | undefined;
}

function MoreCell({ r, open, onMore, group, suspended = false }: MoreProps) {
  const live = Boolean(onMore);
  const go = (a: MoreAction) => (onMore ? () => onMore(a) : undefined);
  return (
    <Menu defaultOpen={open}>
      <MenuTrigger className="k-f10m-more" label={`${r.name}のほかの操作`}>
        ⋯
      </MenuTrigger>
      <MenuPopup align="end" className="k-f10m-menu">
        <div className="k-f10m-menu-title">{r.name}</div>
        <Item label="役割を変える" sub={`いま：${r.role}`} onSelect={go("role")} />
        <Item
          label="グループを移す"
          sub={live ? (group ? `いま：${group}` : undefined) : "いま：営業"}
          onSelect={go("move")}
        />
        <Item label="兼ねるグループを足す" onSelect={go("also")} />
        <Item label="担当しているチケットを見る" sub={live ? undefined : "4 件"} onSelect={go("tickets")} />
        {suspended ? (
          <Item label="戻す" sub="また入れるようになる・分身も動く" onSelect={go("resume")} />
        ) : (
          <Item
            label="一時的に止める"
            sub="入れなくなる・分身も止まる。担当はそのまま"
            disabled={Boolean(r.self)}
            onSelect={go("suspend")}
          />
        )}
        <Item
          label="ワークスペースから外す"
          sub="担当の引き継ぎ先を選ぶ"
          danger
          disabled={Boolean(r.self)}
          onSelect={go("remove")}
        />
      </MenuPopup>
    </Menu>
  );
}

/** 招待中の行の操作（K-809）。答えを待つ間（busy）は押せない形（aria-disabled）で、押しても何もしない */
export interface InvitedActs {
  onResend?: () => void;
  onRevoke?: () => void;
  busy?: boolean;
}

export interface PersonRowProps extends InvitedActs {
  r: MemberRowData;
  /** 開いた形で描くメニュー（モック） */
  menu?: MenuKind | undefined;
  /** 役割を選んだとき（いまと同じ役割でも呼ぶ・呼ぶ側が決める） */
  onRole?: ((role: RoleName) => void) | undefined;
  /** 役割を変える口の答えを待っている（▾ を押せない） */
  roleBusy?: boolean | undefined;
  /** 「⋯」の項目を選んだとき（role は部品の中で役割の ▾ を開く） */
  onMore?: ((action: MoreAction) => void) | undefined;
  /** 名前のリンク先（メンバーの 1 人の画面） */
  href?: string | undefined;
  /** 一時的に止めている人（「一時的に止める」が「戻す」に替わる） */
  suspended?: boolean | undefined;
  /** この行のグループの名前 */
  group?: string | undefined;
}

/** 1 人 1 行。menu を渡すと、その行のそのメニューが開いた形で描かれる */
export function PersonRow({
  r,
  menu,
  onRole,
  roleBusy,
  onMore,
  href,
  suspended,
  group,
  onResend,
  onRevoke,
  busy = false,
}: PersonRowProps) {
  const invited = Boolean(r.invitedLeft);
  const wait = busy ? { "aria-disabled": true as const } : {};
  // 「⋯」の「役割を変える」で役割の ▾ を開く（メニューは開いた形で描き直す）
  const [roleOpen, setRoleOpen] = useState(0);
  const more = onMore ? (a: MoreAction) => (a === "role" ? setRoleOpen((n) => n + 1) : onMore(a)) : undefined;
  return (
    <li className="k-inv-row k-f10m-row" data-invited={invited || undefined}>
      <span className="k-inv-avatar" data-invited={invited || undefined} aria-hidden="true">
        {invited ? "？" : r.name.slice(0, 1)}
      </span>
      <span className="k-inv-who">
        <span className="k-inv-name">
          {invited ? r.email : href ? <Link href={href}>{r.name}</Link> : r.name}
          {r.note ? <span className="k-inv-note">{r.note}</span> : null}
        </span>
        {invited && r.resent ? (
          <span className="k-inv-sub k-f10m-sent-sub" role="status">
            {`送り直しました ・ あと ${r.invitedLeft}`}
          </span>
        ) : (
          <span className="k-inv-sub">{invited ? `招待中 ・ あと ${r.invitedLeft}` : r.email}</span>
        )}
      </span>
      <span className="k-inv-role-cell">
        {invited ? (
          <Badge tone="progress">招待中</Badge>
        ) : (
          <RoleCell
            key={roleOpen}
            r={r}
            open={menu === "role" || roleOpen > 0}
            onRole={onRole}
            busy={Boolean(roleBusy)}
          />
        )}
      </span>
      <span className="k-inv-state" data-tone={r.stateTone}>
        {invited ? "" : r.state}
      </span>
      <span className="k-f10m-last" data-away={r.lastUsedAway || undefined}>
        {invited ? null : (
          <>
            <small>最後に使った日</small>
            <span>{r.lastUsed}</span>
          </>
        )}
      </span>
      <span className="k-inv-more k-f10m-acts">
        {invited ? (
          <>
            {/* 押せる大きさは 32px 以上（スマホでも・D-154.13）＝ md */}
            <Button variant="outlined" {...wait} onClick={busy ? undefined : onResend}>
              送り直す
            </Button>
            <Button variant="ghost" {...wait} onClick={busy ? undefined : onRevoke}>
              取り消す
            </Button>
          </>
        ) : (
          <MoreCell r={r} open={menu === "more"} onMore={more} group={group} suspended={suspended} />
        )}
      </span>
    </li>
  );
}
