"use client";
// 自分の設定 › 知らせ（K-843・画面 account・行為 A74）。外枠 MeShell の中に部品 NotifyBody（K-801）。
//   ワークスペースごとのタブ（getMe の workspaces の順・初めは今の会社）。タブを開いたときだけ、そのワークスペースを 1 回読む。
//   押したら保存（押した項目だけ・答えで差し替え・失敗は前に戻す）。ほかのワークスペースに写す小窓。保存だけ（D-154.24）。
//   401 は call が入り直しへ送る。読めないタブは ErrorState と「もう一度読む」（ほかのタブは使える）
import { useRef, useState } from "react";
import { Button, ErrorState, Loading, PAGE_ERROR, errorCodeOf, errorText, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import type { MeAnswer } from "./me-shape";
import { MeShell } from "./me-shell";
import { CopyDialog, NotifyBody, Panel, type CopyTarget } from "./notify";
import {
  COPY_NONE,
  ROW_FAIL,
  TOP_FAIL,
  copiedText,
  eventPatch,
  quietLabel,
  toPanel,
  type Channel,
  type NotifyPatch,
} from "./notify-shape";
import { useNotifySettings, useNotifyWrite } from "./use-notify";
import { useMe, useMeCache } from "./use-me";

/** 調子が悪い（503・網の切れ）の字 */
const downText = (): string => errorText(PAGE_ERROR.down).entry.message;
const notFoundText = (): string => errorText(PAGE_ERROR.notFound).entry.message;

function ReadFailed({ err, retry }: { err: CallErr | null; retry: () => void }) {
  const code = !err || err.status === 503 ? PAGE_ERROR.down : errorCodeOf(err);
  return (
    <>
      <ErrorState code={code} />
      <div className="k-state-actions">
        <Button variant="primary" onClick={retry}>
          もう一度読む
        </Button>
      </div>
    </>
  );
}

type Fail = { kind: "auth" } | { kind: "refused"; text: string } | { kind: "failed" };
/** 保存の断りの扱い：401 は call が入り直しへ送る・409（止められない出来事など）は口の文・ほかは保存できなかった */
function failOf(err: CallErr | null): Fail {
  if (err?.kind === "unauthenticated") return { kind: "auth" };
  if (err?.kind === "conflict") return { kind: "refused", text: err.message ?? TOP_FAIL };
  return { kind: "failed" };
}

/** 1 つのワークスペースのパネル（開いているタブだけ描く） */
function WsPanel({ workspaceId, timezone }: { workspaceId: string; timezone: string }) {
  const q = useNotifySettings(workspaceId);
  const { saveNotify } = useNotifyWrite();
  const busy = useRef(new Set<string>());
  const [events, setEvents] = useState<Record<string, { bell: boolean; mail: boolean }>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quiet, setQuiet] = useState<string | null>(null);
  const [urgent, setUrgent] = useState<string[] | null>(null);

  if (q.isError) return <ReadFailed err={q.error.err} retry={() => void q.refetch()} />;
  const a = q.data;
  if (!a) return <Loading />;
  const v = toPanel(a, timezone, Date.now());

  /** 送って、答えで差し替える（失敗の字を返す） */
  const send = async (what: string, patch: NotifyPatch): Promise<Fail | null> => {
    if (busy.current.has(what)) return null;
    busy.current.add(what);
    const r = await saveNotify(workspaceId, patch);
    busy.current.delete(what);
    return r.ok ? null : failOf(r.err);
  };
  const settle = (f: Fail | null, rowKey?: string) => {
    if (!f) {
      setNotice(null);
      setFailedKey(null);
      return;
    }
    if (f.kind === "auth") return;
    setNotice(f.kind === "refused" ? f.text : TOP_FAIL);
    setFailedKey(f.kind === "failed" && rowKey ? rowKey : null);
  };

  const rows = v.rows.map((r) => ({
    ...r,
    ...(events[r.key] ?? {}),
    ...(failedKey === r.key ? { failed: true, detail: ROW_FAIL } : {}),
  }));
  const onToggle = async (key: string, channel: Channel, value: boolean) => {
    const row = rows.find((r) => r.key === key);
    if (!row || row.fixed || busy.current.has(key)) return;
    const next = eventPatch(row, channel, value);
    setEvents((e) => ({ ...e, [key]: { bell: next.bell, mail: next.mail } }));
    setBusyKey(key);
    const f = await send(key, { events: [next] });
    setEvents((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)));
    setBusyKey(null);
    settle(f, key);
  };
  const onPreset = async (preset: string) => {
    setQuiet(preset);
    const f = await send("quiet", { quiet_hours: { preset } });
    setQuiet(null);
    settle(f);
  };
  const onPause = async (pause: string | null) => settle(await send("pause", { pause }));
  const onUrgent = async (value: string, on: boolean) => {
    const now = urgent ?? v.urgent;
    const next = on ? [...now.filter((x) => x !== value), value] : now.filter((x) => x !== value);
    setUrgent(next);
    const f = await send("urgent", { urgent_override: next });
    setUrgent(null);
    settle(f);
  };

  return (
    <Panel
      notice={notice}
      events={rows}
      busyKey={busyKey}
      onToggle={(k, c, val) => void onToggle(k, c, val)}
      preset={quiet ? quietLabel(quiet) : v.quiet}
      onPreset={(p) => void onPreset(p)}
      paused={v.paused}
      onPause={(p) => void onPause(p)}
      onResume={() => void onPause(null)}
      urgent={urgent ?? v.urgent}
      onUrgent={(u, on) => void onUrgent(u, on)}
    />
  );
}

