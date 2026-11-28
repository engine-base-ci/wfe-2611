// 運営のパスキーを付ける画面の口を呼ぶ所（K-1003・.ts）：押したときの順は リンクの口 startOpsSetup（K-945）→ 部品のパスキーを付ける口
//   （始め・確かめ・K-309 の受け渡し）→ ログアウト（付けるだけのセッションを閉じる・K-306）。
//   付けるだけのセッションの印は React の状態にだけ置き、ログインの印の置き場（lib/api/client）には置かない。
//   端末でやめた後の押し直しは、リンクの口を呼び直さない（リンクは 1 回だけ・同じセッションで付け直す）
"use client";
import { startRegistration } from "@simplewebauthn/browser";
import { useCallback, useRef, useState } from "react";
import { call } from "@/lib/api/call";
import { passkeyGet, passkeyPost } from "@/lib/auth/passkey-net";

const REGISTER_OPTIONS = "/api/auth/passkey/generate-register-options" as const;
const REGISTER_VERIFY = "/api/auth/passkey/verify-registration" as const;
const SCREEN = "ops-team";
/** リンクの口が「使えないリンク」と答える番号（無い・使った・期限切れ・D-156.12） */
const INVALID_LINK = "E-PAGE-006";
/** つながらなかった（網の切れ・429・503・422）：下絵の状態が無いので入れ物の字 */
export const NETWORK_TEXT = "つながりませんでした。通信を確かめて、もう一度押してください";

export type OpsSetupStep = "ready" | "done" | "invalid" | "failed";
export interface OpsSetupState {
  mode: OpsSetupStep;
  busy: boolean;
  /** つながらなかった字（mode は変えない） */
  alert: string | null;
}
type Outcome = { mode: OpsSetupStep; alert: string | null; session?: string };

/** リンクの口：使えれば付けるだけのセッションの印。409 は使えないリンク・それ以外の失敗はつながらなかった */
async function openSession(token: string, name: string): Promise<Outcome> {
  try {
    const r = await call("startOpsSetup", { body: { token, name }, screenId: SCREEN, keepOn401: true });
    if (r.ok) {
      const session = (r.data as { token?: unknown } | undefined)?.token;
      return typeof session === "string" && session !== ""
        ? { mode: "ready", alert: null, session }
        : { mode: "ready", alert: NETWORK_TEXT };
    }
    if (r.status === 409 && r.code === INVALID_LINK) return { mode: "invalid", alert: null };
    return { mode: "ready", alert: NETWORK_TEXT };
  } catch {
    return { mode: "ready", alert: NETWORK_TEXT };
  }
}

/** 部品のパスキーを付ける口（始め → 端末 → 確かめ）。端末でやめた・時間切れは failed */
async function register(session: string, name: string): Promise<Outcome> {
  try {
    const o = await passkeyGet(REGISTER_OPTIONS, session);
    if (!o.ok) return { mode: "ready", alert: NETWORK_TEXT };
    const { challenge_token: challenge, ...options } = o.body;
    let response: unknown;
    try {
      response = await startRegistration({ optionsJSON: options as never });
    } catch {
      return { mode: "failed", alert: null };
    }
    const v = await passkeyPost(REGISTER_VERIFY, { response, name }, String(challenge ?? ""), session);
    return v.ok ? { mode: "done", alert: null } : { mode: "failed", alert: null };
  } catch {
    return { mode: "ready", alert: NETWORK_TEXT };
  }
}

/** 付けるだけのセッションを閉じる。閉じられなくても付けたことは変わらない（セッションは数分で切れる） */
async function closeSession(session: string): Promise<void> {
  try {
    await call("signOut", {
      body: {},
      headers: { authorization: `Bearer ${session}` },
      screenId: SCREEN,
      keepOn401: true,
    });
  } catch {
    // 閉じられなかった：付けたことは変えない（期限で切れる）
  }
}

export function useOpsSetup(): OpsSetupState & { submit: (token: string, name: string) => Promise<void> } {
  const [state, setState] = useState<OpsSetupState>({ mode: "ready", busy: false, alert: null });
  const session = useRef<string | null>(null);
  const running = useRef(false);

  const submit = useCallback(async (token: string, name: string) => {
    if (running.current) return; // 二度押しで印を 2 回送らない
    running.current = true;
    setState((s) => ({ ...s, busy: true, alert: null }));
    try {
      if (session.current === null) {
        const opened = await openSession(token, name);
        if (!opened.session) {
          setState({ mode: opened.mode, busy: false, alert: opened.alert });
          return;
        }
        session.current = opened.session;
      }
      const done = await register(session.current, name);
      if (done.mode === "done") {
        await closeSession(session.current);
        session.current = null;
      }
      setState({ mode: done.mode, busy: false, alert: done.alert });
    } finally {
      running.current = false;
    }
  }, []);

  return { ...state, submit };
}
