"use client";
// 段 11 の下絵：ワークスペースの管理の「記録」（lg-*）と「設定」（st-*）。部品は features/F10/ws（値を受け取って描くだけ）。
//   キャンバス WsLog・WsSettings・EdDeleteWs。書き出し（持ち出し）は作らない（D-154.4）。キャンバスに無い状態（誤り・権限が無い）の字は仮
import type { ReactNode } from "react";
import { NoAccess } from "@/components/k";
import { DeleteWsDialog } from "@/features/F10/ws/delete-dialog";
import { LogPage, type LogEntry, type LogPageProps } from "@/features/F10/ws/log";
import { SettingsPage, type SettingsState } from "@/features/F10/ws/settings";
import type { Theme } from "@/lib/theme";
import { Frame, WsFrame } from "./frame";

const noop = (): void => undefined;
const WS_NAME = "株式会社ENGINE BASE";

const ENTRIES: readonly LogEntry[] = [
  {
    id: "a",
    when: "11/02 09:58",
    who: "高本 聖斗",
    text: "鈴木 一郎 を 営業 の マネージャー → メンバー にした",
    reason: "兼務が終わったため",
    device: "iPhone から",
    stepUp: true,
  },
  {
    id: "b",
    when: "10/12 14:20",
    who: "高本 聖斗",
    text: "鈴木 一郎 を 営業 の マネージャー にした",
    device: "MacBook から",
  },
];
const MORE: readonly LogEntry[] = [
  { id: "d", when: "11/04 13:02", who: "田中 美咲", text: "新しい端末（Windows の PC）で入った", device: "大阪から" },
  { id: "e", when: "11/03 10:15", who: "高本 聖斗", text: "高本のAI に「請求書を送る」を許可した" },
  ...ENTRIES,
];
const DELETED: readonly LogEntry[] = [
  {
    id: "x",
    when: "11/01 17:30",
    who: "鈴木 一郎",
    text: "チケット EG-120 を消した",
    deleted: true,
  },
  {
    id: "y",
    when: "10/20 11:05",
    who: "佐藤 花子",
    text: "チケット EG-87 を消した",
    deleted: true,
  },
];

type LogProps = Partial<LogPageProps> & { theme: Theme; dialog?: ReactNode };
function Log({ theme, dialog, entries = MORE, ...rest }: LogProps) {
  return (
    <WsFrame theme={theme} active="log" dialog={dialog}>
      <LogPage entries={entries} {...rest} />
    </WsFrame>
  );
}

const BASE: SettingsState = { name: WS_NAME };
type SetProps = { theme: Theme; s?: Partial<SettingsState>; dialog?: ReactNode; planRow?: ReactNode };
function Settings({ theme, s, dialog, planRow }: SetProps) {
  return (
    <WsFrame theme={theme} active="settings" dialog={dialog}>
      <SettingsPage s={{ ...BASE, ...s }} planRow={planRow} />
    </WsFrame>
  );
}

export function renderWs(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "lg-list":
      return <Log theme={theme} />;
    case "lg-search":
      return <Log theme={theme} query="鈴木さんの役割を変えたのは誰？" entries={ENTRIES} />;
    case "lg-filter":
      return <Log theme={theme} tab="perm" entries={ENTRIES} />;
    case "lg-deleted":
      return <Log theme={theme} tab="deleted" entries={DELETED} />;
    case "lg-empty":
      return <Log theme={theme} query="請求書の再発行" status="empty" entries={[]} />;
    case "lg-failed":
      return <Log theme={theme} status="failed" entries={[]} />;
    case "lg-manager":
      return (
        <Frame theme={theme} viewer="sato" screen="audit" crumbs={[{ label: "記録" }]}>
          <LogPage manager entries={[ENTRIES[0]!, ENTRIES[1]!]} />
        </Frame>
      );
    case "st-view":
      return <Settings theme={theme} />;
    case "st-name-saved":
      return <Settings theme={theme} s={{ name: "ENGINE BASE 株式会社", nameStatus: "saved" }} />;
    case "st-name-error":
      return <Settings theme={theme} s={{ name: "", live: true }} />;
    case "st-logo":
      return <Settings theme={theme} s={{ logo: "image", logoError: true }} />;
    case "st-perm":
      return <Settings theme={theme} s={{ permOpen: 1 }} />;
    case "st-delete":
      return <Settings theme={theme} dialog={<DeleteWsDialog name={WS_NAME} typed="株式会社ENGINE" />} />;
    case "st-delete-ready":
      return <Settings theme={theme} dialog={<DeleteWsDialog name={WS_NAME} typed={WS_NAME} />} />;
    case "st-deleting":
      return <Settings theme={theme} s={{ deletingDaysLeft: 13 }} />;
    case "st-no-access":
      return (
        <Frame
          theme={theme}
          viewer="suzu"
          screen="company-settings"
          crumbs={[{ label: "ワークスペースの管理" }, { label: "設定" }]}
        >
          <section className="k-root k-page k-me-page k-inv-page" aria-label="設定">
            <NoAccess acts={[noop, "/tickets"]} />
          </section>
        </Frame>
      );
    default:
      return null;
  }
}
