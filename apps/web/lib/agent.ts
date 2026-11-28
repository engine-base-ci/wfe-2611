"use client";
// 自分のAIとの会話を画面が扱うための 1 か所（D-090・D-103・D-104）。会話を出す画面はどれもここを使う（L-008）。
//   会話は人が分ける（D-104.1）：いま開いている会話を選ぶ・新しく話す・一覧から戻る
//   言う・止める・止めずに直す（動いている間に送った文は次の区切りで効く）・順番待ちの取り消し（D-104.9）
//   許可の 3 択＋一言・問い合わせの答え（D-104.7・D-104.14）／資料を付ける（D-104.11）
//   止まったら理由だけ。ボタンは置かず、次に送る文で決まる（D-104.15）。送れなかった文は消さずに残す
//   許可のモード・モデル・考える強さは会話ごと。全部許可は本人がこの会話で選んだときだけ（既定にできない）
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  agentAnswer2,
  agentAttach,
  agentMarkRead,
  agentMessagesBefore,
  agentNewConversation,
  agentPermissionRules,
  agentSay,
  agentState,
  agentSteer,
  agentSteerCancel,
  agentStop,
  AuthExtError,
  bridgeState,
  type AgentContext,
  type AgentMsg,
  type AgentState,
  type BridgeState,
  type Effort,
  type PermissionMode,
  type QueuedItem,
} from "@/lib/auth/ext";
import { useAgentStream } from "@/lib/agent-stream";
export type { AgentContext } from "@/lib/auth/ext";

/** 動いている間は短く、止まっている・何もしていない間は長く見に行く（変わった知らせが来ない間・D-113） */
const POLL_WORKING_MS = 1_200;
const POLL_IDLE_MS = 6_000;
/** 変わった知らせを受けている間は、知らせで読み直す。見に行くのは取りこぼしの保険だけ */
const SAFETY_WORKING_MS = 15_000;
const SAFETY_IDLE_MS = 60_000;
/** 1 回に送れる長さ（超えたら分け方を案内する・D-104.10） */
export const MAX_SAY = 20_000;

/** 付けた資料（送る前の一覧に出す） */
export interface Att {
  key: string;
  name: string;
  size: number;
  /** 置き場に置けた id。置いている途中・失敗は null */
  id: string | null;
  error: string | null;
}
/** 送れなかった文（消さずに「もう一度送る」・D-104.15） */
export interface Failed {
  key: string;
  text: string;
  reason: string;
  conversation_id: string | null;
}
/** 会話ごとの選択（D-104.10・D-104.13・D-104.14）。model／effort が null なら PC の設定のまま */
export interface Prefs {
  mode: PermissionMode;
  model: string | null;
  effort: Effort | null;
}
export interface SayOptions {
  context?: AgentContext;
  attachments?: string[];
  quote?: { text: string; message_id: string | null };
  /** 直して送り直す：この文の時点から新しい会話にする（元の会話は残る・D-104.17） */
  branch_from?: string;
}

export interface Agent {
  state: AgentState | null;
  /** いま開いている会話（null は「新しく話す」の手前＝まだ何も無い会話） */
  conversationId: string | null;
  /** 開こうとした会話がもう無い（消した・他人の） */
  missing: boolean;
  /** 上へ戻ると古い分を読み込む（D-104.18）。まだ前があるか・読み込み中か */
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => Promise<void>;
  /** 前のやりとりを読めなかった（押すまで読み直さない） */
  olderFailed: boolean;
  retryOlder: () => void;
  loading: boolean;
  /** 送っている最中（押した直後に二重で送らせない） */
  sending: boolean;
  /** 送れなかった理由・答えられなかった理由。黙って飲み込まない */
  error: string | null;
  /** 仕事が動いている（Bridge が取った）。送るボタンが止めるに変わる */
  running: boolean;
  /** 動いている・順番を待っている仕事がある */
  working: boolean;
  failed: Failed[];
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  /** 言う。動いている間は止めずに直す（次の区切りで効く）。まだ動き出していなければ順番待ちに並ぶ */
  say: (text: string, opts?: SayOptions | AgentContext) => Promise<boolean>;
  retry: (key: string) => Promise<void>;
  dismissFailed: (key: string) => void;
  stop: () => Promise<void>;
  cancelQueued: (item: QueuedItem) => Promise<void>;
  /** 許可に答える：今回だけ／いつも／しない ＋ 一言。問い合わせは answers に「問い → 選んだ答え」 */
  answer: (a: {
    allow: boolean;
    scope?: "once" | "always";
    note?: string;
    answers?: Record<string, string>;
  }) => Promise<void>;
  /** 会話を選ぶ（一覧から戻る）。null で「新しく話す」 */
  select: (conversationId: string | null) => void;
  /** 新しく話す（D-104.1）。incognito は記憶に使わない会話 */
  startNew: (incognito?: boolean) => Promise<void>;
  attach: (file: File) => Promise<Att>;
}

