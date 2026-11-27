"use client";
// メンバーの 1 人の画面の本文（段 11・F10。キャンバス WsMember）。値は props で受け取って描くだけ（口は呼ばない）。
//   区画：グループと役割／担当しているもの／分身／ログイン／最近の記録。人ごとの「できること」は作らない（権限は役割と所属で決まる・D-154.10）。
//   「今月の実行・人ごとの枠」と「2 段階認証を戻す」は後のフェーズなので、出すが押せない形（D-145.9・D-154.3）。キャンバスに無い字は「仮」
import type { ReactNode } from "react";
import { Band, Button } from "@/components/k";
import { RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import "@/features/F10/invite/invite.css";
import type { MemberDetailData } from "./types";
import "./member.css";

const SOON = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

function Head({ d }: { d: MemberDetailData }) {
  const isSelf = d.self === true;
  return (
    <header className="k-page-head">
      <h1 id="member-title">{d.name}</h1>
      <p className="k-page-sub">{`${d.email} ・ ${d.since} から`}</p>
      <div className="k-page-acts">
        {d.suspended ? null : (
          <Button
            variant="outlined"
            {...(isSelf ? { "aria-disabled": true, title: "自分は止められません。抜けるのは自分の設定から" } : {})}
          >
            一時的に止める
          </Button>
        )}
        <Button
          variant="outlined"
          {...(isSelf ? { "aria-disabled": true, title: "自分は外せません。抜けるのは自分の設定から" } : {})}
        >
          ワークスペースから外す
        </Button>
      </div>
    </header>
  );
}

function PeopleCards({ d }: { d: MemberDetailData }) {
  return (
    <>
      <SettingCard title="グループと役割" labelledBy="md-group" aside={<RowButton>グループを移す</RowButton>}>
        <SettingRow name={d.group} detail={`${d.role}${d.roleNote ? ` ・ ${d.roleNote}` : ""}`} />
        <SettingRow
          name="兼ねるグループ"
          detail={d.also.length ? d.also.join("・") : "なし"}
          actions={<RowButton>＋ 兼ねるグループを足す</RowButton>}
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

function RecordCard({ d }: { d: MemberDetailData }) {
  return (
    <SettingCard
      title="最近の記録"
      labelledBy="md-records"
      aside={<RowButton variant="ghost">記録をすべて見る</RowButton>}
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
}

/** メンバーの 1 人の本文（頭・止まっている帯・5 つの区画） */
export function MemberPage({ d, notice }: MemberPageProps) {
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="member-title">
      <Head d={d} />
      <div className="k-f10d-body">
        {notice}
        {d.suspended ? (
          <Band
            tone="wait"
            title="一時的に止まっています"
            sub={`入れなくなっていて、${d.name.split(" ")[0]}のAI も止まっています。担当はそのままです`}
            acts={<Button variant="outlined">戻す</Button>}
          />
        ) : null}
        <PeopleCards d={d} />
        <AvatarCard d={d} />
        <LoginCard d={d} />
        <RecordCard d={d} />
      </div>
    </section>
  );
}
