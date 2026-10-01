"use client";
// 自分のAIとの会話を出す場所は、どこもこれ 1 つ（D-103・D-104）。
// 使う場所：会話モード（/ai/chat）・はじめの設定の聞き取り（/onboard/interview）・たたき台を確かめる（/onboard/draft）・
//          右パネル（全部の作業画面・components/ai/panel.tsx）・自分のAIとAI社員のやりとり（/ai/thread）。
// 場所ごとに変わるのは、あいさつ・入力欄の見本・自分のAI に添える文脈（どこで話しかけたか）だけ。
// つながっていない・PC が閉じている の出し方も全部ここ（画面ごとに書かない：L-008）。
// 検査：scripts/ci/chat_one.mjs が、ここと conversation.tsx 以外で会話の入力欄や useAgent を作ったら赤にする。
import "./chat.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { Button, Empty } from "@/components/ui";
import { ago, type AgentChatModel, type AgentContext } from "@/lib/agent";
import { Conversation } from "./conversation";

export function AgentChat({
  chat,
  opening,
  placeholder = "聞く・頼む・相談する",
  context,
  onSaid,
  compact = false,
  aiName = "自分のAI",
  meInitial,
  askOnly = false,
  openingAsMessage,
  openingOptions,
  onOpeningPick,
  children,
}: {
  chat: AgentChatModel;
  opening?: string;
  /** あいさつを最初の吹き出しとして出す（選択肢はその中）。Conversation と同じ */
  openingAsMessage?: boolean;
  openingOptions?: string[];
  onOpeningPick?: (v: string) => void;
  placeholder?: string;
  context?: AgentContext;
  onSaid?: () => void;
  compact?: boolean;
  aiName?: string;
  meInitial?: string;
  /** 閲覧だけの人（聞くことだけ・§26） */
  askOnly?: boolean;
  /** 会話の下に足すもの（よく頼むこと 等） */
  children?: ReactNode;
}) {
  const { state, bridge, agent } = chat;
  if (state === "loading")
    return (
      <p className="text-[13px] text-[var(--on-sv)]" data-chat-state="loading">
        つながりを確かめています
      </p>
    );
  if (state === "nb")
    return (
      <div data-requires="nobridge" data-chat-state="nb">
        <Empty
          icon={<Bot />}
          title="このPCがつながっていません"
          action={
            <Link href="/setup/bridge">
              <Button size={compact ? "sm" : undefined}>PCをつなぐ</Button>
            </Link>
          }
        >
          先に自分のPCをつないでください。自分のAIはあなたのPCで、あなたのサブスクで動きます。つながるまで話せません（API は使いません）。
        </Empty>
      </div>
    );
  if (agent.missing)
    return (
      <div className="kc" data-chat-state="missing">
        <p className="stopline" role="status" style={{ marginLeft: 0 }}>
          <span>
            <b>この会話はありません。</b>消したか、あなたの会話ではありません。
          </span>
        </p>
        <div style={{ marginTop: 12 }}>
          <Button size="sm" onClick={() => agent.select(null)} data-missing-new>
            いちばん新しい会話を開く
          </Button>
        </div>
      </div>
    );
  // Bridge が古い（約束の版が合わない）：仕事を渡せないので、入れ直しを案内する（E-CONN-012）
  const outdated = !!bridge?.health?.some((h) => h.fix === "update" && !h.ok);
  return (
    <div data-chat-state={state}>
      {outdated ? (
        <div className="kc">
          <p className="usage lim" role="status" data-bridge-outdated style={{ marginLeft: 0, marginBottom: 12 }}>
            <span>
              <b>この PC の Bridge が古いので、自分のAI に仕事を渡せません。</b>
              Bridge を入れ直してください。ここで言ったことは溜めておき、入れ直した後に順に片づけます。{" "}
              <Link href="/setup/bridge">PC の状態を見る</Link>
            </span>
          </p>
        </div>
      ) : null}
      {/* PC が閉じていても、言うことは書ける（溜めて、起きたら順に動かす・§66）。行き止まりにしない */}
      {state === "x" ? (
        <div className="kc">
          <p className="usage lim" role="status" data-asleep style={{ marginLeft: 0, marginBottom: 12 }}>
            <span>
              <b>あなたのPCが閉じているので、いまは動けません。</b>
              ここで言ったことは溜めておいて、PC が起きたときに順に片づけます
              {bridge?.last_seen_sec !== undefined ? `（最後の知らせは ${ago(bridge.last_seen_sec)}）` : ""}。
              <Link href="/setup/bridge">PC の状態を見る</Link>
            </span>
          </p>
        </div>
      ) : null}
      <Conversation
        agent={agent}
        offlineSec={state === "x" ? (bridge?.last_seen_sec ?? 0) : null}
        {...(opening ? { opening } : {})}
        placeholder={placeholder}
        {...(context ? { context } : {})}
        {...(onSaid ? { onSaid } : {})}
        compact={compact}
        aiName={aiName}
        {...(meInitial ? { meInitial } : {})}
        askOnly={askOnly}
        {...(openingAsMessage ? { openingAsMessage } : {})}
        {...(openingOptions ? { openingOptions } : {})}
        {...(onOpeningPick ? { onOpeningPick } : {})}
      >
        {children}
      </Conversation>
    </div>
  );
}