const readJSON = <T>(k: string): T | null => {
  try {
    const v = typeof window === "undefined" ? null : window.sessionStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const writeJSON = (k: string, v: unknown): void => {
  try {
    window.sessionStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 使えない窓（プライベート等）では覚えない。動きは変わらない */
  }
};
const prefsKey = (c: string | null) => `kaname.agent.prefs.${c ?? "new"}`;
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** 会話のいま。enabled が false（まだつながっていない・ログイン前）の間は引かない */
export function useAgent(enabled = true, initialConversation?: string | null): Agent {
  const qc = useQueryClient();
  // 開く会話は URL（?c=）が持つ。無ければいちばん新しい会話（別の画面・別のタブで新しく話しても古い会話に戻らない）
  const [conv, setConv] = useState<string | null>(() => initialConversation ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const rules = useQuery({
    queryKey: ["agent-default-mode"],
    queryFn: () => agentPermissionRules(),
    enabled,
    staleTime: 60_000,
  });
  const defaultMode: PermissionMode = rules.data?.default_mode ?? "manual";
  const [prefsByConv, setPrefsByConv] = useState<Record<string, Prefs>>({});
  const prefs: Prefs = prefsByConv[conv ?? "new"] ??
    readJSON<Prefs>(prefsKey(conv)) ?? { mode: defaultMode, model: null, effort: null };
  // 会話が変わった知らせ（D-113）。届いたら読み直す。つながらない間は今までどおり見に行く
  const onChange = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["agent-state"] });
    void qc.invalidateQueries({ queryKey: ["agent-conversations"] });
  }, [qc]);
  const pushed = useAgentStream(enabled, onChange);
  const q = useQuery({
    queryKey: ["agent-state", conv],
    queryFn: () => agentState(conv),
    enabled,
    refetchInterval: (x) => {
      const busy = !!(x.state.data?.running_job_id || x.state.data?.asking);
      if (pushed) return busy ? SAFETY_WORKING_MS : SAFETY_IDLE_MS;
      return busy ? POLL_WORKING_MS : POLL_IDLE_MS;
    },
    // 別のタブ・別のアプリにいる間も見に行く（見ていない間に終わった・許可が要る を知らせるため・D-104.19）
    refetchIntervalInBackground: true,
  });
  const fresh = q.data ?? null;
  // 続けて送った文は順に送る。2 本目は 1 本目を送り終えた後の状態（会話・動いている仕事）で判断する
  const live = useRef<{ fresh: AgentState | null; conv: string | null }>({ fresh: null, conv: null });
  live.current = { fresh, conv };
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // 古い分（上へ戻ったときに読み込んだもの）。会話ごと。いまの 200 件の前に足して出す
  const [older, setOlder] = useState<{ conv: string | null; msgs: AgentMsg[]; more: boolean | null }>({
    conv: null,
    msgs: [],
    more: null,
  });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderFailed, setOlderFailed] = useState<string | null>(null);
  const olderHere = older.conv === (fresh?.conversation_id ?? null) ? older : { conv: null, msgs: [], more: null };
  const state = useMemo(() => {
    if (!fresh || !olderHere.msgs.length) return fresh;
    const seen = new Set(fresh.messages.map((m) => m.id));
    return { ...fresh, messages: [...olderHere.msgs.filter((m) => !seen.has(m.id)), ...fresh.messages] };
  }, [fresh, olderHere.msgs]);
  const PAGE = 200;
  const hasOlder = olderHere.more ?? (fresh?.messages.length ?? 0) >= PAGE;
  // 何も選んでいないときは、いちばん新しい会話が返る。その会話を「いま開いている会話」にする
  useEffect(() => {
    if (!conv && state?.conversation_id) setConv(state.conversation_id);
  }, [conv, state?.conversation_id]);
  const running = !!state?.work;
  // 開こうとした会話が無い（消した・他人の）。黙って別の会話を出さない（CHT-15-006）
  const missing = !!conv && !!state && state.conversation_id === null && !q.isFetching;
  const working = !!state?.running_job_id;
  const refresh = useCallback(async () => {
    const r = await q.refetch();
    if (r.data) live.current = { ...live.current, fresh: r.data };
    void qc.invalidateQueries({ queryKey: ["agent-conversations"] });
  }, [q, qc]);

  const setPrefs = useCallback(
    (p: Partial<Prefs>) => {
      setPrefsByConv((m) => {
        const next = { ...prefs, ...p };
        // 全部許可はこの会話だけ。新しい会話・覚えておく既定には持ち越さない（D-104.14）
        writeJSON(prefsKey(conv), next);
        return { ...m, [conv ?? "new"]: next };
      });
    },
    [conv, prefs],
  );

  const send = useCallback(
    async (text: string, o: SayOptions, key?: string): Promise<boolean> => {
      const t = text.trim();
      if (!t) return false;
      if (t.length > MAX_SAY) {
        setError(
          `長すぎます（${t.length.toLocaleString()} 字）。${MAX_SAY.toLocaleString()} 字までに分けるか、資料として付けてください`,
        );
        return false;
      }
      setSending(true);
      setError(null);
      const now = live.current.fresh;
      const conv = live.current.conv;
      try {
        const ask = now?.asking;
        if (ask?.tool === "AskUserQuestion" && !o.branch_from) {
          // 問い合わせに文で答えてもよい（D-104.7）：書いた文を答えとして返す
          const qs = ((ask.input as { questions?: { question?: string }[] } | null)?.questions ?? []).map((x) =>
            String(x.question ?? ""),
          );
          await agentAnswer2({
            job_id: ask.job_id,
            request_id: ask.request_id,
            allow: true,
            answers: Object.fromEntries(
              (qs.length ? qs : ["答え"]).map((q, i) => [
                q,
                i === 0 ? t : "（文で答えました。最初の問いの答えを見てください）",
              ]),
            ),
          });
        } else if (
          (now?.work || now?.running_job_id) &&
          !o.attachments?.length &&
          !o.quote &&
          !o.branch_from &&
          (await agentSteer(now.work?.job_id ?? now.running_job_id!, t, {
            permission_mode: prefs.mode,
            ...(prefs.model ? { model: prefs.model } : {}),
            ...(prefs.effort ? { effort: prefs.effort } : {}),
          }).then(
            () => true,
            // まだ動き出していない仕事（PC が取る前）には渡せない。そのときは後ろに並べる
            (e: unknown) => (e instanceof AuthExtError && e.status === 409 ? false : Promise.reject(e)),
          ))
        ) {
          // 動いている間に送った文は、止めずに次の区切りで効く（それまで順番待ちで取り消せる・D-104.9）
        } else {
          const r = await agentSay({
            text: t,
            ...(conv ? { conversation_id: conv } : {}),
            ...(o.context ? { context: o.context } : {}),
            ...(o.attachments?.length ? { attachment_ids: o.attachments } : {}),
            ...(o.quote ? { quote: o.quote } : {}),
            ...(o.branch_from ? { branch_from: o.branch_from } : {}),
            permission_mode: prefs.mode,
            ...(prefs.model ? { model: prefs.model } : {}),
            ...(prefs.effort ? { effort: prefs.effort } : {}),
          });
          if (r.conversation_id !== conv) {
            // 新しく話した会話の選択は、その会話のものとして持ち越す（全部許可を含め、この会話だけ）
            writeJSON(prefsKey(r.conversation_id), prefs);
            if (!conv) {
              // 「新しく話す」の手前で選んだもの（全部許可を含む）は、次の新しい会話に持ち越さない
              try {
                window.sessionStorage.removeItem(prefsKey(null));
              } catch {
                /* 覚えられない窓 */
              }
              setPrefsByConv((m) => {
                const { new: _drop, ...rest } = m;
                void _drop;
                return { ...rest, [r.conversation_id]: prefs };
              });
            }
            setConv(r.conversation_id);
            live.current = { ...live.current, conv: r.conversation_id };
          }
        }
        if (key) setFailed((f) => f.filter((x) => x.key !== key));
        await refresh();
        return true;
      } catch (e) {
        // API が理由を返したらそれを、届かなかったら回線の話にする（E-CHAT-001）
        const reason = e instanceof AuthExtError ? e.message : "回線が切れていました";
        // 書いた文は消さない。印を付けて「もう一度送る」を出す
        const k = key ?? `f-${Date.now().toString(36)}`;
        setFailed((f) => [...f.filter((x) => x.key !== k), { key: k, text: t, reason, conversation_id: conv }]);
        return false;
      } finally {
        setSending(false);
      }
    },
    [prefs, refresh],
  );
  const say = useCallback(
    async (text: string, opts?: SayOptions | AgentContext): Promise<boolean> => {
      // 昔の呼び方（第 2 引数に文脈だけ）も受ける
      const o: SayOptions = opts && "screen" in opts ? { context: opts } : ((opts as SayOptions | undefined) ?? {});
      // 送っている途中に続けて送っても捨てない。前の 1 本が終わってから順に送る
      const p = chain.current.then(() => send(text, o));
      chain.current = p.catch(() => undefined);
      return p;
    },
    [send],
  );
  const retry = useCallback(
    async (key: string) => {
      const f = failed.find((x) => x.key === key);
      if (f) await send(f.text, {}, key);
    },
    [failed, send],
  );
  const dismissFailed = useCallback((key: string) => setFailed((f) => f.filter((x) => x.key !== key)), []);
  const stop = useCallback(async () => {
    const job = state?.work?.job_id ?? state?.running_job_id;
    if (!job) return;
    setError(null);
    try {
      await agentStop(job);
    } catch (e) {
      setError(errorText(e, "止められませんでした"));
    } finally {
      await refresh();
    }
  }, [state, refresh]);
  const cancelQueued = useCallback(
    async (item: QueuedItem) => {
      setError(null);
      try {
        if (item.kind === "steer") await agentSteerCancel(item.id);
        else await agentStop(item.job_id);
      } catch (e) {
        setError(errorText(e, "取り消せませんでした"));
      } finally {
        await refresh();
      }
    },
    [refresh],
  );
  const answer = useCallback(
    async (a: { allow: boolean; scope?: "once" | "always"; note?: string; answers?: Record<string, string> }) => {
      const ask = state?.asking;
      if (!ask) return;
      setError(null);
      setSending(true);
      try {
        await agentAnswer2({
          job_id: ask.job_id,
          request_id: ask.request_id,
          allow: a.allow,
          ...(a.scope ? { scope: a.scope } : {}),
          ...(a.note?.trim() ? { note: a.note.trim() } : {}),
          ...(a.answers ? { answers: a.answers } : {}),
        });
      } catch (e) {
        setError(errorText(e, "答えられませんでした"));
      } finally {
        setSending(false);
        await refresh();
      }
    },
    [state, refresh],
  );
  const select = useCallback((c: string | null) => {
    setError(null);
    setConv(c);
  }, []);
  const startNew = useCallback(
    async (incognito = false) => {
      setError(null);
      try {
        const r = await agentNewConversation(incognito);
        setConv(r.conversation_id);
        await refresh();
      } catch (e) {
        setError(errorText(e, "新しい会話を始められませんでした"));
      }
    },
    [refresh],
  );
  const loadOlder = useCallback(async () => {
    const cid = fresh?.conversation_id;
    const first = state?.messages[0];
    if (!cid || !first || loadingOlder || !hasOlder || olderFailed === cid) return;
    setLoadingOlder(true);
    try {
      const r = await agentMessagesBefore(cid, first.at);
      setOlder((o) => ({ conv: cid, msgs: [...r.messages, ...(o.conv === cid ? o.msgs : [])], more: r.has_more }));
    } catch (e) {
      // 失敗したら勝手に読み直さない（見えている限り何度も呼ぶことになる）。押したときだけもう一度
      setOlderFailed(cid);
      setError(errorText(e, "前のやりとりを読み込めませんでした"));
    } finally {
      setLoadingOlder(false);
    }
  }, [fresh?.conversation_id, state?.messages, loadingOlder, hasOlder, olderFailed]);
  const retryOlder = useCallback(() => setOlderFailed(null), []);
  const attach = useCallback(async (file: File): Promise<Att> => {
    const key = `${file.name}-${file.size}-${Date.now().toString(36)}`;
    try {
      const r = await agentAttach(file);
      return { key, name: r.name, size: r.size, id: r.id, error: null };
    } catch (e) {
      return { key, name: file.name, size: file.size, id: null, error: errorText(e, "資料を付けられませんでした") };
    }
  }, []);

  // 見ている間に来た返事は「見た」にする（一覧の印を消す・D-104.18）
  const lastAi = state?.messages?.filter((m) => m.who === "ai").at(-1)?.id ?? null;
  const conversationId = state?.conversation_id ?? conv;
  useEffect(() => {
    if (!conversationId || !lastAi || typeof document === "undefined" || document.hidden) return;
    void agentMarkRead(conversationId)
      .then(() => qc.invalidateQueries({ queryKey: ["agent-conversations"] }))
      .catch(() => undefined);
  }, [conversationId, lastAi, qc]);

  return {
    state,
    missing,
    hasOlder,
    loadingOlder,
    loadOlder,
    olderFailed: !!olderFailed && olderFailed === (fresh?.conversation_id ?? null),
    retryOlder,
    conversationId,
    loading: enabled && q.isPending,
    sending,
    error,
    running,
    working,
    failed: failed.filter((f) => f.conversation_id === conv),
    prefs,
    setPrefs,
    say,
    retry,
    dismissFailed,
    stop,
    cancelQueued,
    answer,
    select,
    startNew,
    attach,
  };
}

