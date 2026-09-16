"use client";
// 自分のAIの右パネル（T-US-02・D-062.1・D-072.19）：会話全体が読めて続けて話せる。入力だけを置く形は禁止。
// 描画は assistant-ui、配線は AG-UI（lib/agent-ui）。パネルは「いま見ている画面・選んでいる 1 件」を知る
import type { Route } from "next";
import { pendingRoute } from "@/lib/pending-route";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { Bot, MessageSquare, Paperclip, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Toaster } from "sonner";
import type { ChatAdapter } from "@/lib/agent-ui";
import { useShell } from "@/components/shell/context";
import { NAV } from "@/lib/nav";

function toModelAdapter(
  adapter: ChatAdapter,
  screenId: string | null,
  selectedId: string | null | undefined,
): ChatModelAdapter {
  return {
    async run({ messages, abortSignal }) {
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        text: m.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("\n"),
      }));
      const last = messages[messages.length - 1];
      const text = last
        ? last.content
            .filter((c) => c.type === "text")
            .map((c) => (c as { text: string }).text)
            .join("\n")
        : "";
      const reply = await adapter.send(
        { text, history, context: { screenId, selectedId: selectedId ?? null } },
        abortSignal,
      );
      return { content: [{ type: "text", text: reply }] };
    },
  };
}

export function AssistantPanel({
  adapter,
  selectedId,
  children,
  chatHref = pendingRoute("/clone-chat", "T-U-17"),
}: {
  adapter: ChatAdapter;
  selectedId?: string | null;
  children?: ReactNode;
  chatHref?: Route;
}) {
  const { screenId, aiName, setPanelOpen, caps } = useShell();
  const model = useMemo(() => toModelAdapter(adapter, screenId, selectedId), [adapter, screenId, selectedId]);
  const runtime = useLocalRuntime(model);
  const seeing = screenId ? NAV.screens[screenId].name : "";
  const stopped = caps.includes("stopped") || caps.includes("nobridge");
  return (
    <AssistantRuntimeProvider runtime={runtime}>
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
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5">
          <ThreadPrimitive.Empty>
            <div className="pm a">
              {stopped ? (
                <span className="ai-stopped">AI は止まっています。</span>
              ) : (
                <>
                  いま見ている内容で止まっているものはありません。変えたいことがあれば言ってください。中央に反映します。
                </>
              )}
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          {children}
        </ThreadPrimitive.Viewport>
        <div className="ap-c border-t border-[var(--line-soft)] px-3 py-2.5">
          <div className="mb-[7px] flex gap-1.5 text-[11px]">
            {["/配る", "/数値", "/覚えて"].map((s) => (
              <span key={s} className="rounded-full bg-[var(--sv)] px-2 py-0.5 text-[var(--on-sv)]">
                {s}
              </span>
            ))}
          </div>
          <ComposerPrimitive.Root className="flex items-end gap-2 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--primary)]">
            <Paperclip className="mb-1.5 size-4 text-[var(--on-sv)]" />
            <ComposerPrimitive.Input
              placeholder="続けて話す"
              className="min-h-6 flex-1 resize-none bg-transparent text-[13px] outline-none"
              rows={1}
              autoFocus={false}
            />
            <ComposerPrimitive.Send
              className="btn btn-p btn-sm rounded-[var(--r-md)] bg-[var(--primary)] px-2.5 py-1.5 text-white"
              aria-label="送る"
            >
              <SendHorizontal className="size-4" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </div>
      </ThreadPrimitive.Root>
      <Toaster position="bottom-center" richColors />
    </AssistantRuntimeProvider>
  );
}
function UserMessage() {
  return (
    <MessagePrimitive.Root className="pm u self-end max-w-[92%] rounded-[var(--r-lg)] bg-[var(--primary-c)] px-3 py-2 text-[13px] leading-[1.75] text-[var(--on-primary-c)]">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="pm a self-start max-w-[92%] rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.75]">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
