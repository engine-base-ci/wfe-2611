"use client";
// 段 10 の下絵：ワークスペースの管理の中（チケットの設定：種別・状態・項目／メンバー：グループごと）
import type { ReactNode } from "react";
import { FieldAddDialog, FieldDeleteDialog } from "@/features/F9/settings/field-dialogs";
import { GroupMembersBody, type Group } from "@/features/F9/members/views";
import {
  FieldsPanel,
  KindsPanel,
  StagesPanel,
  TicketSettings,
  type FieldRow,
  type KindRow,
  type StageRow,
} from "@/features/F9/settings/views";
import type { Theme } from "@/lib/theme";
import { WsFrame } from "./ws-frame";

const KINDS: readonly KindRow[] = [
  { id: "k-task", name: "タスク", tone: "indigo", hasTemplate: true },
  { id: "k-bill", name: "請求", tone: "teal", hasTemplate: true },
  { id: "k-ask", name: "問い合わせ", tone: "amber", hasTemplate: true },
  { id: "k-bug", name: "不具合", tone: "coral", hasTemplate: false },
  { id: "k-mtg", name: "打ち合わせ", tone: "lavender", hasTemplate: false },
];
const STAGES: readonly StageRow[] = [
  { id: "s-todo", name: "未着手", tone: "teal-light", locked: "始めの状態なので消せません" },
  { id: "s-doing", name: "作業中", tone: "indigo" },
  { id: "s-wait", name: "先方の返事待ち", tone: "amber" },
  { id: "s-hold", name: "保留", tone: "plum" },
  { id: "s-done", name: "完了", tone: "sage", locked: "終わりの状態なので消せません" },
];
const FIELDS: readonly FieldRow[] = [
  {
    id: "f-pj",
    name: "PJコード",
    type: "1 つ選ぶ",
    required: true,
    desc: "どの案件の仕事かを選びます",
    kinds: ["k-task", "k-bill"],
    options: ["SK-2026-11（セイコー商事）", "MN-2026-08（ミナト工業）", "社内"],
  },
  { id: "f-amount", name: "請求額", type: "金額", required: false, desc: "税を含まない額", kinds: ["k-bill"] },
  { id: "f-pay", name: "支払期日", type: "日付", required: true, desc: "取引先が支払う日", kinds: ["k-bill"] },
  {
    id: "f-class",
    name: "分類",
    type: "複数選ぶ",
    required: false,
    desc: "",
    kinds: ["k-task"],
    options: ["経理", "営業"],
  },
  { id: "f-note", name: "備考", type: "複数行", required: false, desc: "", kinds: ["k-task", "k-ask"] },
];

const person = (
  id: string,
  name: string,
  role: string,
  state: string,
  stateTone: "ok" | "warn" | "none",
  note?: string,
) => ({
  id,
  name,
  email: `${id}@engine-base.example`,
  role,
  state,
  stateTone,
  ...(note ? { note } : {}),
});
const GROUPS: readonly Group[] = [
  {
    code: "EG",
    name: "営業",
    tone: "teal",
    manager: "佐藤 花子",
    rows: [
      person("takamoto", "高本 聖斗", "管理者", "分身 動いている", "ok", "自分"),
      person("sato", "佐藤 花子", "マネージャー", "分身 動いている", "ok"),
      person("suzuki", "鈴木 一郎", "メンバー", "PC 3 日つながっていない", "warn"),
      person("kimura", "木村 誠", "メンバー", "分身なし", "none"),
      {
        id: "inv1",
        name: "",
        email: "yoshida@engine-base.example",
        role: "メンバー",
        state: "",
        stateTone: "none",
        invitedLeft: "5 日",
      },
    ],
  },
  {
    code: "JD",
    name: "受託開発",
    tone: "plum",
    manager: "田中 美咲",
    rows: [
      person("tanaka", "田中 美咲", "マネージャー", "分身 動いている", "ok"),
      person("ito", "伊藤 健", "メンバー", "分身 動いている", "ok"),
      person("watanabe", "渡辺 葵", "メンバー", "分身なし", "none"),
    ],
  },
  {
    code: "KR",
    name: "経理",
    tone: "amber",
    manager: "山口 恵",
    rows: [
      person("yamaguchi", "山口 恵", "マネージャー", "分身 動いている", "ok"),
      person("ono", "小野 翔", "メンバー", "分身なし", "none"),
    ],
  },
];

export function renderWorkspace(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "set-kinds":
      return (
        <WsFrame theme={theme} active="rules">
          <TicketSettings tab="kinds">
            <KindsPanel kinds={KINDS} current="k-bill" />
          </TicketSettings>
        </WsFrame>
      );
    case "set-stages":
      return (
        <WsFrame theme={theme} active="rules">
          <TicketSettings tab="stages">
            <StagesPanel stages={STAGES} editing="s-wait" />
          </TicketSettings>
        </WsFrame>
      );
    case "set-fields":
      return (
        <WsFrame theme={theme} active="rules">
          <TicketSettings tab="fields">
            <FieldsPanel fields={FIELDS} current="f-pj" kinds={KINDS} />
          </TicketSettings>
        </WsFrame>
      );
    case "set-field-add":
      return (
        <WsFrame
          theme={theme}
          active="rules"
          dialog={
            <FieldAddDialog
              name="取引先の区分"
              type="1 つ選ぶ"
              options={["既存", "新規"]}
              required={false}
              desc=""
              kinds={KINDS}
              kindIds={["k-bill", "k-ask"]}
            />
          }
        >
          <TicketSettings tab="fields">
            <FieldsPanel fields={FIELDS} current="f-pj" kinds={KINDS} />
          </TicketSettings>
        </WsFrame>
      );
    case "set-field-delete":
      return (
        <WsFrame
          theme={theme}
          active="rules"
          dialog={
            <FieldDeleteDialog
              name="PJコード"
              caution={["3 件のチケットに入っている値が見えなくなります。", "消すと元に戻せません。"]}
            />
          }
        >
          <TicketSettings tab="fields">
            <FieldsPanel fields={FIELDS} current="f-pj" kinds={KINDS} />
          </TicketSettings>
        </WsFrame>
      );
    case "mem-groups":
      return (
        <WsFrame theme={theme} active="members">
          <GroupMembersBody groups={GROUPS} open={["EG"]} />
        </WsFrame>
      );
    default:
      return null;
  }
}
