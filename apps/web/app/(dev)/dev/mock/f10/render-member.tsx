"use client";
// 段 11 の下絵：メンバーの 1 人（md-*）。部品は features/F10/member（値を受け取って描くだけ）。
//   キャンバス WsMember・EdMemberRemove・EdMemberMenu。「できること」の欄と小窓は作らない（D-154.10）。キャンバスに無い状態の画面の字は「仮」
import type { ReactNode } from "react";
import { Callout, ErrorState } from "@/components/k";
import { AlsoDialog, MoveDialog } from "@/features/F10/member/dialogs-group";
import { ResumeConfirm, SuspendConfirm } from "@/features/F10/member/dialogs-confirm";
import { RemoveDialog, type RemoveMode } from "@/features/F10/member/dialog-remove";
import type { MemberDetailData, TicketHand } from "@/features/F10/member/types";
import { MemberPage } from "@/features/F10/member/views";
import type { Theme } from "@/lib/theme";
import { WsFrame } from "./frame";

// 役割の但し書き（roleNote）を持たない土台。口に鍵が無い但し書きは、止めた人・最後の管理者の絵では出さない（K-819）
const BASE_PLAIN: MemberDetailData = {
  name: "鈴木 一郎",
  email: "suzuki@engine-base.example",
  since: "2026-04-10",
  group: "営業",
  role: "メンバー",
  also: [],
  ticketLine: "担当 6 件 ・ 期限切れ 0 ・ 渡し中 0",
  pcLine: "PC つながっている（MacBook Air）",
  pcTone: "ok",
  runsLine: "今月の実行 — ・ 人ごとの枠 —",
  stuckLine: "止まった（7 日） 0",
  loginHow: "パスキー 2 つ",
  twofa: "付けていない（パスキーで入るので要らない）",
  twofaApp: false,
  lastLogin: "11/02 09:12",
  records: [
    // 記録のことばは action ごとの決まった字（役割が変わった・K-819 の最近の記録）。前と後の役割は記録の画面（K-825）で見る
    { when: "11/02 09:58", text: "役割が変わった（高本）" },
    { when: "10/12 14:20", text: "グループが変わった（高本）" },
  ],
};
const BASE: MemberDetailData = { ...BASE_PLAIN, roleNote: "11/02 にマネージャーから（高本）" };
const SELF: MemberDetailData = {
  ...BASE,
  name: "高本 聖斗",
  email: "takamoto@engine-base.example",
  role: "管理者",
  self: true,
  roleNote: "ワークスペースを作った人",
  records: [{ when: "11/02 09:12", text: "入った" }],
};
const SUSPENDED: MemberDetailData = {
  ...BASE_PLAIN,
  name: "山口 健",
  email: "yamaguchi@engine-base.example",
  group: "受託開発",
  role: "閲覧のみ",
  ticketLine: "担当 0 件 ・ 期限切れ 0 ・ 渡し中 0",
  pcLine: "分身なし（見るだけ）",
  pcTone: "none",
  suspended: true,
  records: [{ when: "11/01 17:40", text: "一時的に止めた（高本）" }],
};
const APP_USER: MemberDetailData = {
  ...BASE,
  name: "田中 美咲",
  email: "tanaka@engine-base.example",
  also: ["経理"],
  pcLine: "PC 3 日つながっていない",
  pcTone: "warn",
  loginHow: "パスワード",
  twofa: "付けている（認証アプリ）",
  twofaApp: true,
};
const LAST_ADMIN: MemberDetailData = {
  ...BASE_PLAIN,
  name: "佐藤 花子",
  email: "sato@engine-base.example",
  role: "管理者",
};

const TICKETS: readonly TicketHand[] = [
  { code: "EG-126", title: "セイコー様 更新の見積", status: "確認中" },
  { code: "EG-129", title: "契約書の更新版を送る", status: "未着手" },
  { code: "EG-131", title: "セイコー様 来期の提案", status: "作業中" },
  { code: "EG-119", title: "問い合わせ（山田様）に一次返信", status: "渡し中", handing: true },
];

function Page({
  theme,
  d = BASE,
  dialog,
  notice,
}: {
  theme: Theme;
  d?: MemberDetailData;
  dialog?: ReactNode;
  notice?: ReactNode;
}) {
  return (
    <WsFrame theme={theme} active="members" tail={d.name} dialog={dialog}>
      <MemberPage d={d} notice={notice} />
    </WsFrame>
  );
}

function remove(theme: Theme, mode: RemoveMode): ReactNode {
  const rows = mode === "none" ? [] : TICKETS;
  return <Page theme={theme} dialog={<RemoveDialog name="鈴木 一郎" mode={mode} tickets={rows} />} />;
}

export function renderMember(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "md-view":
      return <Page theme={theme} />;
    case "md-self":
      return <Page theme={theme} d={SELF} />;
    case "md-suspended":
      return <Page theme={theme} d={SUSPENDED} />;
    case "md-failed":
      return (
        <WsFrame theme={theme} active="members">
          <section className="k-root k-page k-me-page k-inv-page" aria-label="メンバーの 1 人">
            <ErrorState code="E-PAGE-001" acts={["/members"]} />
          </section>
        </WsFrame>
      );
    case "md-move":
      return <Page theme={theme} dialog={<MoveDialog open name="鈴木 一郎" from="営業" to="受託開発" />} />;
    case "md-also":
      return (
        <Page
          theme={theme}
          d={{ ...BASE, also: ["受託開発"] }}
          dialog={<AlsoDialog open name="鈴木 一郎" also={["受託開発"]} add="経理" />}
        />
      );
    case "md-suspend":
      return <Page theme={theme} dialog={<SuspendConfirm name="鈴木 一郎" />} />;
    case "md-resume":
      return <Page theme={theme} d={SUSPENDED} dialog={<ResumeConfirm name="山口 健" />} />;
    case "md-remove":
      return remove(theme, "all");
    case "md-remove-each":
      return remove(theme, "each");
    case "md-remove-none":
      return remove(theme, "none");
    case "md-remove-last-admin":
      return (
        <Page
          theme={theme}
          d={LAST_ADMIN}
          notice={
            <Callout tone="danger" title="外せません">
              佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、外してください
            </Callout>
          }
        />
      );
    case "md-2fa-reset":
      return <Page theme={theme} d={APP_USER} />;
    default:
      return null;
  }
}
