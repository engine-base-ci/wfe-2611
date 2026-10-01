"use client";
// 作業中の見せ方（D-104.8）：吹き出しを出さず、枠なしの行で「〇〇を調べています…」・手順のチェックリスト・経過時間・道具の行。
// 終わると「N つの操作・時間」の 1 行に畳まれて返事の上に残る。止まったら理由だけ（D-104.15）。使用量は近い・達したときだけ（D-104.16）
import Link from "next/link";
import type { Route } from "next";
import { isBuilt } from "@/lib/built-routes";
import { Check, CircleDot, Clock, Hourglass, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { AgentState, QueuedItem, Todo, Usage, Work } from "@/lib/auth/ext";
import { duration } from "@/lib/agent";

/** 経過時間：画面の側で 1 秒ずつ進める（見に行く間は 1.2 秒あくので、止まって見えないように） */
function useElapsed(baseMs: number, since: string): string {
  const [now, setNow] = useState(() => Date.now());
  const [at] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return duration(baseMs + (now - at));
}

/** いまの動きは「〇〇しています…」の一言で出す（秒数ではなく、何をしているか・2026-09-28 本人の指摘） */
const dots = (t: string) => (/[…:：]/.test(t) || t.endsWith("…") ? t : `${t}…`);
/** 作業の行に内部の名前（mcp__…・select:…・ToolSearch）を出さない。古い Bridge が送ってきた文もここで言い換える */
const KANAME_TOOL: Record<string, string> = {
  draft_read: "たたき台を読んでいます",
  goal_set: "たたき台に目標を置いています",
  goal_remove: "目標を外しています",
  ledger_set: "たたき台に台帳を置いています",
  ledger_remove: "台帳を外しています",
  duty_set: "たたき台に担当業務を置いています",
  duty_remove: "担当業務を外しています",
  remember: "覚えています",
};
export function humanStatus(t: string): string {
  if (/ToolSearch|select:mcp__/.test(t)) return "使う道具を探しています";
  const k = /mcp__kaname__([a-z_]+)/.exec(t);
  if (k) {
    const rest = t.split(/[:：]/).slice(1).join("：").trim();
    const head = KANAME_TOOL[k[1]!] ?? "Kaname に書いています";
    return rest && !/mcp__/.test(rest) ? `${head}：${rest}` : head;
  }
  return t.replace(/mcp__[a-z0-9-]+__([a-zA-Z0-9_-]+)/g, "$1");
}
const agoText = (sec: number) => (sec < 60 ? `${sec} 秒前` : sec < 3600 ? `${Math.floor(sec / 60)} 分前` : `${Math.floor(sec / 3600)} 時間前`);

export function WorkLive({ work, waiting, offlineSec = null }: { work: Work; waiting?: "answer" | "permission" | null; offlineSec?: number | null }) {
  const elapsed = useElapsed(work.elapsed_ms, `${work.job_id}-${work.elapsed_ms}`);
  // PC の Bridge が応答していない間は「書いています」と言い続けない（2026-09-28 実例：Bridge が止まった後も 38 分そのままだった）
  const status = offlineSec !== null
    ? `PC の Bridge から応答がありません（最後の知らせは ${agoText(offlineSec)}）。PC を開くと、止まったところから確かめます`
    : work.stopping
    ? "止めています…"
    : waiting === "answer"
      ? "あなたの答えを待っています"
      : waiting === "permission" || work.state === "asking"
        ? "許可を待っています"
        : work.partial
          ? "返事を書いています…"
          : dots(humanStatus(work.status ?? "考えています"));
  return (
    <div className="work live" role="status" aria-busy="true" aria-label="自分のAIの作業" data-working>
      <div className="wl">
        {offlineSec !== null ? <Pause aria-hidden="true" /> : <span className="spin" aria-hidden="true" />}
        <span className="ws">
          {status}
          {offlineSec !== null && isBuilt("/setup/bridge") ? (
            <Link href={"/setup/bridge" as Route} className="lk" data-reconnect>
              PC の Bridge をつなぎ直す
            </Link>
          ) : null}
        </span>
        <span className="el">{elapsed}</span>
      </div>
      {/* 道具の行は並べない。いまの動きは上の 1 行が切り替わって伝える（2026-09-28 本人の指摘） */}
      {work.plan?.length ? <Steps todos={work.plan} /> : null}
    </div>
  );
}

function Steps({ todos }: { todos: Todo[] }) {
  return (
    <ol className="wsteps" aria-label="手順">
      {todos.map((s, i) => {
        const cls = s.status === "completed" ? "done" : s.status === "in_progress" ? "now" : "todo";
        return (
          <li key={`${i}-${s.content}`} className={cls}>
            {cls === "done" ? <Check /> : cls === "now" ? <Play /> : <Clock />}
            <span>{s.content}</span>
            <span className="sr-only">{cls === "done" ? "（済み）" : cls === "now" ? "（いま）" : "（まだ）"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 終わった作業の 1 行（返事の上に残る・押すと開く） */
export function WorkDone({ ops, ms }: { ops: number; ms: number }) {
  return (
    <details className="work done" data-work-done>
      <summary>
        <Check />
        <span>
          {ops > 0 ? `${ops} つの操作 · ` : ""}
          {duration(ms)}
        </span>
      </summary>
      <div className="wd">道具を {ops} 回使いました。道具の返り値の全文はあなたの PC に置いたままです</div>
    </details>
  );
}

/** 止まった：理由だけ。ボタンは置かず、入力欄は開いたまま（D-104.15） */
export function StopLine({ reason }: { reason: string }) {
  return (
    <div className="stopline" role="status" data-part="stopped">
      <Pause />
      <div>
        <b>ここで止まりました。</b>
        <span data-stopped-reason>{reason}</span>
        <div className="muted">続けるなら「続けて」、ほかのことならそのまま書いてください。勝手には動き出しません</div>
      </div>
    </div>
  );
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
/** 使用量（D-104.16）：5 時間の枠が 80% を超えたら案内、100% なら「戻るまで動けません」 */
export const USAGE_NEAR = 0.8;
export function UsageLine({ usage }: { usage: Usage | undefined }) {
  const w = usage?.five_hour;
  const week = usage?.week;
  const hit = [w, week].find((x) => x && x.utilization >= 1);
  const near = !hit ? [w, week].find((x) => x && x.utilization >= USAGE_NEAR) : undefined;
  const which = (x: typeof w) => (x === week ? "週" : "5 時間");
  if (hit)
    return (
      <div className="usage lim" role="status" data-usage="limit">
        <Pause />
        <div>
          <b>サブスクの{which(hit)}の枠に達しました。</b>
          {hhmm(hit.resets_at)} に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）
          {isBuilt("/account") ? <Link href={"/account" as Route}>使用量を見る</Link> : null}
        </div>
      </div>
    );
  if (near)
    return (
      <div className="usage" role="status" data-usage="near">
        <Clock />
        <div>
          <b>
            サブスクの{which(near)}の枠が {Math.round(near.utilization * 100)}% です。
          </b>
          {hhmm(near.resets_at)} に戻ります。長い作業は戻ってからの方が止まりにくいです
          {isBuilt("/account") ? <Link href={"/account" as Route}>使用量を見る</Link> : null}
        </div>
      </div>
    );
  return null;
}

/** 別の会話の仕事の後ろで待っている（本人の PC の Claude Code は一度に 1 つ）。黙って止まって見せず、どこを待っているかとそこへの道を出す */
export function LaneWait({ on, onOpen }: { on: AgentState["waiting_on"]; onOpen: (conversationId: string) => void }) {
  if (!on) return null;
  return (
    <div className="usage" role="status" data-lane-wait>
      <Hourglass />
      <div>
        <b>{on.asking ? "別の会話で、自分のAI があなたの答えを待っています。" : "別の会話で、自分のAI が動いています。"}</b>
        {on.asking ? "そちらに答えると、ここに書いたことが順に動きます" : "それが終わると、ここに書いたことが順に動きます"}（{on.title}）
        <button type="button" className="lk" onClick={() => onOpen(on.conversation_id)}>
          その会話を開く
        </button>
      </div>
    </div>
  );
}

/** 順番待ち（取り消せる・D-104.9）。入力欄の上に出す。一言は次の区切りで渡し、仕事は今の作業が終わったら順に */
export function QueueBox({ items, onCancel, elsewhere = false }: { items: QueuedItem[]; onCancel: (item: QueuedItem) => void; elsewhere?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="cqueue" aria-label="順番待ち" data-queue>
      {items.map((q) => (
        <div key={q.id} data-queued={q.kind}>
          <CircleDot />
          <span>
            {q.text ?? "（文なし）"}
            <span className="muted">{q.kind === "steer" ? " · 次の区切りで伝えます" : elsewhere ? " · 別の会話の作業が終わったら" : " · 今の作業が終わったら"}</span>
          </span>
          <button type="button" title="取り消す" aria-label={`「${q.text ?? ""}」を取り消す`} onClick={() => onCancel(q)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
