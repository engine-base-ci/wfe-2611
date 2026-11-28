"use client";
// 会話が変わった知らせを受ける（D-113）。1 ページに 1 本だけ開き、会話を出す部品は全部これを共有する（L-008）。
//   届くのは「変わった」の合図だけ。中身はいつもの /agent/state を読み直す。
//   つながっている間（live）は見に行く間隔を長くし、つながらない・落ちた・黙った間は今までどおり 1.2 秒ごとに見に行く。
//   黙って止まらない（G-15）：生きている合図（25 秒ごと）が 60 秒来なければ切ってつなぎ直す。
import { useEffect, useState } from "react";
import { apiBase, getToken } from "@/lib/api/client";

/** 生きている合図が来ないまま待つ長さ。過ぎたら黙って止まったものとして切る */
const SILENT_MS = 60_000;
/** つなぎ直しの待ち（落ちた直後は短く、続けて落ちるほど長く）。知らせの接続が無い API（503）は長く */
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const UNAVAILABLE_MS = 60_000;

export interface StreamListener {
  change: () => void;
  live: (on: boolean) => void;
}

/** 受け取った文字を SSE の区切りで割る。区切りの無い残りは次に回す */
export function splitEvents(buf: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  let rest = buf.replace(/\r\n/g, "\n");
  let i: number;
  while ((i = rest.indexOf("\n\n")) >= 0) {
    const block = rest.slice(0, i);
    rest = rest.slice(i + 2);
    const ev = /^event: ?(.*)$/m.exec(block)?.[1];
    const data = /^data: ?(.*)$/m.exec(block)?.[1] ?? "";
    events.push({ event: ev ?? (block.startsWith(":") ? "alive" : "message"), data });
  }
  return { events, rest };
}

const listeners = new Set<StreamListener>();
let live = false;
let ctrl: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let fails = 0;

const setLive = (on: boolean) => {
  if (live === on) return;
  live = on;
  for (const l of listeners) l.live(on);
};
const later = (ms: number) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void open();
  }, ms);
};
const backoff = () => Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** Math.min(fails++, 5));

async function open(): Promise<void> {
  if (!listeners.size || ctrl) return;
  const t = getToken();
  if (!t) return; // ログインしていない。見に行く形のまま（入ったら次の部品がまた開く）
  const c = new AbortController();
  ctrl = c;
  let silent: ReturnType<typeof setTimeout> | null = null;
  const alive = () => {
    if (silent) clearTimeout(silent);
    silent = setTimeout(() => c.abort(), SILENT_MS);
  };
  let next: number | null = null;
  try {
    const res = await fetch(`${apiBase()}/api/auth-ext/agent/stream`, {
      headers: { accept: "text/event-stream", authorization: `Bearer ${t}` },
      signal: c.signal,
      cache: "no-store",
    });
    if (res.status === 401) return; // 入り直しは /agent/state 側が扱う。ここは見に行く形のまま止める
    if (!res.ok || !res.body) {
      next = res.status === 503 ? UNAVAILABLE_MS : backoff();
      return;
    }
    alive();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const x = await reader.read();
      if (x.done) break;
      alive();
      const s = splitEvents(buf + dec.decode(x.value, { stream: true }));
      buf = s.rest;
      for (const e of s.events) {
        if (e.event === "ready") {
          fails = 0;
          setLive(true);
          // つながるまでの間に変わった分を取りこぼさない
          for (const l of listeners) l.change();
        } else if (e.event === "change") for (const l of listeners) l.change();
        else if (e.event === "down") next = RETRY_MIN_MS;
        else if (e.event === "end") next = e.data === "unauthenticated" ? null : 0;
      }
    }
    next ??= backoff();
  } catch {
    next = listeners.size ? backoff() : null;
  } finally {
    if (silent) clearTimeout(silent);
    if (ctrl === c) ctrl = null;
    setLive(false);
    if (next !== null && listeners.size) later(next);
  }
}

function subscribe(l: StreamListener): () => void {
  listeners.add(l);
  l.live(live);
  if (!ctrl && !timer) void open();
  return () => {
    listeners.delete(l);
    if (listeners.size) return;
    if (timer) clearTimeout(timer);
    timer = null;
    ctrl?.abort();
    ctrl = null;
    setLive(false);
  };
}

/** 会話が変わったら onChange を呼ぶ。つながっている間は true（見に行く間隔を長くしてよい） */
export function useAgentStream(enabled: boolean, onChange: () => void): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const off = subscribe({ change: onChange, live: setOn });
    return () => {
      off();
      setOn(false);
    };
  }, [enabled, onChange]);
  return enabled && on;
}
