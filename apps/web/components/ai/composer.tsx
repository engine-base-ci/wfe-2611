"use client";
// 会話の入力欄（D-104.10〜D-104.14）。会話を出す場所は、どこもこの 1 つ（chat_one.mjs C3：textarea はここだけ）。
//   下に固定の大きな箱。上に文脈のチップ（× で外す）・添付・引用、下の列に ＋（資料・画像）・マイク・モデル・許可のモード・送る
//   Shift+Enter で改行、それ以外の Enter で送る（変換を確定する Enter では送らない。Safari は keyCode 229 も見る）
//   書きかけは会話ごとに残る／空の入力欄で ↑ は前に送った文／長すぎるときは残りを出す／長い文を貼ると添付にする
//   動いている間は送るが「止める」に変わり、書いたことは次の区切りで伝える（D-104.9）
//   / のコマンドは作らない（D-066.8 を改めた）。@ で タスク・人・AI社員 を指す
import { Check, ChevronDown, Eye, Mic, Paperclip, Plus, RefreshCw, Send, Shield, Square, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MAX_SAY, useBridge, type Agent, type Att } from "@/lib/agent";
import { agentConversationSet, type AgentContext, type Effort } from "@/lib/auth/ext";
import { toast } from "sonner";
import { ALL_ALLOWED, MODES } from "@/lib/agent-modes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/k";
import { cn } from "@/lib/cn";
import { useAnchoredPopover } from "@/components/ui/popover";
import { LaneWait, QueueBox } from "./work";

/** 並べるモデル（Claude のデスクトップと同じ単位＝版まで入ったモデル・2026-09-30 user「モデル単位になっている？」）。
 *  id は Claude Code の --model にそのまま渡す。本人のサブスクで使えないものを選ぶと、そこで止まって理由が出る */
/** 大きすぎて断られた資料は、置き直しても同じなので「もう一度送る」を出さない（E-LIM-002） */
const TOO_BIG = /大きすぎ/;
const MODELS: readonly { id: string; label: string }[] = [
  { id: "claude-opus-5-5", label: "Opus 5.5" },
  { id: "claude-fable-5-1", label: "Fable 5.1" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];
/** モデルの id を人の読む名前に（claude-opus-4-8 → Opus 4.8・opus → Opus） */
export function modelName(id: string | null | undefined): string {
  if (!id) return "";
  const known = MODELS.find((m) => m.id === id);
  if (known) return known.label;
  const m = /^(?:claude-)?([a-z]+)(?:-(\d+))?(?:-(\d{1,2}))?/i.exec(id);
  if (!m) return id;
  const fam = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1);
  return m[2] ? `${fam} ${m[2]}${m[3] ? `.${m[3]}` : ""}` : fam;
}
/** 考える強さ（Claude Code の --effort の段）。ボタンには短い名前（中・高）を出す */
const EFFORTS: readonly { id: Effort | null; label: string; short: string }[] = [
  { id: null, label: "PC の設定のまま", short: "既定" },
  { id: "low", label: "低", short: "低" },
  { id: "medium", label: "中", short: "中" },
  { id: "high", label: "高", short: "高" },
  { id: "xhigh", label: "最高", short: "最高" },
  { id: "max", label: "最大", short: "最大" },
];
/** これより長い文を貼ったら、入力欄に入れずに添付にする（D-104.11） */
const PASTE_AS_FILE = 4_000;
/** 残りの字数を出し始める長さ */
const COUNT_FROM = MAX_SAY - 2_000;

type Picker = "model" | "effort" | "perm" | "mention" | null;
interface Mention {
  kind: "task" | "person" | "staff";
  label: string;
  name: string;
}

const draftKey = (c: string | null) => `kaname.agent.draft.${c ?? "new"}`;
const readDraft = (c: string | null) => {
  try {
    return window.sessionStorage.getItem(draftKey(c)) ?? "";
  } catch {
    return "";
  }
};
const writeDraft = (c: string | null, v: string) => {
  try {
    if (v) window.sessionStorage.setItem(draftKey(c), v);
    else window.sessionStorage.removeItem(draftKey(c));
  } catch {
    /* 覚えられない窓 */
  }
};

