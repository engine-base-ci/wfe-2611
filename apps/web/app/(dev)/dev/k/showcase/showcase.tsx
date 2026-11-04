"use client";
import { useState } from "react";
import { Callout, Shell, Tabs, Toaster, useNotify } from "@/components/k";
import { NAV } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import { PartsBody } from "../parts";
import { States } from "../states/states";

const ALL = Object.values(NAV.screens).map((s) => s.route);

function Inner({ theme }: { theme: Theme }) {
  const notify = useNotify();
  const [q, setQ] = useState<string | null>(null);
  return (
    <Shell
      role="R1"
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: "見本" }]}
      workspace={{ name: "ENGINE BASE", initial: "E" }}
      member={{ name: "高本", initial: "高" }}
      groups={[
        { code: "EG", name: "営業", count: 18, href: "#eg", tone: "teal" },
        { code: "JD", name: "受託開発", count: 42, href: "#jd", tone: "plum" },
        { code: "KR", name: "経理", count: 9, href: "#kr", tone: "amber" },
      ]}
      badges={{ approvals: 2 }}
      notices={3}
      bridgeConnected
      theme={theme}
      built={ALL}
      onCreate={() => notify("チケットを作る（見本）")}
      onSearch={setQ}
      onNotices={() => notify("知らせを開く（見本）")}
      onSignOut={() => notify("ログアウト（見本）")}
      panel={
        <div style={{ padding: "var(--k-s-md)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--k-text-h3)" }}>高本のAI</h2>
          <p>会話の部品は会話のチケットで入れる</p>
        </div>
      }
    >
      <div style={{ padding: "var(--k-s-lg) var(--k-s-lg) 0" }}>
        <Callout title="見本の画面">新しい画面は、この外枠と部品の上に作る（KN-108）</Callout>
        {q ? <p role="status">「{q}」を探す</p> : null}
      </div>
      <div style={{ padding: "var(--k-s-md) var(--k-s-lg) 0" }}>
        <Tabs
          label="見本の中"
          items={[
            { value: "parts", label: "部品", panel: <PartsBody theme={theme} bare /> },
            { value: "states", label: "4 つの状態とエラー", panel: <States page={null} bare /> },
          ]}
        />
      </div>
    </Shell>
  );
}

export function Showcase({ theme }: { theme: Theme }) {
  return (
    <Toaster>
      <Inner theme={theme} />
    </Toaster>
  );
}
