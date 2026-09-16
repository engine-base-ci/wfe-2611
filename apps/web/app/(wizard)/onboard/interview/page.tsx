"use client";
// 自分のAIと話す（T-U-07・A06）。状態：Bridge 未接続（nb）／最初（0）／途中（n）／資料を読ませる（f）。段階 1 の経路は Bridge だけ（D-055）。無言の空画面にしない
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Empty, Section } from "@/components/ui";
import { ChoiceChips } from "@/components/ai";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { useList } from "@/lib/api";
import { unavailableAdapter, type ChatAdapter } from "@/lib/agent-ui";
import { Bot, MessageSquare } from "lucide-react";

const FIRST =
  "はじめまして。私はあなたの自分のAI、あなたの代わりに動くAIです。これから会社のことを教えてもらって、私が目標・台帳・担当業務・AI社員のたたき台を作ります。あなたが欄を埋めることはありません。訊かれたことに答えるだけで大丈夫です。まず、何をしている会社ですか？";
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
  // Bridge がつながっているか＝自分の bridge セッションが生きているか（GET /api/v1/sessions）。無ければ話せない（nb）
  const sessions = useList<{ id: string; kind_id?: string; revoked_at?: string | null }>(
    "sessions",
    { limit: 50 },
    "onboard-interview",
  );
  const bridge = (sessions.data?.data ?? []).some((s) => s.kind_id === "bridge" && !s.revoked_at);
  const [log, setLog] = useState<{ who: "ai" | "me"; text: string }[]>([{ who: "ai", text: FIRST }]);
  const [learned, setLearned] = useState<string[]>([]);
  const adapter: ChatAdapter = useMemo(() => unavailableAdapter("PC をつなぐと話せます。"), []);
  const answer = async (text: string) => {
    setLog((l) => [...l, { who: "me", text }]);
    setLearned((x) => [...x, text]);
    const reply = await adapter.send({ text, history: [], context: { screenId: "onboard-interview" } });
    setLog((l) => [...l, { who: "ai", text: reply }]);
  };
  const state = sessions.isPending ? "loading" : !bridge ? "nb" : log.length <= 1 ? "0" : "n";
  return (
    <WizardLayout
      title="自分のAIと話す"
      purpose={
        state === "nb"
          ? "先に自分のPCをつないでください"
          : "訊かれたことに答えるだけ。10分ほどで、会社のたたき台ができます。"
      }
      existing={WIZARD_EXISTING}
    >
      {state === "loading" ? (
        <p className="text-[13.5px] text-[var(--on-sv)]">つながりを確かめています</p>
      ) : state === "nb" ? (
        <div data-state="nb" data-requires="nobridge">
          <Empty
            icon={<Bot />}
            title="先に自分のPCをつないでください"
            action={
              <Link href="/setup/bridge">
                <Button>PCをつなぐ</Button>
              </Link>
            }
          >
            自分のAIはあなたのPCで、あなたのサブスクで動きます。つながるまで話せません（API は使いません）。
          </Empty>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" data-state={state} data-requires="bridge ai">
          <div>
            <ol className="flex flex-col gap-3" aria-label="会話">
              {log.map((m, i) => (
                <li
                  key={i}
                  className={
                    m.who === "ai"
                      ? "max-w-[60ch] rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[14px] leading-[1.8]"
                      : "max-w-[60ch] self-end rounded-[var(--r-lg)] bg-[var(--primary-c)] px-4 py-3 text-[14px] leading-[1.8] text-[var(--on-primary-c)]"
                  }
                >
                  {m.who === "ai" ? (
                    <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--tertiary)]">
                      <MessageSquare className="size-3.5" />
                      自分のAI
                    </span>
                  ) : null}
                  {m.text}
                </li>
              ))}
            </ol>
            {log.length <= 1 ? (
              <ChoiceChips
                options={["受託・制作", "店舗・サービス業", "EC・物販", "その他"]}
                onPick={answer}
                onOther={() => answer("その他")}
                onLater={() => answer("あとで")}
              />
            ) : null}
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const v = (f.elements.namedItem("t") as HTMLInputElement).value.trim();
                if (v) {
                  void answer(v);
                  f.reset();
                }
              }}
            >
              <input
                name="t"
                className="min-h-10 flex-1 rounded-[var(--r-md)] border border-transparent bg-[var(--sv)] px-3 text-[16px] md:text-[14px]"
                placeholder="答える（ファイルは形式を選びません）"
                aria-label="答える"
              />
              <Button type="submit">送る</Button>
            </form>
          </div>
          <Section title="分かったこと">
            {learned.length ? (
              <ul className="list-disc space-y-1 pl-5 text-[13.5px]">
                {learned.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--on-sv)]">
                まだ何もありません。答えるたびに、ここに積み上がります。あとから見直せますし、直せます。
              </p>
            )}
          </Section>
        </div>
      )}
    </WizardLayout>
  );
}