/** 写す小窓の状態と送り */
function useCopy(me: MeAnswer | undefined, from: string | undefined, reloadMe: () => Promise<void>) {
  const { copyNotify } = useNotifyWrite();
  const notify = useNotify();
  const [targets, setTargets] = useState<CopyTarget[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openDialog = () => {
    if (!me || !from) return;
    setError(null);
    setTargets(
      me.workspaces.filter((w) => w.tenant_id !== from).map((w) => ({ id: w.tenant_id, name: w.name, checked: false })),
    );
  };
  const close = () => {
    setTargets(null);
    setError(null);
  };
  const copy = async () => {
    const to = (targets ?? []).filter((t) => t.checked).map((t) => t.id);
    if (!from || to.length === 0 || busy) return;
    setBusy(true);
    const r = await copyNotify(from, to);
    setBusy(false);
    if (r.ok) {
      close();
      notify(copiedText(to.length));
      return;
    }
    if (r.err?.kind === "unauthenticated") return;
    if (r.err?.kind === "not_found") {
      setError(notFoundText());
      void reloadMe();
      return;
    }
    setError(r.err && r.err.status !== 503 && r.err.message ? r.err.message : downText());
  };
  const toggle = (id: string, on: boolean) =>
    setTargets((ts) => (ts ? ts.map((t) => (t.id === id ? { ...t, checked: on } : t)) : ts));
  return { targets, busy, error, openDialog, close, copy, toggle };
}

export function NotifyScreen() {
  const q = useMe();
  const me = q.data;
  const { reloadMe } = useMeCache();
  const [picked, setPicked] = useState<string | undefined>();
  const current = me ? (me.workspaces.find((w) => w.current) ?? me.workspaces[0])?.tenant_id : undefined;
  const selected = me?.workspaces.some((w) => w.tenant_id === picked) ? picked : current;
  const copy = useCopy(me, selected, reloadMe);

  let body;
  if (q.isError)
    body = (
      <section className="k-page k-me-page" aria-label="お知らせ">
        <ReadFailed err={q.error.err} retry={() => void q.refetch()} />
      </section>
    );
  else if (!me || !selected) body = <Loading />;
  else {
    const fromName = me.workspaces.find((w) => w.tenant_id === selected)?.name ?? "";
    body = (
      <>
        <NotifyBody
          tabs={me.workspaces.map((w) => ({
            value: w.tenant_id,
            label: w.name,
            panel:
              w.tenant_id === selected ? (
                <WsPanel key={w.tenant_id} workspaceId={w.tenant_id} timezone={me.member.timezone} />
              ) : null,
          }))}
          value={selected}
          onTab={setPicked}
          onCopy={copy.openDialog}
          copyDisabled={me.workspaces.length < 2 ? { title: COPY_NONE } : null}
        />
        {copy.targets ? (
          <CopyDialog
            open
            from={fromName}
            targets={copy.targets}
            onToggle={copy.toggle}
            onCopy={() => void copy.copy()}
            onClose={copy.close}
            busy={copy.busy}
            error={copy.error}
          />
        ) : null}
      </>
    );
  }
  return <MeShell current="notices">{body}</MeShell>;
}
