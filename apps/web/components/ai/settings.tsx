"use client";
// 自分のAI の設定の部品（D-104.14・D-104.16・D-104.19）。置き場の画面：ルール › 個人（T-U-34）・自分のアカウント（T-U-44）・お知らせと通知（T-U-51）
//   いつも許可の一覧と取り消し・許可の既定（全部許可は既定にできない）／使用量（5 時間の枠・週の枠・いつ戻るか）／知らせ（終わった・許可が要る を別々に）
import { Bell, Clock, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ALL_ALLOWED, MODES, type DefaultMode } from "@/lib/agent-modes";
import { notifyEnabled, setNotify, type NotifyKind } from "@/lib/agent";
import { agentPermissionRevoke, agentPermissionRules, agentSetDefaultMode, agentUsage } from "@/lib/auth/ext";

/** いつも許可（ルール › 個人）。取り消すと次の仕事から毎回聞く */
export function AlwaysAllowList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["agent-default-mode"], queryFn: agentPermissionRules });
  const reload = () => void qc.invalidateQueries({ queryKey: ["agent-default-mode"] });
  const d = q.data;
  if (!d) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="always-h" data-part="always-allow">
      <h2 id="always-h" className="flex items-center gap-2 text-h2 font-semibold">
        <Shield className="size-4" />
        自分のAI の許可
      </h2>
      <label className="flex flex-wrap items-center gap-2 text-[14px]">
        許可の既定
        <select
          className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[16px] md:text-[14px]"
          value={d.default_mode}
          onChange={async (e) => {
            try {
              await agentSetDefaultMode(e.target.value as DefaultMode);
              toast("許可の既定を変えました（次に話すときから）");
            } catch (err) {
              toast(`変えられませんでした（${err instanceof Error ? err.message : ""}）`);
            } finally {
              reload();
            }
          }}
          data-default-mode
        >
          {MODES.filter((m) => m.id !== ALL_ALLOWED).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-[var(--on-sv)]">全部許可は既定にできません。会話ごとに入力欄で選びます</span>
      </label>
      <div>
        <h3 className="mb-1 text-[14px] font-semibold">いつも許可にしたもの</h3>
        {d.rules.length ? (
          <ul className="flex flex-col divide-y divide-[var(--line-soft)] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--card)]">
            {d.rules.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-[14px]">
                <b className="shrink-0">{r.tool}</b>
                <code className="min-w-0 flex-1 truncate font-[var(--font-code)] text-[12px] text-[var(--on-sv)]">
                  {r.target ?? "（すべて）"}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 />}
                  onClick={async () => {
                    try {
                      await agentPermissionRevoke(r.id);
                      toast("取り消しました。次からは毎回聞きます");
                    } catch (err) {
                      toast(`取り消せませんでした（${err instanceof Error ? err.message : ""}）`);
                    } finally {
                      reload();
                    }
                  }}
                  data-revoke
                >
                  取り消す
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--on-sv)]">
            まだありません。許可を聞かれたときに「いつも許可」を選ぶと、ここに並びます。
          </p>
        )}
      </div>
    </section>
  );
}

const hm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
/** 使用量（D-104.16）：Claude・ChatGPT と同じく、枠の埋まり方といつ戻るか。本人のサブスクの枠 */
export function UsagePanel() {
  const q = useQuery({ queryKey: ["agent-usage"], queryFn: agentUsage, refetchInterval: 60_000 });
  const u = q.data;
  if (!u) return null;
  const rows = [
    ["five_hour", "5 時間の枠"],
    ["week", "1 週間の枠"],
  ] as const;
  const any = rows.some(([k]) => u[k]);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="usage-h" data-part="usage">
      <h2 id="usage-h" className="flex items-center gap-2 text-h2 font-semibold">
        <Clock className="size-4" />
        自分のAI の使用量
      </h2>
      {any ? (
        rows.map(([k, label]) => {
          const w = u[k];
          if (!w) return null;
          const pct = Math.round(w.utilization * 100);
          return (
            <div key={k} className="flex flex-col gap-1">
              <div className="flex justify-between text-[14px]">
                <span>{label}</span>
                <b className="num">{pct}%</b>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[var(--sv)]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
              >
                <i
                  className="block h-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: pct >= 100 ? "var(--st-danger)" : pct >= 80 ? "var(--st-warning)" : "var(--primary)",
                  }}
                />
              </div>
              <span className="text-[12px] text-[var(--on-sv)]">
                {hm(w.resets_at)} に戻ります · {hm(w.observed_at)} 時点
              </span>
            </div>
          );
        })
      ) : (
        <p className="text-[13px] text-[var(--on-sv)]">
          まだ分かりません。自分のAI が一度動くと、あなたの PC から届きます。
        </p>
      )}
      <p className="text-[12px] text-[var(--on-sv)]">
        あなたのサブスクの枠です。上限が近づくと、会話の中でもお知らせします。
      </p>
    </section>
  );
}

/** 知らせ（D-104.19）：「終わった」と「許可が要る」を別々にオン・オフ。その会話を見ている間は知らせない。この端末（ブラウザ）ごと */
export function NotifyToggles() {
  const [on, setOn] = useState<Record<NotifyKind, boolean>>({ done: false, ask: false });
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(typeof Notification !== "undefined");
    setOn({ done: notifyEnabled("done"), ask: notifyEnabled("ask") });
  }, []);
  const rows: [NotifyKind, string, string][] = [
    ["done", "自分のAI が終わったとき", "動かしたまま別の画面・別のアプリにいても分かります"],
    ["ask", "自分のAI が許可を待っているとき", "答えるまで自分のAI は待っています"],
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="notify-h" data-part="notify">
      <h2 id="notify-h" className="flex items-center gap-2 text-h2 font-semibold">
        <Bell className="size-4" />
        自分のAI からの知らせ（この端末）
      </h2>
      {!supported ? <p className="text-[13px] text-[var(--on-sv)]">このブラウザは知らせに対応していません。</p> : null}
      {rows.map(([k, label, desc]) => (
        <label key={k} className="flex items-start gap-3 text-[14px]">
          <input
            type="checkbox"
            className="mt-1"
            checked={on[k]}
            disabled={!supported}
            onChange={async (e) => {
              const want = e.target.checked;
              const got = await setNotify(k, want);
              if (want && !got) toast("ブラウザで知らせが許可されていません。ブラウザの設定で許可してください");
              setOn((o) => ({ ...o, [k]: got }));
            }}
            data-notify={k}
          />
          <span>
            <b>{label}</b>
            <span className="block text-[12px] text-[var(--on-sv)]">{desc}。その会話を見ている間は知らせません</span>
          </span>
        </label>
      ))}
    </section>
  );
}
