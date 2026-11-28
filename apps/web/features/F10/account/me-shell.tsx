"use client";
// 自分の設定の外枠（K-839・K-842・K-843 も使う）：外枠（TicketShell・screen account）・パンくず「自分の設定（押せない）› <項目>」・
//   第 2 ナビ MeSub と本文を並べる k-me-wrap。モックの MeFrame（/dev/mock/f10 frame.tsx）と同じ組み立て
import type { ReactNode } from "react";
import { MeSub, type MeSubKey } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";

const ME_LABEL: Record<MeSubKey, string> = {
  profile: "プロフィール",
  login: "ログインと安全",
  bridge: "PC と使った量",
  credentials: "預けたログイン情報",
  notices: "お知らせ",
};

export function MeShell({ current, children }: { current: MeSubKey; children: ReactNode }) {
  return (
    <>
      <TicketShell screen="account" crumbs={[{ label: "自分の設定", disabled: true }, { label: ME_LABEL[current] }]}>
        <div className="k-me-wrap">
          <MeSub current={current} />
          {children}
        </div>
      </TicketShell>
    </>
  );
}
