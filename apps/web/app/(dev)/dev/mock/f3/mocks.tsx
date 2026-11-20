"use client";
// 段 4（F3 使い始めの準備の残り：預けたログイン情報）の下絵のモック（部品先行・枝 c/段4）。本番と同じ部品（features/F3/credentials/views.tsx・components/k）を、決めた値で並べる。
//   1 つの id ＝ 1 つの状態。代表の答え answer=ac0813ee7c21（秘密だけ・ワークスペースと個人・ログインの確かめを入れる）
//   answer=e34268dbfbac：使われ方は「これまでに N 回 ・ 最後 MM/DD」だけ・期限が近いは期限の 1 日前から・上書き（ログイン情報）は ID とパスワードを両方入れ直す
//   見本の値は画面の試験の口の答え（apps/web/tests/k/credentials-mock.ts の C1〜C4・P1・今日は 11/18 12:00）から値の直し方で出る字にそろえる
import type { ReactNode } from "react";
import { Shell, MeSub, Toaster } from "@/components/k";
import {
  AddCredentialDialog,
  EMPTY_CREDENTIAL,
  CheckCodeDialog,
  CredentialsBody,
  CredentialsHead,
  EditCredentialDialog,
  RemoveCredentialConfirm,
  type AddCredentialValues,
  type CredentialItem,
} from "@/features/F3/credentials/views";
import { StepUpDialog } from "@/features/F1/security/views";
import type { Theme } from "@/lib/theme";

const WS = "株式会社ENGINE BASE";
const ME = "高本 聖斗";

const ITEMS: CredentialItem[] = [
  {
    id: "c1",
    name: "GMAIL_WORK",
    description: "会社の Gmail（送信用）",
    kind: "login",
    destinations: ["mail.google.com", "smtp.gmail.com"],
    usage: "これまでに 18 回 ・ 最後 11/01",
    state: "ok",
  },
  {
    id: "c2",
    name: "HACCHU_NAVI_LOGIN",
    description: "発注ナビのログイン",
    kind: "login",
    destinations: ["hacchu-navi.example"],
    usage: "これまでに 22 回 ・ 最後 今日",
    state: "needs_code",
    note: "SMS のコードを待っている（あと 8 分）",
  },
  {
    id: "c3",
    name: "FREEE_API_KEY",
    description: "会計ソフトの API キー",
    kind: "key",
    destinations: ["api.freee.co.jp"],
    usage: "これまでに 3 回 ・ 最後 10/29",
    state: "expiring",
    note: "あと 1 日で期限",
  },
  {
    id: "c4",
    name: "SEIKO_PORTAL",
    description: "セイコー様の請求書システム（見るだけ）",
    kind: "login",
    destinations: ["portal.seiko.example"],
    usage: "これまでに 1 回 ・ 最後 11/01",
    state: "bad_password",
    note: "11/18 10:20 に確かめた",
  },
];

/** 預ける小窓の見本の値（部品の既定から外した物・モックの見た目は前と同じ） */
const ADD_LOGIN: AddCredentialValues = {
  ...EMPTY_CREDENTIAL,
  name: "HACCHU_NAVI_LOGIN",
  description: "発注ナビのログイン",
  login: "takamoto@engine-base.example",
  two_factor: "sms",
  destinations: "hacchu-navi.example",
  expires_on: "2027/11/10",
};
const ADD_KEY: AddCredentialValues = {
  ...EMPTY_CREDENTIAL,
  kind: "key",
  name: "FREEE_API_KEY",
  description: "会計ソフトの API キー",
  destinations: "api.freee.co.jp",
  expires_on: "2027/11/10",
};

export interface MockEntry {
  id: string;
  screen: "credentials";
  label: string;
  /** この状態を本物にする画面の葉（canvas_field_gate とその葉の頭の欄 mock: が突き合わせる） */
  ticket: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "cred-list",
    screen: "credentials",
    label: "一覧（使える・コードが要る・期限が近い・パスワードが違う）",
    ticket: "K-356",
  },
  { id: "cred-empty", screen: "credentials", label: "まだ預けていない", ticket: "K-356" },
  { id: "cred-personal", screen: "credentials", label: "自分だけのタブ", ticket: "K-356" },
  { id: "cred-failed", screen: "credentials", label: "一覧を読めない", ticket: "K-356" },
  { id: "cred-checking", screen: "credentials", label: "預けた直後：確かめている", ticket: "K-357" },
  { id: "cred-no-pc", screen: "credentials", label: "PC がつながっていない：つながると確かめる", ticket: "K-357" },
  { id: "cred-forbidden", screen: "credentials", label: "規約で禁止のサービス：試さない", ticket: "K-357" },
  { id: "cred-add-login", screen: "credentials", label: "預ける：ログイン情報", ticket: "K-372" },
  { id: "cred-add-key", screen: "credentials", label: "預ける：API キー・値", ticket: "K-372" },
  { id: "cred-add-error", screen: "credentials", label: "預ける：名前の形が違う・同じ名前がある", ticket: "K-372" },
  { id: "cred-stepup", screen: "credentials", label: "預ける前の本人確認の取り直し", ticket: "K-372" },
  {
    id: "cred-edit",
    screen: "credentials",
    label: "上書き（ログイン情報：ID とパスワードを両方入れ直す）",
    ticket: "K-357",
  },
  { id: "cred-remove", screen: "credentials", label: "消す", ticket: "K-357" },
  { id: "cred-code", screen: "credentials", label: "確かめの途中：SMS のコードを入れる", ticket: "K-357" },
];

