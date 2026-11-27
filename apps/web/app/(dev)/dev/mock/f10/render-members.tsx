"use client";
// 段 11 の下絵：メンバー（mb-*）とグループの小窓（gr-*）。部品は features/F10/members（値を受け取って描くだけ）。
//   キャンバス WsPeople・EdMemberMenu・EdGroup・WsInvite。最後に使った日の列の字は仮。キャンバスに無い状態の画面の字は「仮」
import type { ReactNode } from "react";
import { Callout, Confirm, NoAccess } from "@/components/k";
import { StepUpDialog } from "@/features/F1/security/views";
import { InviteDialog } from "@/features/F10/invite/views";
import { GroupDialog, LayersDialog, ReorderDialog } from "@/features/F10/members/group-dialogs";
import type { GroupFormValues } from "@/features/F10/members/group-dialogs";
import type { MemberRowData } from "@/features/F10/members/person-row";
import { MembersPage, type GroupData, type MembersPageProps } from "@/features/F10/members/views";
import type { Theme } from "@/lib/theme";
import { Frame, WsFrame } from "./frame";

const noop = (): void => undefined;
const mail = (id: string) => `${id}@engine-base.example`;

const GROUPS: readonly GroupData[] = [
  {
    code: "EG",
    name: "営業",
    tone: "teal",
    manager: "佐藤 花子",
    rows: [
      {
        id: "sato",
        lastUsed: "今日",
        name: "佐藤 花子",
        email: mail("sato"),
        role: "マネージャー",
        state: "分身 動いている",
        stateTone: "ok",
      },
      {
        id: "taka",
        lastUsed: "今日",
        name: "高本 聖斗",
        email: mail("takamoto"),
        role: "管理者",
        state: "分身 動いている",
        stateTone: "ok",
        note: "自分",
        self: true,
      },
      {
        id: "suzuki",
        lastUsed: "3 日前",
        name: "鈴木 一郎",
        email: mail("suzuki"),
        role: "メンバー",
        state: "分身 動いている",
        stateTone: "ok",
      },
      {
        id: "tanaka",
        lastUsed: "12 日前から使っていない",
        lastUsedAway: true,
        name: "田中 美咲",
        email: mail("tanaka"),
        role: "メンバー",
        state: "PC 3 日つながっていない",
        stateTone: "warn",
        note: "経理も兼ねる",
      },
    ],
  },
  {
    code: "JD",
    name: "受託開発",
    tone: "plum",
    manager: "佐藤 花子",
    rows: [
      {
        id: "sato",
        lastUsed: "今日",
        name: "佐藤 花子",
        email: mail("sato"),
        role: "マネージャー",
        state: "分身 動いている",
        stateTone: "ok",
        note: "兼ねている",
      },
      {
        id: "yamaguchi",
        lastUsed: "5 日前",
        name: "山口 健",
        email: mail("yamaguchi"),
        role: "閲覧のみ",
        state: "分身なし（見るだけ）",
        stateTone: "none",
      },
    ],
  },
  {
    code: "KR",
    name: "経理",
    tone: "amber",
    manager: "田中 美咲",
    rows: [
      {
        id: "tanaka",
        lastUsed: "12 日前から使っていない",
        lastUsedAway: true,
        name: "田中 美咲",
        email: mail("tanaka"),
        role: "メンバー",
        state: "PC 3 日つながっていない",
        stateTone: "warn",
        note: "兼ねている",
      },
      {
        id: "kimura",
        name: "",
        email: mail("kimura"),
        role: "メンバー",
        state: "",
        stateTone: "none",
        invitedLeft: "6 日",
      },
    ],
  },
];
const ALL = ["EG", "JD", "KR"];

/** 招待中の行を「送り直しました」の形にした並び */
const RESENT: readonly GroupData[] = GROUPS.map((g) =>
  g.code === "KR"
    ? {
        ...g,
        rows: g.rows.map((r): MemberRowData => (r.invitedLeft ? { ...r, invitedLeft: "7 日", resent: true } : r)),
      }
    : g,
);

const FORM: GroupFormValues = {
  name: "カスタマーサポート",
  code: "CS",
  layer: "営業",
  manager: "佐藤 花子",
  members: ["鈴木 一郎", "田中 美咲"],
  query: "",
  tone: "teal",
};

