"use client";
// 自分のAIの右パネル（T-US-02・D-062.1・D-072.19・D-103）：全部の作業画面の右に、会話モードと同じ 1 本の会話。
// 中身は AgentChat（会話を出す場所はどこも同じ部品）。パネルが持つのは、開け閉め・会話モードへの口・
// 「いま見ている画面・選んでいる 1 件」を自分のAI に添えることだけ。画面ごとに渡さない（AppShell が必ず出す）。
import type { Route } from "next";
import Link from "next/link";
import { Bot, MessageSquare, X } from "lucide-react";
import { useShell } from "@/components/shell/context";
import { useAgentChat, type AgentChatModel } from "@/lib/agent";
import { NAV } from "@/lib/nav.legacy";
import { AgentChat } from "./agent-chat";

/** 本物の会話につながった右パネル（AppShell が出す） */
export function AssistantPanel({ selected }: { selected?: string | null }) {
  const chat = useAgentChat();
  return <AssistantPanelView chat={chat} selected={selected ?? null} />;
}

/** 右パネルの見た目。chat を差し替えられる（開発用の見本の画面が、ログインなしで形を確かめるため） */
export function AssistantPanelView({
  chat,
  selected,
  chatHref = "/ai/chat" as Route,
}: {
  chat: AgentChatModel;
  selected: string | null;
  chatHref?: Route;
}) {
  const { screenId, aiName, setPanelOpen } = useShell();
  const seeing = screenId ? NAV.screens[screenId].name : "";
  return (
    <>
      <div className="ap-h flex items-center gap-2.5 border-b border-[var(--line-soft)] px-3.5 py-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--tertiary-c)] text-[var(--on-tertiary-c)]">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold">{aiName}</div>
          <div className="truncate text-[11.5px] text-[var(--on-sv)]">いま見ている：{seeing}</div>
        </div>
        <span className="flex-1" />
        <Link className="btn btn-g btn-sm" href={chatHref} title="会話モードで開く">
          <MessageSquare />
        </Link>
        <button type="button" className="btn btn-g btn-sm ap-close" title="閉じる" onClick={() => setPanelOpen(false)}>
          <X />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5">
        <AgentChat
          chat={chat}
          compact
          aiName={aiName}
          opening="いま見ている内容について、変えたいこと・聞きたいことがあれば言ってください。"
          placeholder="続けて話す"
          {...(screenId
            ? { context: { screen: screenId, screen_name: seeing, ...(selected ? { selected } : {}) } }
            : {})}
        />
      </div>
    </>
  );
}
