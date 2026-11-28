"use client";
// 段 11 の下絵：自分の設定（プロフィール・メール・抜ける・端末・知らせ）と自分のメニュー・ワークスペースの切り替え（束 account）。
//   外枠は frame.tsx の MeFrame（自分の設定の中）と Frame（メニュー）。描く物は features/F10/account の部品。持っていない id は null
import type { ReactNode } from "react";
import { EmailDialog, EmailDoneCard, LeaveDialog } from "@/features/F10/account/dialogs";
import { LoginBody, LoginWithRevoke } from "@/features/F10/account/login";
import { MeMenuPanel, OrgPanel } from "@/features/F10/account/menu";
import { CopyDialog, NotifyBody } from "@/features/F10/account/notify";
import { ProfileBody, type ProfileState } from "@/features/F10/account/profile";
import type { Theme } from "@/lib/theme";
import { Frame, MeFrame } from "./frame";

const ME: ProfileState = { name: "高本 聖斗", nick: "高本", email: "takamoto@engine-base.example" };
const LONG: ProfileState = {
  name: "ヴィクトリア・アレクサンドラ・ファン・デル・ベルク・高本",
  nick: "ヴィクトリア",
  email: "victoria@engine-base.example",
};

function Profile({ theme, p, dialog }: { theme: Theme; p: ProfileState; dialog?: ReactNode }) {
  return (
    <MeFrame theme={theme} current="profile" dialog={dialog}>
      <ProfileBody p={p} />
    </MeFrame>
  );
}

/** 開いたメニューの後ろに見える、チケットの画面の見本 */
function TicketsBehind() {
  return (
    <section className="k-page" aria-labelledby="menu-behind">
      <header className="k-page-head">
        <h1 id="menu-behind">自分に関わるもの</h1>
        <p className="k-page-sub">チケットの一覧（見本）</p>
      </header>
    </section>
  );
}

export function renderAccount(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "me-profile":
      return <Profile theme={theme} p={ME} />;
    case "me-saved":
      return <Profile theme={theme} p={{ ...LONG, nameStatus: "saved", showPreview: true }} />;
    case "me-name-error":
      return <Profile theme={theme} p={{ ...ME, name: "", live: true }} />;
    case "me-avatar":
      return <Profile theme={theme} p={{ ...ME, face: "photo", faceError: true }} />;
    case "me-email":
      return <Profile theme={theme} p={ME} dialog={<EmailDialog />} />;
    case "me-email-error":
      return <Profile theme={theme} p={ME} dialog={<EmailDialog start="takamoto@engine-base" />} />;
    case "me-email-sent":
      return <Profile theme={theme} p={{ ...ME, emailPending: "new-takamoto@engine-base.example" }} />;
    case "me-email-done":
      return (
        <div className="k-f10a-stack">
          <EmailDoneCard kind="changed" />
          <EmailDoneCard kind="expired" />
          <EmailDoneCard kind="used" />
        </div>
      );
    case "me-leave":
      return <Profile theme={theme} p={ME} dialog={<LeaveDialog kind="assigned" />} />;
    case "me-leave-ready":
      return <Profile theme={theme} p={ME} dialog={<LeaveDialog kind="ready" />} />;
    case "me-leave-last-admin":
      return <Profile theme={theme} p={ME} dialog={<LeaveDialog kind="last-admin" />} />;
    case "me-sessions":
      return (
        <MeFrame theme={theme} current="login">
          <LoginBody />
        </MeFrame>
      );
    case "me-session-revoke":
      return (
        <MeFrame theme={theme} current="login">
          <LoginWithRevoke start="win" />
        </MeFrame>
      );
    case "me-notify":
    case "me-notify-quiet":
    case "me-notify-copy":
    case "me-notify-failed":
      return renderNotify(id, theme);
    case "me-menu":
      return (
        <Frame theme={theme} screen="tickets" crumbs={[{ label: "チケット" }, { label: "自分に関わるもの" }]}>
          <TicketsBehind />
          <MeMenuPanel />
        </Frame>
      );
    case "me-org":
      return (
        <Frame theme={theme} screen="tickets" crumbs={[{ label: "チケット" }, { label: "自分に関わるもの" }]}>
          <TicketsBehind />
          <OrgPanel />
        </Frame>
      );
    default:
      return null;
  }
}

function renderNotify(id: string, theme: Theme): ReactNode {
  const s =
    id === "me-notify-quiet"
      ? { menuOpen: true, stopped: true }
      : id === "me-notify-failed"
        ? { saveFailed: true }
        : {};
  return (
    <MeFrame theme={theme} current="notices" dialog={id === "me-notify-copy" ? <CopyDialog /> : undefined}>
      <NotifyBody s={s} />
    </MeFrame>
  );
}
