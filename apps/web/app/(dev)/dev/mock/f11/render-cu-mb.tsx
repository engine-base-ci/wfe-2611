"use client";
// ゲストを招く下絵の描き手（2026-11-23 代表の言葉：ゲストは新しい流れとして作らず、今あるメンバーの招待と同じ流れで招き、
//   権限（役割）を 1 つ足すだけ。役割は既にある「ゲスト」（tenant_memberships.role の requester・D-128.46））。
//   招く・メンバーの画面は本番の部品（features/F10/invite・K-874 で段 9 の本物に選び肢を足した）、参加の画面は段 3 の本物（features/F2/invite）をそのまま使う
import type { ReactNode } from "react";
import { InviteAccept, type InvitePreview } from "@/features/F2/invite/views";
import type { Theme } from "@/lib/theme";
import { CuFrame } from "./render-cu-frame";
import {
  GuestGroupDeleteConfirm,
  GuestGroupDialog,
  GuestGroupRenameDialog,
  GuestRemoveConfirm,
  GuestResumeConfirm,
  GuestSuspendConfirm,
} from "@/features/F10/invite/guest-group-views";
import {
  InviteDialog,
  MembersBody,
  WsHead,
  WsSub,
  type MemberGroup,
  type InviteValues,
} from "@/features/F10/invite/views";
import { initialOpen, toGroups } from "@/features/F10/members/members-shape";
import { MembersPage } from "@/features/F10/members/views";
import type { MembersAnswer, Person } from "@/features/F10/invite/use-members";
import "@/components/k/me-sub.css";

// 社内のメンバー（グループごと）。ゲストは別のタブ（2026-11-23 代表）
const GROUPS: MemberGroup[] = [
  {
    code: "EG",
    name: "営業",
    tone: "teal",
    rows: [
      {
        id: "m1",
        name: "高本 聖斗",
        email: "takamoto@engine-base.example",
        role: "管理者",
        state: "分身 動いている",
        stateTone: "ok",
        note: "自分",
      },
      {
        id: "m6",
        name: "木村 翔",
        email: "kimura@engine-base.example",
        role: "メンバー",
        state: "分身 動いている",
        stateTone: "ok",
      },
    ],
  },
  {
    code: "JD",
    name: "受託開発",
    tone: "plum",
    rows: [
      {
        id: "m4",
        name: "佐藤 花子",
        email: "sato@engine-base.example",
        role: "マネージャー",
        state: "分身 動いている",
        stateTone: "ok",
      },
    ],
  },
];

// メンバーのタブの本文は段 11 の新しい本文（features/F10/members の MembersPage・K-818。PM の決め 2026-11-28）。
//   値は口 getWorkspaceMembers の答えの形から本番と同じ関数（members-shape）で作る（開いているのは自分のグループ）
const person = (id: string, name: string, email: string, role: string, self = false): Person => ({
  id,
  name,
  email,
  role,
  group_role: null,
  primary: true,
  other_groups: [],
  self,
  suspended: false,
  pc: "ok",
  pc_days_away: null,
});
const MEMBERS_ANSWER: MembersAnswer = {
  groups: [
    {
      id: "0193c5a0-0000-7000-8000-00000000e001",
      code: "EG",
      name: "営業",
      members: [
        person("m1", "高本 聖斗", "takamoto@engine-base.example", "admin", true),
        person("m6", "木村 翔", "kimura@engine-base.example", "member"),
      ],
    },
    {
      id: "0193c5a0-0000-7000-8000-00000000e002",
      code: "JD",
      name: "受託開発",
      members: [person("m4", "佐藤 花子", "sato@engine-base.example", "manager")],
    },
  ],
  invitations: [],
  count: 3,
};
const MEMBER_GROUPS = toGroups(MEMBERS_ANSWER);

