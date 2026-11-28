"use client";
import { useState } from "react";
import { Callout, Shell, Toaster, useNotify } from "@/components/k";
import { NAV, type RoleId } from "@/lib/nav";
import type { Theme } from "@/lib/theme";

const ALL = Object.values(NAV.screens).map((s) => s.route);

function Inner({ theme, role, allBuilt, panel }: { theme: Theme; role: RoleId; allBuilt: boolean; panel: boolean }) {
  const notify = useNotify();
  const [q, setQ] = useState<string | null>(null);
  return (
    <Shell
      role={role}
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
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
      onCreate={() => notify("チケットを作る（見本）")}
      onSearch={setQ}
      onNotices={() => notify("知らせを開く（見本）")}
      onSignOut={() => notify("ログアウト（見本）")}
      {...(allBuilt ? { built: ALL } : {})}
      {...(panel
        ? {
            panel: (
              <div style={{ padding: "var(--k-s-md)" }}>
                <h2 style={{ margin: 0, fontSize: "var(--k-text-h3)" }}>高本のAI</h2>
                <p>いま見ている画面を添えて話せます（中身は会話の部品のチケットで作る）</p>
              </div>
            ),
          }
        : {})}
    >
      <div style={{ padding: "var(--k-s-lg)", display: "grid", gap: "var(--k-s-md)" }}>
        <Callout title="外枠の見本">左のバー・上の帯・右のパネル・スマホの下のタブ</Callout>
        {q ? <p role="status">「{q}」を探す</p> : null}
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>本文の行 {i + 1}</p>
        ))}
      </div>
    </Shell>
  );
}

export function ShellDemo(p: { theme: Theme; role: RoleId; allBuilt: boolean; panel: boolean }) {
  return (
    <Toaster>
      <Inner {...p} />
    </Toaster>
  );
}
