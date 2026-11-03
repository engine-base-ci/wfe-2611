"use client";
// 共通シェルの見本（T-US-01・02）。?screen=today&role=R1&ps=PS3 で切り替える。治具（tests/shell.spec.ts）がここを 4 幅で測る
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell, ShellProvider, ThreePane, PsGate, RoleGate } from "@/components/shell";
import { AssistantPanelView, ApprovalCard, ChoiceChips, Confidence, Citation, ReceiptCard } from "@/components/ai";
import { Button, Section, Table, Th, Td, Pill, Empty, StoppedBanner } from "@/components/ui";
import { NAV, type RoleId, type ScreenId } from "@/lib/nav";
import { chatState, type Agent, type AgentChatModel, type Prefs } from "@/lib/agent";
import type { AgentMsg, AgentState } from "@/lib/auth/ext";
import { Inbox } from "lucide-react";

/** 見本の画面の相手（ログインも Bridge も無しで右パネルの形を確かめる）。部品は本物と同じ AgentChat を通る。
 *  言ったことをそのまま受け取ったと返すだけ。時点（ps）に AI が無ければ「つながっていない」を返す */
function useEchoChat(hasAi: boolean): AgentChatModel {
  const [msgs, setMsgs] = useState<AgentMsg[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>({ mode: "manual", model: null, effort: null });
  const at = () => new Date().toISOString();
  const state: AgentState = {
    conversation_id: "echo",
    conversation: { id: "echo", title: "見本の会話", starred: false, incognito: false },
    messages: msgs,
    running_job_id: null,
    stopped: null,
    progress: [],
    asking: null,
    work: null,
    queued: [],
  };
  const agent: Agent = {
    state,
    missing: false,
    hasOlder: false,
    loadingOlder: false,
    loadOlder: async () => undefined,
    olderFailed: false,
    retryOlder: () => undefined,
    conversationId: "echo",
    loading: false,
    sending: false,
    error: null,
    running: false,
    working: false,
    failed: [],
    prefs,
    setPrefs: (p) => setPrefsState((x) => ({ ...x, ...p })),
    say: async (text, o) => {
      const ctx = o && "screen" in o ? o : o?.context;
      setMsgs((m) => [
        ...m,
        { id: `u${m.length}`, who: "me", text, at: at() },
        {
          id: `a${m.length}`,
          who: "ai",
          text: `（見本）「${text}」を受け取りました。いま見ている画面は ${ctx?.screen ?? "—"} です。`,
          at: at(),
        },
      ]);
      return true;
    },
    retry: async () => undefined,
    dismissFailed: () => undefined,
    stop: async () => undefined,
    cancelQueued: async () => undefined,
    answer: async () => undefined,
    select: () => undefined,
    startNew: async () => setMsgs([]),
    attach: async (f) => ({ key: f.name, name: f.name, size: f.size, id: null, error: "見本では付けられません" }),
  };
  const b = {
    bridge: hasAi ? { connected: true, live: true } : { connected: false, live: false },
    loading: false,
    usable: hasAi,
    asleep: false,
    refetch: () => undefined,
  };
  return { ...b, agent, state: chatState(b, agent) };
}

function DevShellInner() {
  const sp = useSearchParams();
  const screenId = (sp.get("screen") ?? "today") as ScreenId;
  const role = (sp.get("role") ?? "R1") as RoleId;
  const psId = sp.get("ps") ?? "PS3";
  const caps = NAV.productStates.find((p) => p.id === psId)?.caps ?? [];
  const chat = useEchoChat(caps.includes("ai"));
  // ?live=1 のときは見本の相手を使わず、本物の右パネル（共通の枠が出すもの・ログインと Bridge が要る）を出す。D-103 の実ブラウザの確かめ用
  const live = sp.get("live") === "1";
  const [sel, setSel] = useState<string | null>(null);
  const [sub, setSub] = useState(0);
  const layout = NAV.layoutByScreen[screenId] === "threepane" ? "threepane" : "page";
  const rows = [
    { id: "1", t: "セイコー様への追いメール", s: "承認待ち" },
    { id: "2", t: "京蟻の請求書（税込表示）", s: "承認待ち" },
    { id: "3", t: "○○社 提案書の一次案", s: "作業中" },
  ];
  const queue = (
    <ul className="divide-y divide-[var(--line-soft)]">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className={`flex h-12 w-full items-center gap-3 px-4 text-left text-[13.5px] hover:bg-[var(--surface)] ${sel === r.id ? "bg-[var(--primary-c)]" : ""}`}
            onClick={() => setSel(r.id)}
            aria-current={sel === r.id ? "true" : undefined}
          >
            <span className="flex-1 truncate">{r.t}</span>
            <Pill tone={r.s === "承認待ち" ? "warning" : "progress"}>{r.s}</Pill>
          </button>
        </li>
      ))}
    </ul>
  );
  const detail = sel ? (
    <div>
      <h2 className="text-h2 font-bold">{rows.find((r) => r.id === sel)?.t}</h2>
      <ApprovalCard
        title="追いメール"
        rows={[
          { label: "宛先", value: "山田様（セイコー）" },
          { label: "内容", value: "検討期限の前日に一次返信のお願い" },
        ]}
        onApprove={() => setSel(null)}
        onFix={() => {}}
        onStop={() => {}}
      />
      <Confidence level="high" basis={<Citation label="案件 セイコー" href="/records" />} />
      <div className="mt-3">
        <ReceiptCard what="追いメールを承認待ちに置いた" where="承認待ち" href="/approvals" onUndo={() => {}} />
      </div>
      <ChoiceChips options={["柔らかく", "短く", "このまま"]} onPick={() => {}} onOther={() => {}} onLater={() => {}} />
    </div>
  ) : (
    <Empty icon={<Inbox />} title="左から 1 件選ぶ">
      選ぶと、ここに中身が出ます。
    </Empty>
  );
  return (
    <ShellProvider role={role} psId={psId} screenId={screenId} counts={{ approvals: 2, today: 3 }} aiName="高本AI">
      <AppShell
        who={{ initials: "高", name: "高本 雅人", org: "ENGINE BASE" }}
        panel={live ? undefined : <AssistantPanelView chat={chat} selected={sel} />}
        selected={sel ? (rows.find((r) => r.id === sel)?.t ?? null) : null}
        primary={<Button>{NAV.screens[screenId].primaryAction || "主アクション"}</Button>}
        subActive={sub}
        onSubSelect={setSub}
        banner={
          caps.includes("stopped") ? <StoppedBanner reason="PC が閉じています。開くと続きから動きます。" /> : null
        }
      >
        {layout === "threepane" ? (
          <ThreePane queue={queue} detail={detail} selected={!!sel} onBack={() => setSel(null)} />
        ) : (
          <>
            <Section title="見本の段">
              <p className="max-w-[65ch] text-[var(--on-sv)]">
                この画面は共通シェルの見本です。第2ナビ・サイドバー・自分のAIのパネル・下タブの組み合わせを 4
                幅で確かめます。
              </p>
              <PsGate requires="data">
                <Table>
                  <thead>
                    <tr>
                      <Th>項目</Th>
                      <Th numeric>件数</Th>
                      <Th>状態</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <Td>{r.t}</Td>
                        <Td numeric>1</Td>
                        <Td>
                          <Pill tone="warning">{r.s}</Pill>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </PsGate>
            </Section>
            <RoleGate roles="R1 R2">
              <Section title="代表だけに見える段">
                <p>権限のある人にだけ出る中身（data-roles）。</p>
              </Section>
            </RoleGate>
            <RoleGate roles="R3">
              <Section title="担当者に見える段">
                <p>配られた分だけ。</p>
              </Section>
            </RoleGate>
          </>
        )}
      </AppShell>
    </ShellProvider>
  );
}

// useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる。dev では出ない）
export default function DevShell() {
  return (
    <Suspense fallback={<p className="p-8 text-[13.5px] text-[var(--on-sv)]">読み込み中</p>}>
      <DevShellInner />
    </Suspense>
  );
}