type ListProps = { theme: Theme; dialog?: ReactNode; groups?: readonly GroupData[] } & Omit<
  Partial<MembersPageProps>,
  "groups" | "open"
>;

function List({ theme, dialog, groups = GROUPS, ...rest }: ListProps) {
  return (
    <WsFrame theme={theme} active="members" dialog={dialog}>
      <MembersPage groups={groups} open={ALL} {...rest} />
    </WsFrame>
  );
}

export function renderMembers(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "mb-list":
      return <List theme={theme} />;
    case "mb-role-menu":
      return <List theme={theme} menu={{ row: "EG:suzuki", kind: "role" }} />;
    case "mb-role-stepup":
      return (
        <List
          theme={theme}
          dialog={
            <StepUpDialog open reason="鈴木 一郎の役割を「メンバー」から「マネージャー」に変えます" withCode={false} />
          }
        />
      );
    case "mb-role-last-admin":
      return (
        <List
          theme={theme}
          notice={
            <Callout tone="danger" title="役割を変えられません">
              高本 聖斗は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、変えてください
            </Callout>
          }
        />
      );
    case "mb-more":
      return <List theme={theme} menu={{ row: "EG:suzuki", kind: "more" }} />;
    case "mb-invite-menu":
      return (
        <List
          theme={theme}
          groups={RESENT}
          notice={
            <Callout tone="info">kimura@engine-base.example に招待を送り直しました。7 日のあいだ入れます</Callout>
          }
        />
      );
    case "mb-invite-revoke":
      return (
        <List
          theme={theme}
          dialog={
            <Confirm
              open
              title="招待を取り消しますか"
              description="kimura@engine-base.example に送った招待は使えなくなります。招待のリンクも使えなくなります"
              confirmLabel="招待を取り消す"
              onOpenChange={noop}
              onConfirm={noop}
            />
          }
        />
      );
    case "mb-invite-group":
      return (
        <List
          theme={theme}
          dialog={
            <InviteDialog
              open
              values={{
                typing: "",
                emails: ["yoshida@engine-base.example"],
                group: "営業",
                role: "メンバー",
                message: "",
              }}
            />
          }
        />
      );
    case "mb-no-access":
      return (
        <Frame
          theme={theme}
          viewer="suzu"
          screen="members"
          crumbs={[{ label: "ワークスペースの管理" }, { label: "メンバー" }]}
        >
          <section className="k-root k-page k-me-page k-inv-page" aria-label="メンバー">
            <NoAccess acts={[noop, "/tickets"]} />
          </section>
        </Frame>
      );
    case "gr-add":
      return <List theme={theme} dialog={<GroupDialog mode="add" open values={FORM} />} />;
    case "gr-add-error":
      return (
        <List
          theme={theme}
          dialog={
            <GroupDialog
              mode="add"
              open
              values={{ ...FORM, name: "", code: "EG", members: [] }}
              errors={{ name: "名前を入れてください", code: "この短い名前は、もう使われています" }}
            />
          }
        />
      );
    case "gr-layer-add":
      return <List theme={theme} dialog={<GroupDialog mode="add" open values={FORM} newLayer="カスタマー" />} />;
    case "gr-edit":
      return (
        <List
          theme={theme}
          dialog={
            <GroupDialog mode="edit" open memberCount={4} values={{ ...FORM, name: "営業", code: "EG", members: [] }} />
          }
        />
      );
    case "gr-order":
      return (
        <List
          theme={theme}
          dialog={
            <ReorderDialog
              open
              rows={[
                { code: "EG", name: "営業", tone: "teal", count: 4 },
                { code: "JD", name: "受託開発", tone: "plum", count: 2 },
                { code: "KR", name: "経理", tone: "amber", count: 1 },
              ]}
            />
          }
        />
      );
    case "gr-layers":
      return (
        <List
          theme={theme}
          dialog={
            <LayersDialog
              open
              rows={[
                { name: "営業", groups: 1 },
                { name: "受託開発", groups: 1 },
                { name: "経理", groups: 1 },
              ]}
            />
          }
        />
      );
    default:
      return null;
  }
}