// ゲストのグループ（「〇〇（ゲスト）」）› ゲスト。グループの中のゲストは誰でも依頼を出せ、グループの依頼とチケットはグループ全員に見える（代表 2026-11-23）
const GUESTS: MemberGroup[] = [
  {
    code: "セ",
    name: "セイコー株式会社（ゲスト）",
    tone: "amber",
    inbox: "営業",
    rows: [
      { id: "g1", name: "山田 花子", email: "yamada@seiko.example", role: "ゲスト", state: "", stateTone: "none" },
      { id: "g2", name: "鈴木 健太", email: "suzuki@seiko.example", role: "ゲスト", state: "", stateTone: "none" },
      {
        id: "g3",
        name: "",
        email: "tamura@seiko.example",
        role: "ゲスト",
        state: "",
        stateTone: "none",
        invitedLeft: "6 日",
      },
    ],
  },
  {
    code: "京",
    name: "京蟻システム株式会社（ゲスト）",
    tone: "indigo",
    inbox: "受託開発",
    rows: [{ id: "g4", name: "大橋 誠", email: "ohashi@kyogi.example", role: "ゲスト", state: "", stateTone: "none" }],
  },
];

// 「＋ 新しいゲストのグループを作る」で作った直後の並び（作ったグループが一覧の終わりに入る・本番は作った後に並びを読み直す・PM の決め 2026-11-28）
const GUESTS_CREATED: MemberGroup[] = [
  ...GUESTS,
  { code: "株", name: "株式会社ソラ（ゲスト）", tone: "teal", inbox: "営業", rows: [] },
];

// 【段 12 の足し】鈴木 健太 さんを一時的に止めた後の並び（状態「一時的に止まっている」・「⋯」は 戻す・外す）
const GUESTS_SUSPENDED: MemberGroup[] = GUESTS.map((g) => ({
  ...g,
  rows: g.rows.map((r) => (r.id === "g2" ? { ...r, suspended: true } : r)),
}));

const count = (gs: readonly MemberGroup[]) => gs.reduce((n, g) => n + g.rows.length, 0);

function TabBar({ guest }: { guest: boolean }) {
  return (
    <nav className="k-inv-tabs" aria-label="メンバーとゲスト">
      <a className="k-inv-tab" href="#members" aria-current={guest ? undefined : "page"}>
        {`メンバー ${count(GROUPS)}`}
      </a>
      <a className="k-inv-tab" href="#guests" aria-current={guest ? "page" : undefined}>
        {`ゲスト ${count(GUESTS)}`}
      </a>
    </nav>
  );
}

// 依頼が届く社内のグループはゲストのグループが持つ（招くの小窓では選ばない・代表の答え answer=6fe309f41cc1）
const VALUES: InviteValues = {
  typing: "",
  emails: ["sano@seiko.example"],
  group: "営業",
  role: "ゲスト",
  company: "セイコー株式会社（ゲスト）",
  inbox: "営業",
  message: "請求書のご確認と、ご依頼の受け付けをこちらでお願いします",
};
// 「＋ 新しいゲストのグループを作る」で作った後、招くの小窓に戻った形（作ったグループが選ばれている）
const CREATED: InviteValues = {
  ...VALUES,
  emails: ["nakano@sora.example"],
  company: "株式会社ソラ（ゲスト）",
  inbox: "営業",
};
// グループの行の「＋ このゲストのグループに招く」から開いた形（そのグループが選ばれている）
const FROM_GROUP: InviteValues = {
  ...VALUES,
  emails: [],
  typing: "kato@kyogi.example",
  company: "京蟻システム株式会社（ゲスト）",
  inbox: "受託開発",
};

const PREVIEW: InvitePreview = {
  workspaceName: "株式会社ENGINE BASE",
  inviterName: "高本 聖斗",
  groupName: "セイコー株式会社（ゲスト）",
  role: "requester",
  message: "請求書のご確認と、ご依頼の受け付けをこちらでお願いします",
  email: "sano@seiko.example",
  expiresOn: "11/30",
};

