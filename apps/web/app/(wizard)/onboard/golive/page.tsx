"use client";
// 本番に切り替える（T-U-12・A12・D-028.4・D-116.5・E-DEP-004）。足りていない設定を潰して、明日から自動で動く状態にする。
//   切り替える前の確認（会社モデルが確定・Bridge がつながっている・外に出るものは承認が要る・AI社員が使うログイン情報と権限・AI社員の目標）は本物の記録から出す。
//   赤が 1 件でもあれば「切り替える」を出さない（D-116.5）。黄は理由を見て承知のうえで押せる。足りない AI社員は「止めたまま本番へ」にできる（E-DEP-004 の一手）。
//   押したら会社が本番になり（tenants.live_at）、段 6 を通したと記録される。別 GET で読み直して「切り替えた」に変わる。
import Link from "next/link";
import type { Route } from "next";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, Check, Clock, PauseCircle, Play, ShieldCheck, Sun, Zap } from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { isBuilt } from "@/lib/built-routes";
import { cn } from "@/lib/cn";
import { AuthExtError, goLivePause, goLiveSwitch, onboardGoLive, type GoLiveCheck } from "@/lib/auth/ext";

export default function GoLivePage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="本番に切り替える" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <GoLive />
    </RequireSession>
  );
}

const PURPOSE = "足りていない設定を潰して、明日から自動で動く状態にします。";

function GoLive() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["onboard-golive"], queryFn: onboardGoLive });
  const d = q.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const refetch = () => qc.invalidateQueries({ queryKey: ["onboard-golive"] });
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      await refetch();
      await qc.invalidateQueries({ queryKey: ["setup-state"] });
    } catch (e) {
      setErr(e instanceof AuthExtError ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(null);
    }
  };
  const live = d?.live ?? null;
  return (
    <WizardLayout title="本番に切り替える" purpose={live ? "" : PURPOSE} existing={WIZARD_EXISTING}>
      {q.isPending ? (
        <p className="text-[13.5px] text-[var(--on-sv)]">読んでいます</p>
      ) : q.isError ? (
        <p className="text-[13.5px]" role="alert">
          切り替える前の確認を読めませんでした（{q.error instanceof Error ? q.error.message : "理由は分かりません"}）
        </p>
      ) : live ? (
        <Switched at={live.at} by={live.by} />
      ) : (
        <div data-state="n">
          <div className="grid gap-4 md:grid-cols-2">
            <Card icon={<ShieldCheck />} title="本番に切り替える前に" data-card="checks">
              <div className="flex flex-col gap-2 text-[13.5px]">
                {d!.checks.map((c) => (
                  <CheckRow
                    key={c.id}
                    c={c}
                    busy={busy}
                    onPause={(paused) => void run(`pause:${c.employee_id}`, () => goLivePause(c.employee_id!, paused))}
                  />
                ))}
              </div>
            </Card>
            <Card icon={<Sun />} title="切り替えると、明日から" data-card="schedule">
              <div className="flex flex-col gap-2 text-[13.5px]">
                {d!.schedule.length === 0 ? (
                  <p className="text-[13px] text-[var(--on-sv)]">
                    担当業務がまだありません。たたき台で担当業務ができると、ここに並びます。
                  </p>
                ) : (
                  d!.schedule.map((s, i) => (
                    <Row key={i} icon={<Clock />} muted={s.paused} data-schedule={s.paused ? "paused" : "on"}>
                      <span className="num min-w-[48px] text-[var(--on-sv)]">朝</span>
                      <span>
                        {s.staff ? `${s.staff}が` : ""}
                        {s.duty}
                        {s.paused ? "（止めたまま。動かしません）" : ""}
                      </span>
                    </Row>
                  ))
                )}
                <Row icon={<Clock />}>
                  <span className="num min-w-[48px] text-[var(--on-sv)]">朝</span>
                  <span>自分のAIが上がってきたものを一次確認し、承認待ちを作る</span>
                </Row>
                <Row icon={<Clock />}>
                  <span className="num min-w-[48px] text-[var(--on-sv)]">朝</span>
                  <span>自分のAIが申し送りを書く。あなたは今日の画面で読む</span>
                </Row>
              </div>
              <div
                className="mt-3.5 rounded-[var(--r-md)] border border-dashed border-[var(--tertiary)] bg-[var(--tertiary-c)] px-3.5 py-3 text-[13.5px] leading-[1.8]"
                data-ai-note
              >
                <div className="mb-1 flex items-center gap-1.5 font-bold">
                  <Bot className="size-4" aria-hidden="true" />
                  自分のAI
                </div>
                {d!.red > 0
                  ? d!.shortfall
                  : d!.warn > 0
                    ? `${d!.warn} 件の警告は、理由を見て承知のうえで切り替えられます。切り替えたあとも、私は外に出る前に必ずあなたに見せます。`
                    : "準備ができています。切り替えたあとも、私は外に出る前に必ずあなたに見せます。"}
              </div>
            </Card>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {d!.red > 0 ? (
              // 赤が 1 件でもあれば主アクションを出さない（D-116.5）。何をすれば出るかを書く
              <p className="text-[13px] text-[var(--on-sv)]" data-golive-blocked>
                赤を全部直す（か、その AI社員を止めたまま本番へ にする）と「切り替える」が出ます
              </p>
            ) : (
              <Button
                icon={<Zap />}
                disabled={busy !== null}
                onClick={() => void run("switch", () => goLiveSwitch(d!.warn > 0))}
                data-golive-switch
              >
                {d!.warn > 0 ? `切り替える（${d!.warn}件の警告を承知のうえで）` : "切り替える"}
              </Button>
            )}
            {err ? (
              <p className="text-[12.5px] text-[var(--error)]" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </WizardLayout>
  );
}

const LEVEL: Record<GoLiveCheck["level"], { pill: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ok: { pill: "OK", tone: "success" },
  warn: { pill: "警告", tone: "warning" },
  red: { pill: "足りない", tone: "danger" },
  paused: { pill: "止めたまま", tone: "neutral" },
};

function CheckRow({ c, busy, onPause }: { c: GoLiveCheck; busy: string | null; onPause: (paused: boolean) => void }) {
  const l = LEVEL[c.level];
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2.5",
        c.level === "warn"
          ? "border-l-[3px] border-[var(--st-warning)] bg-[var(--st-warning-c)] text-[var(--on-st-warning-c)]"
          : c.level === "red"
            ? "border-l-[3px] border-[var(--st-danger)] bg-[var(--st-danger-c)] text-[var(--on-st-danger-c)]"
            : "bg-[var(--surface)]",
        c.level === "paused" ? "opacity-70" : "",
      )}
      data-check={c.id}
      data-level={c.level}
    >
      {c.level === "ok" ? (
        <Check className="size-4 shrink-0 text-[var(--st-success)]" aria-hidden="true" />
      ) : c.level === "paused" ? (
        <PauseCircle className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <b>{c.title}</b>
        {c.detail ? <span className="block text-[12.5px] opacity-90">{c.detail}</span> : null}
      </span>
      <Pill tone={l.tone}>{l.pill}</Pill>
      {c.fix && c.level !== "ok" ? (
        <Link href={c.fix.href as Route} data-fix>
          <Button size="sm" variant="outline">
            {c.fix.label}
          </Button>
        </Link>
      ) : null}
      {c.employee_id && c.level === "red" ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<PauseCircle />}
          disabled={busy !== null}
          onClick={() => onPause(true)}
          data-pause={c.employee_id}
        >
          止めたまま本番へ
        </Button>
      ) : null}
      {c.level === "paused" ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<Play />}
          disabled={busy !== null}
          onClick={() => onPause(false)}
          data-resume={c.employee_id}
        >
          動かす
        </Button>
      ) : null}
    </div>
  );
}

