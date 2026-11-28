"use client";
// テストで動かす（T-U-11・A11・D-028・D-116.4）。外に一切出ない状態で AI社員を動かし、出てきたものを見て納得してから本番へ。
//   3 状態（最初・動かした・止まった）は本物の記録（AI社員・担当業務・テストの実行 action_runs・渡された成果物）から出す。
//   AI社員を実際に動かす結線（実行ループ）は T-I-01。それまで「動かす」「もう少し試す」「ブラウザで開く」は押せない形で出し、そう書く（まだ無いものを隠さない・D-116.6）。
//   「本番に切り替える」は下の帯（D-116.1）。全員が 完了 か「この仕事はやめる」のときだけ押せ、段 5 を通したと記録する（D-116.4）
import "@/components/ai/chat.css";
import Link from "next/link";
import type { Route } from "next";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Eye, FlaskConical, Globe, Play, X } from "lucide-react";
import { Button, Empty, Pill } from "@/components/ui";
import { ArtifactPanel } from "@/components/ai/artifact";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { useMarkStep } from "@/lib/onboarding";
import { AuthExtError, onboardTestrun, testrunCancel, type TestRunEmployee, type TestRunStatus } from "@/lib/auth/ext";

export default function TestrunPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="テストで動かす" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <Testrun />
    </RequireSession>
  );
}

const STATUS: Record<TestRunStatus, { label: string; tone: "success" | "progress" | "danger" | "neutral" }> = {
  done: { label: "完了", tone: "success" },
  running: { label: "実行中", tone: "progress" },
  stopped: { label: "止まった", tone: "danger" },
  cancelled: { label: "やめた", tone: "neutral" },
};
const FORMAT: Record<string, string> = {
  md: "文書",
  csv: "表",
  pdf: "PDF",
  png: "画像",
  jpg: "画像",
  gif: "画像",
  webp: "画像",
  xlsx: "表計算",
  docx: "文書",
  pptx: "資料",
};
const NOT_YET = "AI社員を動かす仕組みは作っています（できたら、ここから動かせます）";