export interface Bridge {
  bridge: BridgeState | null;
  loading: boolean;
  /** つながった記録があって、いま本当に生きている。話せるのはこのときだけ */
  usable: boolean;
  /** つながった記録はあるが、知らせが来ていない（PC が閉じている・Bridge を終了した） */
  asleep: boolean;
  refetch: () => void;
}
/** この PC のいま（T-B-04・G-12）。「つながりました」と出したまま実は止まっている、を作らない */
export function useBridge(enabled = true): Bridge {
  const q = useQuery({ queryKey: ["bridge-state"], queryFn: () => bridgeState(), enabled, refetchInterval: 15_000 });
  const b = q.data ?? null;
  return {
    bridge: b,
    loading: enabled && q.isPending,
    usable: !!b?.connected && !!b.live,
    asleep: !!b?.connected && !b.live,
    refetch: () => void q.refetch(),
  };
}

/** 経過を人の言葉にする（D-004：画面に出す数は人が読める形で）。
 *  「87853 秒たっています」のような機械の数字を人に見せない */
export function ago(sec: number | undefined): string {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) return "";
  if (sec < 60) return `${Math.floor(sec)} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分前`;
  if (sec < 86_400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m ? `${h} 時間 ${m} 分前` : `${h} 時間前`;
  }
  const d = Math.floor(sec / 86_400);
  return d === 1 ? "昨日" : `${d} 日前`;
}
/** かかった時間（作業の 1 行・経過時間。D-104.8）：「1分08秒」「42秒」 */
export function duration(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return ms < 1000 ? `${(ms / 1000).toFixed(1)}秒` : `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分${String(s % 60).padStart(2, "0")}秒`;
  return `${Math.floor(m / 60)}時間${String(m % 60).padStart(2, "0")}分`;
}

