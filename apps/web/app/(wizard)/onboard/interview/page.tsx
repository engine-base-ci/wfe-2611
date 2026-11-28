"use client";
// 自分のAIと話す（T-U-07・A06）。状態：つながっていない（nb）／眠っている（slp）／最初（0）／途中（n）／止まった（stp）。
// 段階 1 の経路は Bridge だけ（D-055）。言ったことは本人の PC の Claude Code へ渡り、返事がここに出る（D-090）。
// 文脈（会話の続き）は Claude Code が持つ。Kaname は会話と session の id を持つだけ（二重に持たない）。
import { useMemo } from "react";
import { Brain, Check } from "lucide-react";
import { Empty, Section } from "@/components/ui";
import { AgentChat, ChatFrame } from "@/components/ai";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { useMarkStep } from "@/lib/onboarding";
import { useAgentChat } from "@/lib/agent";

/** 「項目：内容」を分ける（区切りが無ければ内容だけ） */
function splitFact(t: string): { k: string | null; v: string } {
  const m = /^\s*([^：:\n]{1,24})[：:]\s*([\s\S]+)$/.exec(t);
  return m ? { k: m[1]!.trim(), v: m[2]!.trim() } : { k: null, v: t.trim() };
}
const FIRST =
  "はじめまして。私はあなたの自分のAI、あなたの代わりに動くAIです。これから会社のことを教えてもらって、私が目標・台帳・担当業務・AI社員のたたき台を作ります。<b>あなたが欄を埋めることはありません。</b>訊かれたことに答えるだけで大丈夫です。まず、何をしている会社ですか？";
export default function InterviewPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="自分のAIと話す" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <Interview />
    </RequireSession>
  );
}
function Interview() {
  const markStep = useMarkStep();
  // 会話を出す場所はどこも AgentChat 1 つ（D-103）。話せるのは「つながっていて・いま生きている」ときだけ（G-12）
  const chat = useAgentChat();
  const { agent } = chat;
  const msgs = agent.state?.messages ?? [];
  // 分かったこと＝自分のAI が聞き取って記憶に落とした事実（D-114）。「項目：内容」を分けて出す。本人が送った文は並べない
  const learned = useMemo(() => msgs.filter((m) => m.who === "memo").map((m) => splitFact(m.text)), [msgs]);
  const ctx = { screen: "onboard-interview", screen_name: "はじめの設定：会社のことを話す" };
  /** 選択肢を押しても、書いて送ったときと同じ（言えたら段 2 を通したと記録する・D-089） */
  const pick = async (v: string): Promise<void> => {
    if (await agent.say(v, ctx)) await markStep(2);
  };
  // この画面の状態の名前（テストと時点の治具が見る）。止まった以外の細かい状態は、この画面では「途中」にまとめる
  const state =
    chat.state === "loading" || chat.state === "nb" || chat.state === "stp" || chat.state === "0" ? chat.state : "n";
  return (
    <WizardLayout
      chat={state !== "loading" && state !== "nb"}
      title="自分のAIと話す"
      purpose={
        state === "nb"
          ? "先に自分のPCをつないでください"
          : "訊かれたことに答えるだけ。10分ほどで、会社のたたき台ができます。"
      }
      existing={WIZARD_EXISTING}
    >
      {state === "loading" || state === "nb" ? (
        <div data-state={state}>
          <AgentChat chat={chat} context={ctx} />
        </div>
      ) : (
        // 会話の固定枠（D-072）：1024 以上では段の帯・見出し・分かったことは動かず、吹き出しだけがスクロールする
        <ChatFrame
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
          data-state={state}
          data-requires="bridge ai"
        >
          <div data-chat-col>
            <AgentChat
              chat={chat}
              context={ctx}
              opening={FIRST}
              openingAsMessage
              openingOptions={["受託・制作", "店舗・サービス業", "EC・物販", "その他"]}
              onOpeningPick={(v) => void pick(v)}
              onSaid={() => void markStep(2)}
            />
          </div>
          <div data-chat-side>
            <Section
              title="分かったこと"
              aside={
                learned.length ? <span className="text-[11.5px] text-[var(--on-sv)]">記憶に落ちています</span> : null
              }
            >
              {learned.length ? (
                <ul className="text-[13.5px]" data-learned>
                  {learned.map((x, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 border-b border-[var(--line-soft)] py-2 last:border-b-0"
                      data-fact
                    >
                      <Check className="mt-1 size-4 shrink-0 text-[var(--st-success)]" aria-hidden="true" />
                      <div className="min-w-0">
                        {x.k ? (
                          <div className="text-[11.5px] text-[var(--on-sv)]" data-fact-key>
                            {x.k}
                          </div>
                        ) : null}
                        <div data-fact-value>{x.v}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={<Brain />} title="まだ何もありません">
                  答えるたびに、ここに積み上がります。あとから見直せますし、直せます。
                </Empty>
              )}
            </Section>
          </div>
        </ChatFrame>
      )}
    </WizardLayout>
  );
}
