"use client";
// 自分のAIと話す（会話モード・T-U-17・A07/A12/A88〜A94・route は flow.json の /ai/chat）。
// 状態：つながっていない（nb）／PC が閉じている（x）／最初（0）／やりとり（n）／動いている（w）／確認待ち（a）／止まった（stp）／聞くだけ（R4）。
// 会話は人が分け、第2ナビの一覧から戻って続きを話す（D-104.1：1 会話＝PC の Claude の 1 セッション）。経路は Bridge だけ（D-055）。
// 止まったら理由だけ出し、次に送る文で決まる（D-104.15）。?c=<会話の id> で会話を開く（一覧・知らせから戻るため）
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { AgentChat, ChatFrame, ConversationList } from "@/components/ai";
import { AppShell, ShellProvider } from "@/components/shell";
import { RequireSession } from "@/lib/auth/session";
import { RequireRole, useMyRoles } from "@/lib/auth/role";
import { useAgentChat } from "@/lib/agent";
import type { RoleId } from "@/lib/nav.legacy";

/** 画面ごとの「よく頼むこと」（押すとそのまま送る・D-104.12） */
const PROMPTS = ["今月の売上、どのくらい行きそう？", "いま止まっているものを教えて", "今日やることを 3 つに絞って"];

export default function CloneChatPage() {
  return (
    <RequireSession fallback={<p className="p-8 text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>}>
      <RequireRole screen="clone-chat">
        <Suspense fallback={null}>
          <Chat />
        </Suspense>
      </RequireRole>
    </RequireSession>
  );
}
function Chat() {
  const { roles } = useMyRoles();
  const role = (roles?.[0] ?? "R1") as RoleId;
  const sp = useSearchParams();
  // 会話を出す場所はどこも AgentChat 1 つ（D-103）。ここは会話そのものが本文なので右パネルは出さない
  const chat = useAgentChat(sp.get("c"));
  const { agent, usable, state } = chat;
  // 開いている会話を URL に持つ（戻る・再読み込み・共有で同じ会話が開く）
  const router = useRouter();
  const cid = agent.conversationId;
  useEffect(() => {
    if (cid && sp.get("c") !== cid && !agent.missing) router.replace(`/ai/chat?c=${cid}` as Route, { scroll: false });
  }, [cid, sp, router, agent.missing]);
  const msgs = agent.state?.messages ?? [];
  const askOnly = role === "R4";
  const list = state !== "nb" && state !== "loading" ? <ConversationList agent={agent} /> : null;
  return (
    <ShellProvider screenId="clone-chat" role={role} psId={usable ? "PS3" : "PS4"} aiName="自分のAI">
      <AppShell panel={false} subBody={list}>
        {/* 会話の固定枠（D-072）：1024 以上では会話の名前と入力欄は動かず、吹き出しだけがスクロールする */}
        <ChatFrame className="mx-auto flex w-full max-w-[920px] flex-col px-4 py-4" data-state={state}>
          {/* 画面の見出し（h1）は共通の枠が出す。ここは開いている会話の名前 */}
          {agent.state?.conversation ? (
            <h2 className="mb-2 truncate text-h2 font-semibold" data-conversation-title>
              {agent.state.conversation.title}
            </h2>
          ) : null}
          {/* 閲覧のみの人は、聞くことはできる。指示は担当の人へ（D-086・§26） */}
          {askOnly && state !== "nb" && state !== "loading" ? (
            <p className="mb-2 text-[13px] text-[var(--on-sv)]" data-ask-only>
              この会話では聞くことだけできます。指示・依頼は担当の人へ。
            </p>
          ) : null}
          <AgentChat
            chat={chat}
            askOnly={askOnly}
            opening={askOnly ? "共有されていることの範囲で答えます。何を知りたいですか？" : "何から始めますか？"}
          >
            {!msgs.length && !askOnly ? (
              <div className="mt-3 flex flex-wrap gap-2" data-prompts>
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-1 text-[14px] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    onClick={() => void agent.say(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : null}
          </AgentChat>
        </ChatFrame>
      </AppShell>
    </ShellProvider>
  );
}