/** 会話を出す場所が使う 1 つ（D-103）：この PC のいま＋会話＋いまの状態の名前。
 *  状態：loading／nb（つながっていない）／x（PC が閉じている）／stp（止まった）／a（確認待ち）／w（動いている）／n（やりとり）／0（最初） */
export type ChatStateKey = "loading" | "nb" | "x" | "stp" | "a" | "w" | "n" | "0";
export interface AgentChatModel extends Bridge {
  agent: Agent;
  state: ChatStateKey;
}
export function chatState(
  b: Pick<Bridge, "bridge" | "loading" | "asleep">,
  agent: Pick<Agent, "state" | "working">,
): ChatStateKey {
  if (b.loading) return "loading";
  if (!b.bridge?.connected) return "nb";
  if (b.asleep) return "x";
  if (agent.state?.asking) return "a";
  if (agent.working) return "w";
  if (agent.state?.stopped) return "stp";
  return agent.state?.messages?.length ? "n" : "0";
}
export function useAgentChat(initialConversation?: string | null): AgentChatModel {
  const b = useBridge();
  // 溜めるだけならつながった記録があれば足りる（起きたときに順に動く・§66）。眠っている間も会話は読む
  const base = useAgent(!!b.bridge?.connected, initialConversation);
  const [stopNote, setStopNote] = useState<string | null>(null);
  // PC が応答していないときは、止める合図が届かない。止めたことにせず、起きたらすぐ止めると伝える（E-CHAT-003）
  const agent: Agent = useMemo(
    () => ({
      ...base,
      error: base.error ?? stopNote,
      stop: async () => {
        await base.stop();
        setStopNote(
          b.asleep ? "止める合図を PC に届けられませんでした（PC が応答しません）。PC が起きたらすぐ止めます" : null,
        );
      },
    }),
    [base, b.asleep, stopNote],
  );
  useEffect(() => {
    if (!base.working) setStopNote(null);
  }, [base.working]);
  useNotify(agent);
  return { ...b, agent, state: chatState(b, agent) };
}

