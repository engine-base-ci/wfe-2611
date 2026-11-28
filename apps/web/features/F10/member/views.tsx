"use client";
// メンバーの 1 人の画面の本文（段 11・F10。キャンバス WsMember）。値は props で受け取って描くだけ（口は呼ばない）。
//   区画：グループと役割／担当しているもの／分身／ログイン／最近の記録。人ごとの「できること」は作らない（権限は役割と所属で決まる・D-154.10）。
//   「今月の実行・人ごとの枠」と「2 段階認証を戻す」は後のフェーズなので、出すが押せない形（D-145.9・D-154.3）。キャンバスに無い字は「仮」
//   画面（K-819）が任意の props で渡す物：disabledActions（小窓の登録が無い操作は押せない形）・onAction・recordsDisabled・onRecords。
//   渡さない呼び方（下絵）は今の見た目のまま。自分を開いたときは自分の title が disabledActions の「まだ使えません」より勝つ
//   K-820：自分のときは「グループを移す」「＋ 兼ねるグループを足す」も押せない形（自分の title・tabIndex -1）
import type { ReactNode } from "react";
import { Band, Button } from "@/components/k";
import { RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import "@/features/F10/invite/invite.css";
import type { MemberDetailData } from "./types";
import "./member.css";

const SOON = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

/** 画面の外の小窓で行う操作（グループを移す・兼ねる・止める・戻す・外す） */
export type Action = "move" | "also" | "suspend" | "resume" | "remove";

/** 自分を開いたとき押せない操作と、その title（部品が前から持つ自分の扱い） */
const SELF_TITLE: Partial<Record<Action, string>> = {
  suspend: "自分は止められません。抜けるのは自分の設定から",
  remove: "自分は外せません。抜けるのは自分の設定から",
  move: "自分のグループは、自分では変えられません",
  also: "自分のグループは、自分では変えられません",
};
/** 自分のとき、焦点も当てない操作（K-820） */
const SELF_NO_FOCUS: readonly Action[] = ["move", "also"];

interface ActCtx {
  self: boolean;
  off: readonly Action[];
  on: ((a: Action) => void) | undefined;
}

/** 操作のボタンに付ける物：自分 → 自分の title・登録が無い → まだ使えません・ほか → 押すと onAction */
function actOf(a: Action, c: ActCtx) {
  const selfTitle = c.self ? SELF_TITLE[a] : undefined;
  if (selfTitle)
    return SELF_NO_FOCUS.includes(a)
      ? ({ "aria-disabled": true, tabIndex: -1, title: selfTitle } as const)
      : ({ "aria-disabled": true, title: selfTitle } as const);
  if (c.off.includes(a)) return SOON;
  return { onClick: () => c.on?.(a) };
}

function Head({ d, c }: { d: MemberDetailData; c: ActCtx }) {
  return (
    <header className="k-page-head">
      <h1 id="member-title">{d.name}</h1>
      <p className="k-page-sub">{`${d.email} ・ ${d.since} から`}</p>
      <div className="k-page-acts">
        {d.suspended ? null : (
          <Button variant="outlined" {...actOf("suspend", c)}>
            一時的に止める
          </Button>
        )}
        <Button variant="outlined" {...actOf("remove", c)}>
          ワークスペースから外す
        </Button>
      </div>
    </header>
  );
}

function PeopleCards({ d, c }: { d: MemberDetailData; c: ActCtx }) {
  return (
    <>
      <SettingCard
        title="グループと役割"
        labelledBy="md-group"
        aside={<RowButton {...actOf("move", c)}>グループを移す</RowButton>}
      >
        <SettingRow name={d.group} detail={`${d.role}${d.roleNote ? ` ・ ${d.roleNote}` : ""}`} />
        <SettingRow
          name="兼ねるグループ"
          detail={d.also.length ? d.also.join("・") : "なし"}
          actions={<RowButton {...actOf("also", c)}>＋ 兼ねるグループを足す</RowButton>}
        />
      </SettingCard>
      <SettingCard title="担当しているもの" labelledBy="md-own">
        <SettingRow name="チケット" detail={d.ticketLine} />
      </SettingCard>
    </>
  );
}

function AvatarCard({ d }: { d: MemberDetailData }) {
  return (
    <SettingCard title="分身" labelledBy="md-avatar">
      <SettingRow name={d.pcLine} />
      <SettingRow
        name={d.runsLine}
        detail="使った量は、あとで見られるようになります"
        disabled
        actions={
          <RowButton variant="ghost" {...SOON}>
            くわしく
          </RowButton>
        }
      />
      <SettingRow name={d.stuckLine} />
    </SettingCard>
  );
}

function LoginCard({ d }: { d: MemberDetailData }) {
  return (
    <SettingCard title="ログイン" labelledBy="md-login">
      <SettingRow name="入り方" detail={d.loginHow} />
      <SettingRow
        name="2 段階認証"
        detail={d.twofa}
        actions={
          d.twofaApp ? (
            <RowButton variant="ghost" {...SOON}>
              2 段階認証を戻す
            </RowButton>
          ) : undefined
        }
      />
      <SettingRow name="最後に入った" detail={d.lastLogin} />
      <SettingNote>
        パスワードで入る人が認証アプリをなくしたときに 2 段階認証を戻す操作は、あとで使えるようになります
      </SettingNote>
    </SettingCard>
  );
}

function RecordCard({ d, off, onRecords }: { d: MemberDetailData; off: boolean; onRecords: (() => void) | undefined }) {
  return (
    <SettingCard
      title="最近の記録"
      labelledBy="md-records"
      aside={
        <RowButton variant="ghost" {...(off ? SOON : { onClick: () => onRecords?.() })}>
          記録をすべて見る
        </RowButton>
      }
    >
      {d.records.map((r) => (
        <SettingRow key={r.when + r.text} name={r.text} detail={r.when} />
      ))}
    </SettingCard>
  );
}

export interface MemberPageProps {
  d: MemberDetailData;
  /** 上に出す知らせ（Callout など） */
  notice?: ReactNode;
  /** 押せない形にする操作（小窓の登録が無い物・aria-disabled・title「まだ使えません」・押しても何も起きない） */
  disabledActions?: readonly Action[];
  /** 操作のボタンを押したとき（押せない形のときは呼ばない） */
  onAction?: (a: Action) => void;
  /** 「記録をすべて見る」を押せない形にする（記録の画面がまだ無い） */
  recordsDisabled?: boolean;
  /** 「記録をすべて見る」を押したとき */
  onRecords?: () => void;
}

/** メンバーの 1 人の本文（頭・止まっている帯・5 つの区画） */
export function MemberPage({
  d,
  notice,
  disabledActions = [],
  onAction,
  recordsDisabled = false,
  onRecords,
}: MemberPageProps) {
  const c: ActCtx = { self: d.self === true, off: disabledActions, on: onAction };
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="member-title">
      <Head d={d} c={c} />
      <div className="k-f10d-body">
        {notice}
        {d.suspended ? (
          <Band
            tone="wait"
            title="一時的に止まっています"
            sub={`入れなくなっていて、${d.name.split(" ")[0]}のAI も止まっています。担当はそのままです`}
            acts={
              <Button variant="outlined" {...actOf("resume", c)}>
                戻す
              </Button>
            }
          />
        ) : null}
        <PeopleCards d={d} c={c} />
        <AvatarCard d={d} />
        <LoginCard d={d} />
        <RecordCard d={d} off={recordsDisabled} onRecords={onRecords} />
      </div>
    </section>
  );
}
