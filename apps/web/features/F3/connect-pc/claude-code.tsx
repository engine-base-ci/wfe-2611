"use client";
// PC の行の Claude Code の足りない物と直し方（K-361・前の画面 /setup/bridge/legacy の needBlock を移した）。
//   渡された 1 台の区画を描くだけ。どの行に出すか（この PC の見分け・この PC の口の読み）は pc-row-extra.tsx の hook が決める。
//   見た目は下絵の部品 pc-row-parts.tsx の ClaudeCodeFix（K-369）。ここは値と押した結果をつなぐ。
//   入れる・ログインはこの PC の中だけの口（Bridge・K-359）で動く。コードも入口の URL も Kaname の口には送らない（D-091・D-092）
import { useEffect, useRef, useState } from "react";
import { installClaude, installProgress, loginClaude, loginCode, type Check } from "@/lib/bridge-presence";
import type { Device } from "./devices";
import { jstStamp } from "./pc-cards";
import { ClaudeCodeFix as ClaudeCodeView, type ClaudeFix, type ClaudeLoginStep } from "./pc-row-parts";

/** ログインが済んだときに行に残す知らせ（区画が消えた後も出す・下絵 pc-claude-done） */
export const LOGGED_IN_TEXT = "ログインできました。これで仕事を渡せます";

/** 自己診断から出す直し方。入れる前はログインを出さない（1 画面 1 主アクション）。並びでない・知らない直し方は何も出さない */
export function claudeFixOf(health: unknown): ClaudeFix | null {
  if (!Array.isArray(health)) return null;
  const bad = health.filter(
    (c): c is Check => typeof c === "object" && c !== null && (c as { ok?: unknown }).ok === false,
  );
  const first = bad.find((c) => c.fix === "install" || c.fix === "repair");
  if (first?.fix === "install" || first?.fix === "repair") return first.fix;
  return bad.some((c) => c.fix === "login") ? "login" : null;
}

/* ---- ログインの入口はこの画面のセッションの保存だけに持つ（読み込み直したら続きから・10 分で捨てる） ---- */
const LOGIN_KEY = "kaname.claude-login";
/** Bridge がログインを自分で止めるまでの時間（apps/bridge/src/login.ts の GIVE_UP_MS と同じ 10 分） */
const LOGIN_TTL_MS = 10 * 60_000;
const PROGRESS_EVERY_MS = 1_000;

const isHttps = (url: string): boolean => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};
function readLogin(deviceId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(LOGIN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { device_id?: unknown; url?: unknown; at?: unknown };
    if (v.device_id !== deviceId) return null;
    if (typeof v.at !== "number" || Date.now() - v.at > LOGIN_TTL_MS || typeof v.url !== "string" || !isHttps(v.url)) {
      window.sessionStorage.removeItem(LOGIN_KEY);
      return null;
    }
    return v.url;
  } catch {
    return null;
  }
}
function saveLogin(deviceId: string, url: string): void {
  try {
    window.sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ device_id: deviceId, url, at: Date.now() }));
  } catch {
    /* 保存できなくても、この画面の中では続けられる */
  }
}
function clearLogin(): void {
  try {
    window.sessionStorage.removeItem(LOGIN_KEY);
  } catch {
    /* 消せなくても、10 分で読まなくなる */
  }
}
const lastStep = (steps: { text: string }[]): string | null => steps[steps.length - 1]?.text ?? null;

export interface ClaudeCodeFixProps {
  device: Device;
  /** この PC の行（この PC の Bridge の /ping の device_id と行の id が同じ） */
  mine: boolean;
  /** この PC の口の /check（mine の行だけ。null＝読めなかったので一覧の health を使う） */
  local: Check[] | null;
  /** この PC の口の /check を読み直す（入れた後・入れ終わった後） */
  onRecheck: () => Promise<void>;
  /** ログインが済んだ（hook が行に知らせを残し、/check を読み直す） */
  onLoggedIn: () => void;
}

export function ClaudeCodeFix({ device, mine, local, onRecheck, onLoggedIn }: ClaudeCodeFixProps) {
  const fix = claudeFixOf(mine && local ? local : device.health);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<ClaudeLoginStep | null>(null);
  /** 2 回押しでも口は 1 回（押せなくなる前の 2 回目の押しを止める） */
  const acting = useRef(false);
  /** 開いたときに入れている途中だった（終わったら /check を読み直す） */
  const resuming = useRef(false);
  const stopPoll = useRef<(() => void) | null>(null);
  const recheck = useRef(onRecheck);
  recheck.current = onRecheck;

  const canInstall = mine && (fix === "install" || fix === "repair");
  const canLogin = mine && fix === "login";

  // 読み込み直したとき：入れている途中なら、押した後と同じ途中の形にする（入れる口は呼び直さない）
  useEffect(() => {
    if (!canInstall) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = async (): Promise<void> => {
      const p = await installProgress();
      if (!alive) return;
      if (p?.running) {
        resuming.current = true;
        acting.current = true;
        setBusy(true);
        setProgress(lastStep(p.steps));
        timer = setTimeout(() => void look(), PROGRESS_EVERY_MS);
        return;
      }
      if (!resuming.current) return;
      resuming.current = false;
      setProgress(null);
      await recheck.current();
      setBusy(false);
      acting.current = false;
    };
    void look();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [canInstall]);

  // 読み込み直したとき：入口を持ってから 10 分以内なら、入口とコードの欄を出し直す（/login-cancel は送らない）
  useEffect(() => {
    if (!canLogin) return;
    const url = readLogin(device.id);
    if (url) setLogin((l) => l ?? { url, code: "" });
  }, [canLogin, device.id]);

  useEffect(() => () => stopPoll.current?.(), []);

  if (!fix) return null;

  const watchProgress = (): (() => void) => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = async (): Promise<void> => {
      const p = await installProgress();
      if (!alive) return;
      const text = p?.running ? lastStep(p.steps) : null;
      if (text) setProgress(text);
      timer = setTimeout(() => void look(), PROGRESS_EVERY_MS);
    };
    void look();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  };

  const doInstall = async (): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    stopPoll.current = watchProgress();
    const r = await installClaude();
    stopPoll.current();
    stopPoll.current = null;
    setProgress(null);
    if (r.ok) await recheck.current();
    else setError(r.message);
    setBusy(false);
    acting.current = false;
  };

  const doLogin = async (): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    const r = await loginClaude();
    if (r.ok && r.url && isHttps(r.url)) {
      saveLogin(device.id, r.url);
      setLogin({ url: r.url, code: "" });
    } else if (r.ok)
      await recheck.current(); // もうログインしていた
    else setError(r.message);
    setBusy(false);
    acting.current = false;
  };

  const doCode = async (): Promise<void> => {
    const code = login?.code.trim() ?? "";
    if (!login || code === "" || acting.current) return;
    acting.current = true;
    setLogin({ ...login, busy: true });
    setError(null);
    const r = await loginCode(code);
    if (r.ok) {
      clearLogin();
      setLogin(null);
      onLoggedIn();
    } else {
      setLogin((l) => (l ? { ...l, busy: false } : l));
      setError(r.message);
    }
    acting.current = false;
  };

  return (
    <ClaudeCodeView
      fix={fix}
      mine={mine}
      reportedAt={device.state === "asleep" ? jstStamp(device.health_at, true) : null}
      progress={progress}
      busy={busy}
      error={error}
      login={canLogin ? login : null}
      onInstall={() => void doInstall()}
      onLogin={() => void doLogin()}
      onCode={(v) => setLogin((l) => (l ? { ...l, code: v } : l))}
      onSubmitCode={() => void doCode()}
    />
  );
}