function Testrun() {
  const markStep = useMarkStep();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["onboard-testrun"],
    queryFn: onboardTestrun,
    refetchInterval: (x) => (x.state.data?.employees.some((e) => e.run?.status === "running") ? 3_000 : false),
  });
  const d = q.data;
  const emps = d?.employees ?? [];
  const stopped = emps.filter((e) => e.run?.status === "stopped");
  const state: "0" | "n" | "x" = !emps.some((e) => e.run) ? "0" : stopped.length ? "x" : "n";
  const [openArt, setOpenArt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cancel = async (runId: string) => {
    setBusy(runId);
    setErr(null);
    try {
      await testrunCancel(runId);
      await qc.invalidateQueries({ queryKey: ["onboard-testrun"] });
    } catch (e) {
      setErr(e instanceof AuthExtError ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(null);
    }
  };
  const waiting =
    emps.length === 0
      ? "たたき台に AI社員がいると試せます（3. たたき台で自分のAIに作らせます）"
      : stopped.length
        ? "止まった AI社員を通すか「この仕事はやめる」を選ぶと切り替えられます"
        : "AI社員を全員 1 回ずつテストで動かすと切り替えられます";
  return (
    <WizardLayout
      // 「本番に切り替える」は下の帯（D-116.1）。全員が 完了 か やめた のときだけ押せる。押したら段 5 を通したと記録し（D-116.4）、6 本番へ（T-U-12）で切り替える前の確認をする
      next={{
        ready: !q.isPending && !q.isError && !!d?.ready,
        label: "本番に切り替える",
        waiting,
        onGo: async () => {
          await markStep(5);
          router.push("/onboard/golive" as Route);
        },
      }}
      title="テストで動かす"
      purpose="外に一切出ない状態でAI社員を動かし、出てきたものを見て納得してから本番へ。"
      existing={WIZARD_EXISTING}
    >
      {q.isPending ? (
        <p className="text-[13.5px] text-[var(--on-sv)]">読んでいます</p>
      ) : q.isError ? (
        <p className="text-[13.5px]" role="alert">
          テストの記録を読めませんでした（{q.error instanceof Error ? q.error.message : "理由は分かりません"}）
        </p>
      ) : state === "0" ? (
        <div data-state="0">
          <Empty
            icon={<FlaskConical />}
            title="まだ何も動かしていません"
            action={
              emps.length === 0 ? (
                <Link href="/onboard/draft">
                  <Button variant="outline">たたき台を確かめる</Button>
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    {emps.map((e, i) => (
                      <Button
                        key={e.employee_id}
                        variant={i === 0 ? "primary" : "outline"}
                        icon={<Play />}
                        disabled
                        title={NOT_YET}
                        data-run-employee={e.employee_id}
                      >
                        {e.name}を動かす
                      </Button>
                    ))}
                  </div>
                  <p className="text-[12px] text-[var(--on-sv)]" data-not-yet>
                    {NOT_YET}
                  </p>
                </div>
              )
            }
          >
            {emps.length === 0
              ? "たたき台に AI社員がまだいません。たたき台で担当業務とAI社員ができると、ここで試せます。"
              : "AI社員を1体選んで、試しに動かしてみてください。外には出ません。"}
          </Empty>
        </div>
      ) : (
        <div data-state={state}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              icon={<FlaskConical />}
              title="テストで動かす"
              aside={<Pill tone="ai">テストモード · 外に出ない</Pill>}
              data-card="runs"
            >
              <p className="mb-3 text-[13px] leading-[1.8] text-[var(--on-sv)]">
                テストモードでは、AI社員は<b className="text-[var(--on-surface)]">実データを読みます</b>が、
                <b className="text-[var(--on-surface)]">外に一切出しません</b>
                （送信・投稿・書き込みはすべて止まります）。出てきたものを見て、納得したら本番に切り替えます。
              </p>
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-[var(--on-sv)]">
                    <th className="pb-2 font-semibold">AI社員</th>
                    <th className="pb-2 font-semibold">試す仕事</th>
                    <th className="pb-2 font-semibold">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {emps.map((e) => (
                    <tr
                      key={e.employee_id}
                      className="border-t border-[var(--line)]"
                      data-row-employee={e.employee_id}
                      data-run-status={e.run?.status ?? "none"}
                    >
                      <td className="py-2.5 pr-2 align-top">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Bot className="size-4 text-[var(--on-sv)]" aria-hidden="true" />
                          {e.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 align-top text-[var(--on-sv)]">
                        {e.duty || "担当業務はまだありません"}
                      </td>
                      <td className="py-2.5 align-top">
                        <RunState e={e} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {state === "x" ? (
              <Card
                icon={<AlertTriangle />}
                title="止まった理由"
                aside={<span className="text-[12px] text-[var(--on-sv)]">自分のAIから</span>}
                data-card="stopped"
              >
                {stopped.map((e) => (
                  <div
                    key={e.employee_id}
                    className="mb-3 rounded-[var(--r-md)] border-l-[3px] border-[var(--st-warning)] bg-[var(--st-warning-c)] px-3.5 py-3 text-[13.5px] leading-[1.8] text-[var(--on-st-warning-c)]"
                    data-stopped-reason={e.run!.id}
                  >
                    <b>{e.name}</b>：{e.run?.reason || "理由は分かりません"}
                    <div className="mt-1 text-[12px]">
                      Kaname は CAPTCHA
                      を突破しません。あなたが一度ブラウザで通してくれれば、そのセッションで続きを動かします。
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" icon={<Globe />} disabled title={NOT_YET} data-open-browser>
                        ブラウザで開く
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<X />}
                        disabled={busy === e.run!.id}
                        onClick={() => void cancel(e.run!.id)}
                        data-cancel-run={e.run!.id}
                      >
                        この仕事はやめる
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-[12px] text-[var(--on-sv)]">{NOT_YET}</p>
                {err ? (
                  <p className="mt-2 text-[12px] text-[var(--error)]" role="alert">
                    {err}
                  </p>
                ) : null}
              </Card>
            ) : (
              <Card
                icon={<Eye />}
                title="上がってきたもの"
                aside={<span className="text-[12px] text-[var(--on-sv)]">AI社員が渡したもの</span>}
                data-card="outputs"
              >
                {d!.outputs.length === 0 ? (
                  <p className="text-[13px] text-[var(--on-sv)]">
                    まだ出てきたものはありません。AI社員が成果物を渡すと、ここに並びます。
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 text-[13.5px]">
                    {d!.outputs.map((o) => (
                      <div
                        key={o.id}
                        className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-[var(--r-md)] bg-[var(--surface)] px-3 py-2.5"
                        data-output={o.id}
                      >
                        <div className="min-w-0 flex-1">
                          <b className="block truncate">{o.title}</b>
                          <span className="text-[12px] text-[var(--on-sv)]">
                            {FORMAT[o.format] ?? o.format}
                            {o.employee ? ` · ${o.employee}` : ""}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" icon={<Eye />} onClick={() => setOpenArt(o.id)} data-art-open>
                          見る
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-[13px] leading-[1.8]" data-ai-note>
                  {emps.filter((e) => e.run?.status === "done").length}
                  体を動かしました。出てきたものを見て、納得したら下の「本番に切り替える」を押してください。止めたいときはいつでも止められます。
                </p>
              </Card>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button variant="outline" icon={<FlaskConical />} disabled title={NOT_YET} data-more>
              もう少し試す
            </Button>
            <span className="text-[12px] text-[var(--on-sv)]">{NOT_YET}</span>
          </div>
        </div>
      )}
      {openArt ? (
        <div className="kc">
          <ArtifactPanel id={openArt} onClose={() => setOpenArt(null)} />
        </div>
      ) : null}
    </WizardLayout>
  );
}

function RunState({ e }: { e: TestRunEmployee }) {
  if (!e.run) return <span className="text-[12.5px] text-[var(--on-sv)]">まだ</span>;
  const s = STATUS[e.run.status];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Pill tone={s.tone}>{s.label}</Pill>
      {e.run.status === "done" && e.run.count > 1 ? (
        <span className="text-[12px] text-[var(--on-sv)]">{e.run.count} 回</span>
      ) : null}
    </span>
  );
}

// 見た目は 06_mockup/s_p1b.py の card（段の見出し・行）
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
