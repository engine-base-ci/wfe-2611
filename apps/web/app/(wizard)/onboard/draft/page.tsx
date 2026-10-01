"use client";
// たたき台を確かめる（T-U-08・A07／A08・D-108）。目標（今の版の名前）・台帳・担当業務とAI社員を 1 回で読み、モックの 4 枚で出す。AI が変えるときだけ提案→承認、人が変えるときは即反映（D-012・D-025）
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Briefcase,
  Building2,
  Check,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Button, Empty, Section, Pill } from "@/components/ui";
import { AgentChat, ChatFrame } from "@/components/ai";
import { useAgentChat } from "@/lib/agent";
import { onboardDraft } from "@/lib/auth/ext";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { useMarkStep } from "@/lib/onboarding";
import { useRouter } from "next/navigation";

export default function DraftPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="たたき台を確かめる" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <Draft />
    </RequireSession>
  );
}
function Draft() {
  const markStep = useMarkStep();
  const router = useRouter();
  const q = useQuery({ queryKey: ["onboard-draft"], queryFn: onboardDraft });
  const d = q.data;
  const empty = !q.isPending && !!d && d.goals.length + d.ledgers.length + d.duties.length === 0;
  // 会話で直す（モックの「会話で直す」状態）：会話はどこで開いても同じ 1 本（D-103）。何を確かめているかを添える
  const [fixing, setFixing] = useState(false);
  const chat = useAgentChat();
  const ctx = {
    screen: "onboard-draft",
    screen_name: "たたき台を確かめる",
    selected: `目標 ${d?.goals.length ?? 0} 件・台帳 ${d?.ledgers.length ?? 0} 件・担当業務 ${d?.duties.length ?? 0} 件のたたき台`,
  };
  const fix = (
    <Button size="sm" variant="ghost" icon={<MessageSquare />} onClick={() => setFixing(true)} data-fix>
      会話で直す
    </Button>
  );
  return (
    <WizardLayout
      // 「これでいく」は下の帯（D-116）。たたき台があるときだけ押せる。押したら段 3 を通したと記録して 4 へ（D-089）
      next={{
        ready: !q.isPending && !q.isError && !empty,
        label: "これでいく（次：4. ログイン情報）",
        waiting: "自分のAIと話してたたき台ができると進めます",
        onGo: async () => {
          await markStep(3);
          router.push("/settings/credentials");
        },
      }}
      chat={fixing}
      title="たたき台を確かめる"
      purpose={
        fixing
          ? "違うところを言ってください。"
          : "自分のAIが会話と資料から作りました。違うところを言えば直します。自分で直接触っても構いません。"
      }
      existing={WIZARD_EXISTING}
    >
      {q.isPending ? (
        <p className="text-[13.5px] text-[var(--on-sv)]">読んでいます</p>
      ) : q.isError ? (
        <p className="text-[13.5px]" role="alert">
          たたき台を読めませんでした（{q.error instanceof Error ? q.error.message : "理由は分かりません"}）
        </p>
      ) : empty ? (
        <div data-state="empty">
          <Empty
            icon={<Building2 />}
            title="まだたたき台がありません"
            action={
              <Link href="/onboard/interview">
                <Button variant="outline">自分のAIと話す</Button>
              </Link>
            }
          >
            自分のAIと話すと、目標・台帳・担当業務・AI社員のたたき台がここに並びます。
          </Empty>
        </div>
      ) : fixing ? (
        <ChatFrame className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-state="f">
          <div data-draft-chat data-chat-col>
            <AgentChat
              chat={chat}
              context={ctx}
              opening="たたき台を見て、違うところがあれば教えてください。"
              openingAsMessage
              placeholder="違うところを言う"
            />
          </div>
          <div data-chat-side>
            <Section title="直したところ" className="border-t">
              <Empty icon={<Pencil />} title="まだありません">
                会話で直したものは、自分のAIが提案 → あなたが承認、で反映されます。
              </Empty>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setFixing(false)}>
                たたき台に戻る
              </Button>
            </Section>
          </div>
        </ChatFrame>
      ) : (
        <div data-state="n">
          <div className="grid gap-4 md:grid-cols-2">
            <Card icon={<Target />} title="目標のたたき台" aside={fix} data-card="goals">
              <Rows>
                {d!.goals.map((g) => (
                  <Row key={g.id}>
                    <span className="flex-1">{g.name}</span>
                    <b className="num">{fmt(g.target_value)}</b>
                    {g.unit ? <Unit>{g.unit}</Unit> : null}
                    <span className="text-[11.5px] whitespace-nowrap text-[var(--on-sv)]">{g.scope}</span>
                  </Row>
                ))}
              </Rows>
              <Note>単位は目標ごとに違います。親子で単位が変わるところは、自分のAIが変換のしかたを訊きます。</Note>
            </Card>
            <Card icon={<BookOpen />} title="台帳のたたき台" aside={fix} data-card="ledgers">
              <Rows>
                {d!.ledgers.map((l) => (
                  <Row key={l.id}>
                    <span className="flex-1">{l.name}</span>
                    <span className="text-[12px] text-[var(--on-sv)]">
                      {l.stages.join(" → ")}
                      {l.fields.length ? ` ／ ${l.fields.join("・")}` : ""}
                    </span>
                  </Row>
                ))}
              </Rows>
              <Note>台帳ごとに画面は作りません。定義が違うだけです。</Note>
            </Card>
            <Card icon={<Briefcase />} title="担当業務とAI社員" aside={fix} data-card="duties">
              {d!.duties.length ? (
                <Rows>
                  {d!.duties.map((x) => (
                    <Row key={x.id}>
                      <Sparkles className="size-4 shrink-0 text-[var(--tertiary)]" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <b>{x.staff || x.name}</b>
                        <div className="text-[12px] text-[var(--on-sv)]">{x.summary || x.name}</div>
                      </div>
                      <Pill tone="neutral">{x.origin === "distributed" ? "運営配布" : "会社作成"}</Pill>
                    </Row>
                  ))}
                </Rows>
              ) : (
                <p className="text-[13px] text-[var(--on-sv)]">
                  担当業務はまだありません。自分のAIと話すと、ここに並びます。
                </p>
              )}
              <Note>
                AI社員は自分のAIが窓口になって指示を配り、上がってきたものを一次確認します。あなたが押すのは最後だけです。
              </Note>
            </Card>
            <Card icon={<ShieldCheck />} title="最初のルール" data-card="rules">
              <Rows>
                {RULES.map((r) => (
                  <Row key={r}>
                    <Check className="size-4 shrink-0 text-[var(--st-success)]" aria-hidden />
                    <span>{r}</span>
                  </Row>
                ))}
              </Rows>
            </Card>
          </div>
          <div className="mt-[22px] flex flex-wrap gap-2.5">
            <Button variant="outline" icon={<MessageSquare />} onClick={() => setFixing(true)}>
              違うところを言う
            </Button>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}

// 最初のルール：運営の安全ルール（上書きできない・D-015・D-041・D-107）。会社ごとに変わらない
const RULES = [
  "外に出るもの（メール・請求書・投稿）は必ずあなたが承認してから",
  "銀行はブラウザで触らない（会計ソフトの正規連携だけ）",
  "CAPTCHA は突破しない。出たら止めてあなたに渡す",
  "資格情報は自分のAIにもAI社員にも見えない（預かり先の番号だけ）",
];
const fmt = (v: number | string | null) => {
  const n = Number(v);
  return v === null || v === "" || Number.isNaN(n) ? "—" : n.toLocaleString("ja-JP");
};
// 見た目は 06_mockup/s_p1.py の _goal_card ほか（.card の段・.dl の行・.u の単位）
function Card({
  icon,
  title,
  aside,
  children,
  ...rest
}: { icon: ReactNode; title: string; aside?: ReactNode; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <section className="min-w-0 border-t border-[var(--line)] pt-[22px] pb-2.5" {...rest}>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-h2 font-bold [&>svg]:size-5">
          {icon}
          {title}
        </h2>
        <div className="flex-1" />
        {aside}
      </div>
      {children}
    </section>
  );
}
const Rows = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2 text-[13.5px]">{children}</div>
);
const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-[var(--r-md)] bg-[var(--surface)] px-3 py-2.5">
    {children}
  </div>
);
const Unit = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full bg-[var(--sv)] px-2 py-px text-[11.5px] whitespace-nowrap text-[var(--on-sv)]">
    {children}
  </span>
);
const Note = ({ children }: { children: ReactNode }) => (
  <p className="mt-2.5 text-[12px] text-[var(--on-sv)]">{children}</p>
);