// ---- 知らせ（D-104.19）：「終わった」と「許可が要る」を別々にオン・オフ。その会話を見ている間は知らせない
export type NotifyKind = "done" | "ask";
const NOTIFY_KEY = (k: NotifyKind) => `kaname.notify.${k}`;
export function notifyEnabled(k: NotifyKind): boolean {
  try {
    return window.localStorage.getItem(NOTIFY_KEY(k)) === "1";
  } catch {
    return false;
  }
}
/** 知らせをオンにする。ブラウザに許可を聞き、断られたらオフのまま（false を返す） */
export async function setNotify(k: NotifyKind, on: boolean): Promise<boolean> {
  if (on) {
    if (typeof Notification === "undefined") return false;
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (p !== "granted") return false;
  }
  try {
    window.localStorage.setItem(NOTIFY_KEY(k), on ? "1" : "0");
  } catch {
    return false;
  }
  return on;
}
function useNotify(agent: Agent): void {
  const prev = useRef<{ job: string | null; ask: string | null }>({ job: null, ask: null });
  const title = useMemo(() => agent.state?.conversation?.title ?? "自分のAI", [agent.state?.conversation?.title]);
  useEffect(() => {
    const job = agent.state?.running_job_id ?? null;
    const ask = agent.state?.asking?.request_id ?? null;
    const was = prev.current;
    prev.current = { job, ask };
    if (
      typeof document === "undefined" ||
      !document.hidden ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    if (was.job && !job && notifyEnabled("done"))
      new Notification("自分のAI が終わりました", { body: title, tag: `done-${was.job}` });
    if (ask && ask !== was.ask && notifyEnabled("ask"))
      new Notification("自分のAI が許可を待っています", {
        body: agent.state?.asking?.summary ?? title,
        tag: `ask-${ask}`,
      });
  }, [agent.state?.running_job_id, agent.state?.asking, title]);
}