/** ブラウザの音声認識（D-104.22）。使えないブラウザでは null（マイクを出さない） */
type Rec = {
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
};
function speechCtor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface ComposerProps {
  agent: Agent;
  /** 入力欄のすぐ上に浮かせるもの（いちばん下へ 等）。下に固定の入力欄に隠れない */
  above?: ReactNode;
  placeholder: string;
  compact?: boolean;
  /** 渡している文脈（今の画面・選んでいる 1 件）。チップで見せ、× で外せる（D-104.12） */
  context?: AgentContext;
  onSaid?: () => void;
  /** 引用して続ける（D-104.17）／直して送り直す（D-104.17：その時点から新しい会話） */
  quote?: { text: string; message_id: string | null } | null;
  onClearQuote?: () => void;
  edit?: { text: string; message_id: string } | null;
  onClearEdit?: () => void;
  /** 閲覧だけの人（聞くだけ）。モードの切り替えは出さない */
  askOnly?: boolean;
}

export function Composer({
  agent,
  above,
  placeholder,
  compact = false,
  context,
  onSaid,
  quote,
  onClearQuote,
  edit,
  onClearEdit,
  askOnly = false,
}: ComposerProps) {
  const conv = agent.conversationId;
  // この会話を記憶に使わない（D-104.1）：その会話だけに効くので入力欄の側に置く（2026-09-30 user「セッションの入力あたりに」）。
  // はじめの設定（聞き取り・たたき台）は会社を覚える場なので出さない。押したらすぐ印を変え、変えられなかったら戻す
  const qc = useQueryClient();
  const memShown = !!conv && !!agent.state?.conversation && !(context?.screen ?? "").startsWith("onboard");
  const [incLocal, setIncLocal] = useState<{ id: string; v: boolean } | null>(null);
  const incognito = conv && incLocal?.id === conv ? incLocal.v : !!agent.state?.conversation?.incognito;
  const setIncognito = async (v: boolean) => {
    if (!conv) return;
    setIncLocal({ id: conv, v });
    try {
      await agentConversationSet(conv, { incognito: v });
    } catch (e) {
      setIncLocal(null);
      toast(`切り替えられませんでした（${e instanceof Error ? e.message : "理由は分かりません"}）`);
    } finally {
      void qc.invalidateQueries({ queryKey: ["agent-conversations"] });
    }
  };
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [ctxOn, setCtxOn] = useState(true);
  const [picker, setPicker] = useState<Picker>(null);
  const agentRef = useRef(agent);
  agentRef.current = agent;
  // この PC の Claude Code がふだん使うモデル（何も選んでいないときにボタンへ出す）
  const { bridge } = useBridge(!askOnly);
  // 選ぶ箱（モデル・許可のしかた）は、外を押すか Esc で閉じる（Claude と同じ）。@ で指す箱は入力欄の中の動きで閉じる
  useEffect(() => {
    if (picker !== "model" && picker !== "effort" && picker !== "perm") return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setPicker(null);
        // モデルの箱は数字で選べる（Claude と同じ・1＝いちばん上）
        else if (picker === "model" && /^[1-9]$/.test(e.key) && !(e.target as HTMLElement).closest("textarea,input")) {
          const m = MODELS[Number(e.key) - 1];
          if (m) {
            agentRef.current.setPrefs({ model: m.id });
            setPicker(null);
          }
        }
        return;
      }
      if (!(e.target as HTMLElement).closest(".cpop, .cpick")) setPicker(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [picker]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [recOn, setRecOn] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const [mentionAt, setMentionAt] = useState(0);
  const histAt = useRef<number>(-1);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  // 選ぶ箱は入力欄の箱の上に、いちばん上の層で出す（右パネル等の枠に切られない・components/ui/popover.ts）
  const boxRef = useRef<HTMLDivElement | null>(null);
  const popEnd = useAnchoredPopover(boxRef, { side: "above", align: "end", inset: 8, gap: 6 });
  const popStart = useAnchoredPopover(boxRef, { side: "above", align: "start", inset: 8, gap: 6 });
  const file = useRef<HTMLInputElement | null>(null);
  const rec = useRef<Rec | null>(null);
  const speech = useMemo(() => speechCtor(), []);

  // 書きかけは会話ごとに残す。会話を切り替えた瞬間に、前の会話の書きかけを新しい会話の名前で書かない
  // 書きかけの持ち主（どの会話の書きかけか）。
  //   開いた直後（まだどの会話か分からない）と、まだ id の無い新しい会話で書き始めた文（声で入れた文も）は、会話の id が決まっても消さない。
  //   別の会話へ移ったときだけ、その会話の書きかけに入れ替える。入れ替えは会話が変わった瞬間にする（状態が届くのを待つと、その間に書いた文を消してしまう）
  const [draftFor, setDraftFor] = useState<string | null | undefined>(undefined);
  const known = agent.state !== null && agent.state !== undefined;
  useEffect(() => {
    if (draftFor === conv) return;
    if (draftFor === undefined && !known) return;
    const saved = readDraft(conv);
    const carry = draftFor === undefined || draftFor === null;
    setText((t) => (carry && t.trim() ? t : saved));
    setDraftFor(conv);
  }, [conv, draftFor, known]);
  useEffect(() => {
    if (draftFor === conv) writeDraft(conv, text);
  }, [conv, draftFor, text]);
  useEffect(() => {
    if (edit) {
      setText(edit.text);
      ta.current?.focus();
    }
  }, [edit]);
  useEffect(() => setCtxOn(true), [context?.screen, context?.selected]);
  // 書くほど縦に伸びる（上限は CSS の max-height）
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useEffect(() => {
    if (!recOn) return;
    const t = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recOn]);

  const mine = useMemo(
    () => (agent.state?.messages ?? []).filter((m) => m.who === "me").map((m) => m.text),
    [agent.state?.messages],
  );
  const uploading = atts.some((a) => !a.id && !a.error);
  // 置き場に置けなかった資料が残っている間は送らない（E-CHAT-002）。前は置けた分だけを添えて送り、置けなかった資料は一覧ごと消していた
  const attFailed = atts.some((a) => a.error);
  // 送っている途中でも送れる（順に送る）。資料を置いている間だけ待つ
  const sendable = !!text.trim() && !uploading && !attFailed && text.trim().length <= MAX_SAY;

  // 置き直すために、付けたファイルを手元に持っておく（送るか外すまで）
  const files = useRef(new Map<string, File>());
  const place = useCallback(
    async (key: string, f: File) => {
      setAtts((a) => a.map((x) => (x.key === key ? { ...x, id: null, error: null } : x)));
      const r = await agent.attach(f);
      setAtts((a) => a.map((x) => (x.key === key ? { ...r, key } : x)));
    },
    [agent],
  );
  const addFiles = useCallback(
    async (list: File[]) => {
      for (const f of list) {
        const key = `up-${f.name}-${Date.now().toString(36)}`;
        files.current.set(key, f);
        setAtts((a) => [...a, { key, name: f.name, size: f.size, id: null, error: null }]);
        await place(key, f);
      }
    },
    [place],
  );
  const dropAtt = useCallback((key: string) => {
    files.current.delete(key);
    setAtts((x) => x.filter((y) => y.key !== key));
  }, []);

  const submit = useCallback(async () => {
    if (!sendable) return;
    const t = text.trim();
    const ids = atts.filter((a) => a.id).map((a) => a.id!) as string[];
    setText("");
    histAt.current = -1;
    const ok = await agent.say(t, {
      ...(context && ctxOn ? { context } : {}),
      ...(ids.length ? { attachments: ids } : {}),
      ...(quote ? { quote } : {}),
      ...(edit ? { branch_from: edit.message_id } : {}),
    });
    if (ok) {
      files.current.clear();
      setAtts([]);
      onClearQuote?.();
      onClearEdit?.();
      onSaid?.();
    }
  }, [agent, atts, context, ctxOn, edit, onClearEdit, onClearQuote, onSaid, quote, sendable, text]);

  // @ で指す：タスク・人・AI社員（名前で探す）。目標と記憶は名前の口がまだ無いので出さない
  const mentionEnabled = mentionQ !== null;
  const tasks = useQuery({
    queryKey: ["mention", "tasks"],
    queryFn: () => api.list<{ id: string; title?: string }>("tasks", { limit: 200 }),
    enabled: mentionEnabled,
    staleTime: 60_000,
  });
  const members = useQuery({
    queryKey: ["mention", "members"],
    queryFn: () => api.list<{ id: string; display_name?: string; kind_id?: string }>("members", { limit: 200 }),
    enabled: mentionEnabled,
    staleTime: 60_000,
  });
  const candidates: Mention[] = useMemo(() => {
    if (mentionQ === null) return [];
    const q = mentionQ.toLowerCase();
    const all: Mention[] = [
      ...(tasks.data?.data ?? [])
        .filter((t) => t.title)
        .map((t) => ({ kind: "task" as const, label: "タスク", name: t.title! })),
      ...(members.data?.data ?? [])
        .filter((m) => m.display_name)
        .map((m) => ({
          kind: m.kind_id === "ai" ? ("staff" as const) : ("person" as const),
          label: m.kind_id === "ai" ? "AI社員" : "人",
          name: m.display_name!,
        })),
    ];
    return all.filter((m) => !q || m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQ, tasks.data, members.data]);
  const pickMention = (m: Mention) => {
    const el = ta.current;
    const pos = el?.selectionStart ?? text.length;
    const before = text.slice(0, pos).replace(/@[^\s@]*$/, "");
    const next = `${before}@${m.name}（${m.label}） ${text.slice(pos)}`;
    setText(next);
    setMentionQ(null);
    setPicker(null);
    requestAnimationFrame(() => el?.focus());
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 変換を確定する Enter では送らない（Safari は isComposing が先に false になるので keyCode 229 も見る）
    const composing = e.nativeEvent.isComposing || e.keyCode === 229;
    if (picker === "mention" && candidates.length && !composing) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setMentionAt((i) => (i + (e.key === "ArrowDown" ? 1 : candidates.length - 1)) % candidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(candidates[mentionAt] ?? candidates[0]!);
        return;
      }
    }
    if (e.key === "Escape") {
      setPicker(null);
      setMentionQ(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !composing) {
      e.preventDefault();
      void submit();
      return;
    }
    // 空の入力欄で ↑ は前に送った文（もう一度押すとさらに前）
    if (e.key === "ArrowUp" && !composing && (!text || histAt.current >= 0) && mine.length) {
      e.preventDefault();
      const i = Math.min(histAt.current + 1, mine.length - 1);
      histAt.current = i;
      setText(mine[mine.length - 1 - i] ?? "");
    }
  };
  const onChange = (v: string) => {
    setText(v);
    const pos = ta.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([^\s@]*)$/.exec(v.slice(0, pos));
    if (m) {
      setMentionQ(m[2] ?? "");
      setMentionAt(0);
      setPicker("mention");
    } else if (picker === "mention") {
      setMentionQ(null);
      setPicker(null);
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
      return;
    }
    const t = e.clipboardData.getData("text/plain");
    if (t.length > PASTE_AS_FILE) {
      // 長い文を貼ったら添付にする（入力欄を埋めない）
      e.preventDefault();
      void addFiles([
        new File([t], `貼り付けた文_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.txt`, {
          type: "text/plain",
        }),
      ]);
    }
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    void addFiles([...e.dataTransfer.files]);
  };

  const toggleVoice = () => {
    if (!speech) return;
    if (recOn) {
      rec.current?.stop();
      return;
    }
    const r = new speech();
    r.lang = "ja-JP";
    r.interimResults = true;
    r.continuous = true;
    const start = text;
    r.onresult = (ev) => {
      let s = "";
      for (let i = 0; i < ev.results.length; i++) s += ev.results[i]?.[0]?.transcript ?? "";
      setText(start ? `${start} ${s}` : s);
    };
    r.onend = () => {
      setRecOn(false);
      rec.current = null;
      ta.current?.focus();
    };
    r.onerror = () => setRecOn(false);
    rec.current = r;
    setRecSec(0);
    setRecOn(true);
    r.start();
  };

  const mode = MODES.find((m) => m.id === agent.prefs.mode) ?? MODES[0]!;
  const cliModel = bridge?.cli_model ?? null;
  const modelLabel = modelName(agent.prefs.model ?? cliModel) || "モデル";
  const effort = EFFORTS.find((m) => m.id === agent.prefs.effort) ?? EFFORTS[0]!;
  const running = agent.running;
  const len = text.trim().length;
  const ph = running ? "動いている間に書いたことは、次の区切りで伝えます" : placeholder;

  return (
    <div
      className={`composer${compact ? " compact" : ""}`}
      data-part="composer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {above ? <div className="cabove">{above}</div> : null}
      <LaneWait on={agent.state?.waiting_on ?? null} onOpen={(c) => agent.select(c)} />
      <QueueBox
        items={agent.state?.queued ?? []}
        onCancel={(q) => void agent.cancelQueued(q)}
        elsewhere={!!agent.state?.waiting_on}
      />
      {recOn ? (
        <div className="rec" role="status">
          <Mic />
          <span>
            聞いています {Math.floor(recSec / 60)}:{String(recSec % 60).padStart(2, "0")} ·
            話し終えたら止めると文字になります（直してから送れます）
          </span>
          <Button size="sm" variant="outline" icon={<Square />} onClick={toggleVoice}>
            止める
          </Button>
        </div>
      ) : null}
      <div className="cbox" ref={boxRef}>
        {picker === "mention" && candidates.length ? (
          <div className="cpop" role="listbox" aria-label="@ で指す" ref={popEnd}>
            {candidates.map((m, i) => (
              <div
                key={`${m.kind}-${m.name}-${i}`}
                role="option"
                aria-selected={i === mentionAt}
                className={i === mentionAt ? "on" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(m);
                }}
              >
                <b>{m.label}</b>
                <span>{m.name}</span>
              </div>
            ))}
          </div>
        ) : null}
        {picker === "model" ? (
          // Claude のデスクトップのモデルの箱と同じ：版まで入ったモデルの名前を 1 行で。選んでいるものにチェック、ほかは数字（押しても選べる）。
          // 何も選んでいなければ「PC の設定」の行（いま PC の Claude Code が使うモデル）にチェック
          <div className="cpop cmenu cmodel" role="listbox" aria-label="モデル" ref={popEnd}>
            {[
              { id: null as string | null, label: `PC の設定${cliModel ? `（${modelName(cliModel)}）` : ""}` },
              ...MODELS,
            ].map((m, i) => {
              const on = m.id === (agent.prefs.model ?? null);
              const pick = () => {
                agent.setPrefs({ model: m.id });
                setPicker(null);
              };
              return (
                <div
                  key={m.label}
                  role="option"
                  tabIndex={0}
                  aria-selected={on}
                  className={on ? "on" : ""}
                  onClick={pick}
                  onKeyDown={(e) => e.key === "Enter" && pick()}
                >
                  <b>{m.label}</b>
                  {on ? <Check aria-hidden="true" /> : i > 0 ? <kbd aria-hidden="true">{i}</kbd> : <i />}
                </div>
              );
            })}
          </div>
        ) : null}
        {picker === "effort" ? (
          <div className="cpop cmenu cmodel ceffort" role="listbox" aria-label="考える強さ" ref={popEnd}>
            {EFFORTS.map((x) => {
              const on = x.id === (agent.prefs.effort ?? null);
              const pick = () => {
                agent.setPrefs({ effort: x.id });
                setPicker(null);
              };
              return (
                <div
                  key={x.short}
                  role="option"
                  tabIndex={0}
                  aria-selected={on}
                  className={on ? "on" : ""}
                  onClick={pick}
                  onKeyDown={(e) => e.key === "Enter" && pick()}
                >
                  <b>{x.label}</b>
                  {on ? <Check aria-hidden="true" /> : <i />}
                </div>
              );
            })}
          </div>
        ) : null}
        {picker === "perm" ? (
          <div className="cpop cmenu left" role="listbox" aria-label="許可のモード" ref={popStart}>
            {confirmAll ? (
              <div className="danger" role="alert" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <b>全部許可にしますか</b>
                <span>
                  この会話だけ、自分のAI
                  は何も聞かずに進めます。外への送信・ファイルの削除も確かめません。銀行など自動操作が禁止のサービスは、これを選んでも止めます。
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      agent.setPrefs({ mode: ALL_ALLOWED });
                      setConfirmAll(false);
                      setPicker(null);
                    }}
                    data-confirm-all
                  >
                    全部許可にする
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmAll(false)}>
                    やめる
                  </Button>
                </span>
              </div>
            ) : (
              MODES.map((m) => (
                <div
                  key={m.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={m.id === agent.prefs.mode}
                  className={`${m.id === agent.prefs.mode ? "on" : ""}${m.id === ALL_ALLOWED ? " danger" : ""}`}
                  onClick={() =>
                    m.id === ALL_ALLOWED ? setConfirmAll(true) : (agent.setPrefs({ mode: m.id }), setPicker(null))
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (m.id === ALL_ALLOWED ? setConfirmAll(true) : (agent.setPrefs({ mode: m.id }), setPicker(null)))
                  }
                >
                  <b>{m.label}</b>
                  <span>{m.desc}</span>
                  {m.id === agent.prefs.mode ? <Check aria-hidden="true" /> : null}
                </div>
              ))
            )}
          </div>
        ) : null}
        {(context && ctxOn) || atts.length || quote || edit ? (
          <div className="cchips">
            {context && ctxOn ? (
              <span className="cchip ctx" title="自分のAIに添える文脈">
                <Eye />
                {context.screen_name ?? context.screen}
                {context.selected ? `：${context.selected}` : ""}
                <button type="button" title="外す" aria-label="文脈を外す" onClick={() => setCtxOn(false)}>
                  <X />
                </button>
              </span>
            ) : null}
            {quote ? (
              <span className="cchip" title="引用して続ける">
                「{quote.text.length > 40 ? `${quote.text.slice(0, 40)}…` : quote.text}」
                <button type="button" title="外す" aria-label="引用を外す" onClick={() => onClearQuote?.()}>
                  <X />
                </button>
              </span>
            ) : null}
            {edit ? (
              <span className="cchip" title="直して送り直す">
                直して送り直す（ここから新しい会話になります）
                <button
                  type="button"
                  title="やめる"
                  aria-label="直して送り直すのをやめる"
                  onClick={() => (onClearEdit?.(), setText(""))}
                >
                  <X />
                </button>
              </span>
            ) : null}
            {atts.map((a) => (
              <span
                className={cn("cchip att", a.error && "err")}
                key={a.key}
                data-att-state={a.error ? "error" : a.id ? "ok" : "up"}
                title={a.error ?? a.name}
              >
                <Paperclip />
                {a.name}
                {a.error ? "（置けませんでした）" : a.id ? "" : "（置いています…）"}
                {a.error && files.current.has(a.key) && !TOO_BIG.test(a.error) ? (
                  <button
                    type="button"
                    title="もう一度送る"
                    aria-label={`${a.name}をもう一度送る`}
                    onClick={() => void place(a.key, files.current.get(a.key)!)}
                    data-att-retry
                  >
                    <RefreshCw />
                  </button>
                ) : null}
                <button type="button" title="外す" aria-label={`${a.name}を外す`} onClick={() => dropAtt(a.key)}>
                  <X />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {attFailed ? (
          // 理由は返ってきたとおりに出す（保存先が応答しない・大きすぎる 等）。同じ理由は 1 回だけ
          <p className="catt-err" role="status" data-att-failed>
            {[...new Set(atts.filter((a) => a.error).map((a) => a.error!))].join(" ")}
          </p>
        ) : null}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          placeholder={ph}
          aria-label="自分のAIに書く"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onPaste={onPaste}
        />
        <div className="cbar2">
          <button
            type="button"
            className="cbtn"
            title="資料・画像を付ける"
            aria-label="資料・画像を付ける"
            onClick={() => file.current?.click()}
          >
            <Plus />
          </button>
          <input
            ref={file}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          {speech ? (
            <button
              type="button"
              className={`cbtn${recOn ? " on" : ""}`}
              title="声で入力"
              aria-label={recOn ? "声の入力を止める" : "声で入力"}
              aria-pressed={recOn}
              onClick={toggleVoice}
            >
              <Mic />
            </button>
          ) : null}
          {/* 許可のしかたは左（Claude のデスクトップと同じ並び） */}
          {askOnly ? null : (
            <button
              type="button"
              className={`cpick${picker === "perm" ? " open" : ""}${mode.id === ALL_ALLOWED ? " warn" : ""}`}
              aria-expanded={picker === "perm"}
              onClick={() => {
                setConfirmAll(false);
                setPicker(picker === "perm" ? null : "perm");
              }}
            >
              <Shield />
              {mode.label}
              <ChevronDown />
            </button>
          )}
          {memShown ? (
            <Checkbox
              size="sm"
              className={`cmem${incognito ? " on" : ""}`}
              title="オンにすると、自分のAIが毎朝まとめる記憶にこの会話を入れません"
              role="switch"
              aria-label="この会話を記憶に使わない"
              checked={incognito}
              onChange={(e) => void setIncognito(e.target.checked)}
              data-incognito
            >
              記憶に使わない
            </Checkbox>
          ) : null}
          <span className="csp" />
          {len > COUNT_FROM ? (
            <span className="ccount" role="status">
              {len > MAX_SAY
                ? `${(len - MAX_SAY).toLocaleString()} 字多い（分けるか資料で）`
                : `残り ${(MAX_SAY - len).toLocaleString()} 字`}
            </span>
          ) : null}
          {/* モデルと考える強さは右に別々の小さなボタン（Claude のデスクトップと同じ：Opus 5.5 ／ 中） */}
          <button
            type="button"
            className={`cpick${picker === "model" ? " open" : ""}`}
            aria-expanded={picker === "model"}
            aria-label={`モデル：${modelLabel}`}
            onClick={() => setPicker(picker === "model" ? null : "model")}
            data-model
          >
            {modelLabel}
          </button>
          <button
            type="button"
            className={`cpick${picker === "effort" ? " open" : ""}`}
            aria-expanded={picker === "effort"}
            aria-label={`考える強さ：${effort.label}`}
            title="考える強さ"
            onClick={() => setPicker(picker === "effort" ? null : "effort")}
            data-effort
          >
            {effort.short}
          </button>
          {running && !text.trim() ? (
            <button
              type="button"
              className="csend stop"
              title="止める"
              aria-label="止める"
              onClick={() => void agent.stop()}
              data-stop
            >
              <Square />
            </button>
          ) : (
            <button
              type="button"
              className="csend"
              title="送る（Enter）"
              aria-label="送る"
              disabled={!sendable}
              onClick={() => void submit()}
              data-send
            >
              <Send />
            </button>
          )}
        </div>
      </div>
      {memShown && incognito ? (
        <div className="cmem-note" role="status">
          この会話は、自分のAIが毎朝まとめる記憶に入れません
        </div>
      ) : null}
      {compact ? null : (
        <div className="chint">
          <span>
            <kbd>Shift</kbd>+<kbd>Enter</kbd> で改行
          </span>
          <span>
            <kbd>@</kbd> でタスク・人・AI社員を指す
          </span>
        </div>
      )}
    </div>
  );
}