function Page({
  theme,
  tab = "workspace",
  items = ITEMS,
  failed,
  dialog,
}: {
  theme: Theme;
  tab?: "workspace" | "personal";
  items?: readonly CredentialItem[];
  failed?: boolean;
  dialog?: ReactNode;
}) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="credentials"
        crumbs={[{ label: "自分の設定", disabled: true }, { label: "預けたログイン情報" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: "高本", initial: "高" }}
        bridgeConnected
        theme={theme}
      >
        <div className="k-me-wrap">
          <MeSub current="credentials" />
          <section className="k-page k-me-page" aria-labelledby="credentials-title">
            {/* モックは押せる形で見せる（キャンバスどおり。本番は口がつながるまで灰色：「預ける」は預ける小窓の葉・行の操作は上書きと確かめの葉） */}
            <CredentialsHead addReady />
            <CredentialsBody
              workspaceName={WS}
              personalName={ME}
              tab={tab}
              items={items}
              failed={failed}
              rowActionsReady
            />
          </section>
        </div>
      </Shell>
      {dialog}
    </Toaster>
  );
}

const one = (s: CredentialItem["state"], note?: string): CredentialItem[] => [
  { ...ITEMS[1]!, state: s, note: note ?? null },
];

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  switch (id) {
    case "cred-list":
      return <Page theme={theme} />;
    case "cred-empty":
      return <Page theme={theme} items={[]} />;
    case "cred-personal":
      return (
        <Page
          theme={theme}
          tab="personal"
          items={[
            {
              ...ITEMS[0]!,
              id: "p1",
              name: "MY_NOTE_LOGIN",
              description: "自分のメモアプリ",
              usage: "まだ使っていない",
            },
          ]}
        />
      );
    case "cred-failed":
      return <Page theme={theme} failed />;
    case "cred-checking":
      return <Page theme={theme} items={one("checking", "PC がログインして確かめている")} />;
    case "cred-no-pc":
      return <Page theme={theme} items={one("no_pc", "PC をつなぐと、1 回ログインして確かめる")} />;
    case "cred-forbidden":
      return (
        <Page
          theme={theme}
          items={one("forbidden", "このサービスは規約で自動のログインを禁止しているので、分身は使わない")}
        />
      );
    case "cred-add-login":
      return <Page theme={theme} dialog={<AddCredentialDialog open values={ADD_LOGIN} workspaceName={WS} />} />;
    case "cred-add-key":
      return <Page theme={theme} dialog={<AddCredentialDialog open values={ADD_KEY} workspaceName={WS} />} />;
    case "cred-add-error":
      return (
        <Page
          theme={theme}
          dialog={
            <AddCredentialDialog
              open
              values={ADD_KEY}
              workspaceName={WS}
              errors={{ name: "名前は英大文字と _ だけ。この名前は、このワークスペースにもうあります" }}
            />
          }
        />
      );
    case "cred-stepup":
      return (
        <Page
          theme={theme}
          dialog={<StepUpDialog open reason="ログイン情報を預ける前に、本人か確かめます" withCode={false} />}
        />
      );
    case "cred-edit":
      return <Page theme={theme} dialog={<EditCredentialDialog open item={ITEMS[3]!} />} />;
    case "cred-remove":
      return (
        <Page
          theme={theme}
          dialog={<RemoveCredentialConfirm open name="SEIKO_PORTAL" onOpenChange={() => undefined} />}
        />
      );
    case "cred-code":
      return <Page theme={theme} dialog={<CheckCodeDialog open name="HACCHU_NAVI_LOGIN" via="sms" />} />;
    default:
      return <p>この状態はありません：{id}</p>;
  }
}