function Switched({ at, by }: { at: string; by: string }) {
  const today = isBuilt("/today");
  return (
    <div data-state="ok" className="border-t border-[var(--line)] pt-[22px]">
      <div className="px-5 py-9 text-center">
        <div className="mx-auto mb-[18px] grid size-[60px] place-items-center rounded-full bg-[var(--st-success-c)] text-[var(--st-success)]">
          <Check className="size-7" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-[20px] font-bold">本番で動いています</h2>
        <p className="mx-auto mb-[22px] max-w-[520px] text-[13.5px] leading-[1.85] text-[var(--on-sv)]" data-live-note>
          明日の朝、自分のAIの申し送りから始まります。今日はもう何もしなくて大丈夫です。止めたいときは「今日」の画面からいつでも止められます。
          <span className="mt-1 block text-[12px]">
            {new Date(at).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}
            {by ? ` · ${by}` : ""} が切り替えました
          </span>
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {today ? (
            <Link href={"/today" as Route}>
              <Button icon={<Sun />}>今日の画面へ</Button>
            </Link>
          ) : (
            <>
              <Button
                icon={<Sun />}
                disabled
                title="今日の画面は作っています（できたら、ここから開けます）"
                data-today-not-yet
              >
                今日の画面へ
              </Button>
              <Link href="/">
                <Button variant="outline">Kaname を開く</Button>
              </Link>
            </>
          )}
        </div>
        {today ? null : (
          <p className="mt-2 text-[12px] text-[var(--on-sv)]" data-not-yet>
            今日の画面は作っています（できたら、ここから開けます）。それまでは自分のAIとの会話が使えます
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  children,
  muted,
  ...rest
}: { icon: ReactNode; children: ReactNode; muted?: boolean } & Record<`data-${string}`, string>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2.5 rounded-[var(--r-md)] bg-[var(--surface)] px-3 py-2.5",
        muted ? "opacity-60" : "",
      )}
      {...rest}
    >
      <span className="shrink-0 text-[var(--on-sv)] [&>svg]:size-4">{icon}</span>
      {children}
    </div>
  );
}

// 見た目は 06_mockup/s_p1b.py の card（段の見出し・行）
function Card({
  icon,
  title,
  children,
  ...rest
}: { icon: ReactNode; title: string; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <section className="min-w-0 border-t border-[var(--line)] pt-[22px] pb-2.5" {...rest}>
      <h2 className="mb-3.5 flex items-center gap-2 text-h2 font-bold [&>svg]:size-5">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
