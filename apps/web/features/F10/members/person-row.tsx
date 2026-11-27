"use client";
// メンバーの 1 人 1 行（段 11）：段 9 の Person と同じ並び（丸いアイコン・名前とメール・役割・状態・操作）に、
//   役割の ▾（押すと役割の一覧）・行の「⋯」（メンバーの操作）・招待中の行の「送り直す」「取り消す」を押せる形にした版。
//   値は props で受け取って描くだけ（口は呼ばない）。メニューの開き方（menu）で、開いた形も描ける。
//   招待中の行の「送り直す」「取り消す」は、関数を渡したときだけ押して動く（K-809・渡さない呼び方＝モックは今の見た目のまま）
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

function RoleCell({ r, open }: { r: MemberRowData; open: boolean }) {
  const admin = r.role === "管理者";
  if (r.self) {
    return (
      <button
        type="button"
        className={admin ? "k-inv-role k-f10m-role k-f10m-admin" : "k-inv-role k-f10m-role"}
        aria-disabled="true"
        title="自分の役割は、自分では変えられません"
      >
        {`${r.role} ▾`}
      </button>
    );
  }
  return (
    <Menu defaultOpen={open}>
      <MenuTrigger
        className={admin ? "k-inv-role k-f10m-role k-f10m-admin" : "k-inv-role k-f10m-role"}
        label={`${r.name}の役割を変える（いま ${r.role}）`}
      >
        {`${r.role} ▾`}
      </MenuTrigger>
      <MenuPopup align="start" className="k-f10m-menu">
        <div className="k-f10m-menu-title">{`${r.name}の役割`}</div>
        {ROLES.map((x) => (
          <MenuItem key={x}>
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

function Item({ label, sub, danger = false }: { label: string; sub?: string; danger?: boolean }) {
  return (
    <MenuItem {...(danger ? { className: "k-f10m-danger" } : {})}>
      <span className="k-f10m-mi">
        <span>{label}</span>
        {sub ? <span className="k-f10m-mi-sub">{sub}</span> : null}
      </span>
    </MenuItem>
  );
}

function MoreCell({ r, open }: { r: MemberRowData; open: boolean }) {
  return (
    <Menu defaultOpen={open}>
      <MenuTrigger className="k-f10m-more" label={`${r.name}のほかの操作`}>
        ⋯
      </MenuTrigger>
      <MenuPopup align="end" className="k-f10m-menu">
        <div className="k-f10m-menu-title">{r.name}</div>
        <Item label="役割を変える" sub={`いま：${r.role}`} />
        <Item label="グループを移す" sub="いま：営業" />
        <Item label="兼ねるグループを足す" />
        <Item label="担当しているチケットを見る" sub="4 件" />
        <Item label="一時的に止める" sub="入れなくなる・分身も止まる。担当はそのまま" />
        <Item label="ワークスペースから外す" sub="担当の引き継ぎ先を選ぶ" danger />
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

/** 1 人 1 行。menu を渡すと、その行のそのメニューが開いた形で描かれる */
export function PersonRow({
  r,
  menu,
  onResend,
  onRevoke,
  busy = false,
}: { r: MemberRowData; menu?: MenuKind | undefined } & InvitedActs) {
  const invited = Boolean(r.invitedLeft);
  const wait = busy ? { "aria-disabled": true as const } : {};
  return (
    <li className="k-inv-row k-f10m-row" data-invited={invited || undefined}>
      <span className="k-inv-avatar" data-invited={invited || undefined} aria-hidden="true">
        {invited ? "？" : r.name.slice(0, 1)}
      </span>
      <span className="k-inv-who">
        <span className="k-inv-name">
          {invited ? r.email : r.name}
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
        {invited ? <Badge tone="progress">招待中</Badge> : <RoleCell r={r} open={menu === "role"} />}
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
          <MoreCell r={r} open={menu === "more"} />
        )}
      </span>
    </li>
  );
}
