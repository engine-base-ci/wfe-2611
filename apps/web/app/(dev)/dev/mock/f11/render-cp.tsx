"use client";
// 段 12 の下絵（ゲストの側・ゲストの場所）の描き手。描き手 C が書く。関数の名前と引数は変えない
//   値は features/F11/portal/ の部品へ渡すだけ。社内の Shell は使わない（ゲストの場所の外枠 PortalFrame）
import type { ReactNode } from "react";
import { PortalFrame, SUZUKI, YAMADA } from "@/features/F11/portal/frame";
import { HomeBody } from "@/features/F11/portal/home";
import { NewRequestForm, RequestThread } from "@/features/F11/portal/request";
import { NotVisible, SessionExpired, WorkDetail, Welcome } from "@/features/F11/portal/work";
import type { Theme } from "@/lib/theme";

const Page = ({ children }: { children: ReactNode }) => <PortalFrame user={YAMADA}>{children}</PortalFrame>;
// 依頼のやり取りは、依頼を出した鈴木様の画面（同じゲストのグループの山田様にも同じ物が見える・代表 2026-11-23）
const SuzukiPage = ({ children }: { children: ReactNode }) => <PortalFrame user={SUZUKI}>{children}</PortalFrame>;
const NEW_HEAD = (
  <>
    <h1 className="k-f11p-h1">依頼を出す</h1>
    <p className="k-f11p-sub">ENGINE BASE の営業グループに届きます。セイコー株式会社（ゲスト）の皆さんにも見えます</p>
  </>
);
const NewPage = ({ ps, phase }: { ps: "PS0" | "PS2"; phase?: Parameters<typeof NewRequestForm>[0]["phase"] }) => (
  <Page>
    {phase === "sent" ? null : NEW_HEAD}
    <NewRequestForm ps={ps} {...(phase ? { phase } : {})} />
  </Page>
);

// ゲストの場所は社内の外枠（Shell）を使わないので、色の明暗は今は使わない（引数は render.tsx と合わせる）
export function renderCp(id: string, _theme: Theme): ReactNode | null {
  void _theme;
  switch (id) {
    case "pt-home":
      return (
        <Page>
          <HomeBody />
        </Page>
      );
    case "pt-home-empty":
      return (
        <Page>
          <HomeBody phase="empty" />
        </Page>
      );
    case "pt-home-loading":
      return (
        <Page>
          <HomeBody phase="loading" />
        </Page>
      );
    case "pt-home-failed":
      return (
        <Page>
          <HomeBody phase="failed" />
        </Page>
      );
    case "pt-home-notice":
      return (
        <Page>
          <HomeBody
            notice={{
              title: "メンテナンスのお知らせ",
              body: "11/10 の夜（22:00〜23:00）、この場所を一時的に使えません。依頼や返事はその後にお送りください。",
            }}
          />
        </Page>
      );
    case "pt-welcome":
      return (
        <PortalFrame user={YAMADA}>
          <Welcome />
        </PortalFrame>
      );
    case "pt-session-expired":
      return (
        <PortalFrame noFoot>
          <SessionExpired />
        </PortalFrame>
      );
    case "pt-new":
      return <NewPage ps="PS2" />;
    case "pt-new-ps0":
      return <NewPage ps="PS0" />;
    case "pt-new-empty":
      return <NewPage ps="PS2" phase="empty" />;
    case "pt-new-attach-bad":
      return <NewPage ps="PS2" phase="attach-bad" />;
    case "pt-new-saving":
      return <NewPage ps="PS2" phase="saving" />;
    case "pt-new-failed":
      return <NewPage ps="PS2" phase="failed" />;
    case "pt-new-sent":
      return <NewPage ps="PS2" phase="sent" />;
    case "pt-req":
      return (
        <SuzukiPage>
          <RequestThread />
        </SuzukiPage>
      );
    case "pt-req-accepted":
      return (
        <SuzukiPage>
          <RequestThread kind="accepted" />
        </SuzukiPage>
      );
    case "pt-req-declined":
      return (
        <SuzukiPage>
          <RequestThread kind="declined" />
        </SuzukiPage>
      );
    case "pt-req-other":
      return (
        <Page>
          <NotVisible what="この依頼" />
        </Page>
      );
    case "pt-work":
      return (
        <Page>
          <WorkDetail />
        </Page>
      );
    case "pt-work-hidden":
      return (
        <Page>
          <NotVisible what="この仕事" />
        </Page>
      );
    case "pt-work-request":
      return (
        <Page>
          <WorkDetail fromRequest />
        </Page>
      );
    default:
      return null;
  }
}