function Members({
  theme,
  dialog,
  guest = false,
  menuOpenGroup,
  menuOpenRow,
  suspended = false,
  created = false,
}: {
  theme: Theme;
  dialog?: ReactNode;
  guest?: boolean;
  menuOpenGroup?: string;
  /** 【段 12 の足し】ゲストの人の行の「⋯」を開いた形にする人の id */
  menuOpenRow?: string;
  /** 【段 12 の足し】鈴木 健太 さんを止めた後の並び */
  suspended?: boolean;
  /** ゲストのグループを作った直後の並び */
  created?: boolean;
}) {
  return (
    <CuFrame
      theme={theme}
      ps="PS2"
      screen="members"
      crumbs={[{ label: "ワークスペースの管理", disabled: true }, { label: "メンバー" }]}
      {...(dialog ? { dialog } : {})}
    >
      <WsHead name="株式会社ENGINE BASE" initial="E" />
      <div className="k-me-wrap">
        <WsSub members={count(GROUPS) + count(GUESTS)} />
        {guest ? (
          <MembersBody
            groups={suspended ? GUESTS_SUSPENDED : created ? GUESTS_CREATED : GUESTS}
            guest
            {...(menuOpenGroup ? { menuOpenGroup } : {})}
            {...(menuOpenRow ? { menuOpenRow } : {})}
            title="ゲスト"
            sub="ゲストのグループごとに並ぶ。グループのゲストは誰でも依頼を出せ、グループの依頼と見せたチケットをグループ全員が見る（チケットは直せない）"
            tabs={<TabBar guest />}
          />
        ) : (
          <MembersPage
            groups={MEMBER_GROUPS}
            open={initialOpen(MEMBER_GROUPS, MEMBERS_ANSWER)}
            band={null}
            tabs={<TabBar guest={false} />}
          />
        )}
      </div>
    </CuFrame>
  );
}

export function renderMb(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "mb-members":
      return <Members theme={theme} />;
    case "mb-guests":
      return <Members theme={theme} guest />;
    case "mb-add":
      return <Members theme={theme} guest dialog={<InviteDialog open values={VALUES} />} />;
    case "mb-add-pick":
      return <Members theme={theme} guest dialog={<InviteDialog open values={{ ...VALUES, companyOpen: true }} />} />;
    case "mb-add-group-new":
      return (
        <Members
          theme={theme}
          guest
          dialog={<GuestGroupDialog name="株式会社ソラ（ゲスト）" inbox="営業" fromInvite />}
        />
      );
    case "mb-add-created":
      return (
        <Members
          theme={theme}
          guest
          created
          dialog={<InviteDialog open values={CREATED} done="ゲストのグループ「株式会社ソラ（ゲスト）」を作りました" />}
        />
      );
    case "mb-add-from-group":
      return <Members theme={theme} guest dialog={<InviteDialog open values={FROM_GROUP} />} />;
    case "mb-group-new":
      return <Members theme={theme} guest dialog={<GuestGroupDialog />} />;
    case "mb-group-new-dup":
      return (
        <Members
          theme={theme}
          guest
          dialog={
            <GuestGroupDialog
              name="セイコー株式会社（ゲスト）"
              inbox="営業"
              error="同じ名前のゲストのグループがあります。別の名前にしてください"
            />
          }
        />
      );
    case "mb-group-menu":
      return <Members theme={theme} guest menuOpenGroup="セイコー株式会社（ゲスト）" />;
    case "mb-group-rename":
      return <Members theme={theme} guest dialog={<GuestGroupRenameDialog name="セイコー（ゲスト）" />} />;
    case "mb-group-rename-dup":
      return (
        <Members
          theme={theme}
          guest
          dialog={
            <GuestGroupRenameDialog
              name="京蟻システム株式会社（ゲスト）"
              error="同じ名前のゲストのグループがあります。別の名前にしてください"
            />
          }
        />
      );
    case "mb-group-delete":
      return <Members theme={theme} guest dialog={<GuestGroupDeleteConfirm />} />;
    case "mb-guest-menu":
      return <Members theme={theme} guest menuOpenRow="g1" />;
    case "mb-guest-suspend":
      return <Members theme={theme} guest dialog={<GuestSuspendConfirm name="山田 花子" />} />;
    case "mb-guest-suspended":
      return <Members theme={theme} guest suspended menuOpenRow="g2" />;
    case "mb-guest-resume":
      return <Members theme={theme} guest suspended dialog={<GuestResumeConfirm name="鈴木 健太" />} />;
    case "mb-guest-remove":
      return <Members theme={theme} guest dialog={<GuestRemoveConfirm name="山田 花子" />} />;
    case "mb-join":
      return <InviteAccept state="new" preview={PREVIEW} loginHref="/login?next=/invite/x" />;
    default:
      return null;
  }
}
