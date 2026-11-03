"use client";
// 会話の一覧（D-104.1）：Claude と同じ。探す（名前も中身も）・星を付けて上に置く・名前を直す・消す。記憶に使わない会話には札を付ける（切り替えは入力欄の側・composer.tsx）。
// 見ていない間に来た返事は印と件数（D-104.18）。押すとその会話に戻って続きを話せる（1 会話＝PC の Claude の 1 セッション）
// 見た目は左パネルの一覧の共通の部品（.tlist・shell.css／モック 06_mockup/_threadlist.py）。手本は assistant-ui の ThreadList・Vercel ai-chatbot・LibreChat
// （1 行 32px・14px・1 行で省略・行の間 2px・日付の見出し 11px・操作は「…」にまとめて、乗せた行と開いている行だけに出す。2026-09-30 user「一つひとつ大きい」）
import { MoreHorizontal, Pencil, Search, SquarePen, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  agentConversationDelete,
  agentConversationSet,
  agentConversations,
  type ConversationItem,
} from "@/lib/auth/ext";
import type { Agent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import { confirmDialog } from "@/components/ui/confirm";
import { useAnchoredPopover } from "@/components/ui/popover";

/** 探す語と本文をそろえる（全角／半角・NFD・ハイフンの種類・空白・大文字小文字）。サーバーの app.search_norm と同じ規則 */
export function searchNorm(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/([0-9A-Za-z])ー(?=[0-9A-Za-z])/g, "$1-") // 英数字にはさまれた長音はハイフン（カタカナの長音は変えない）
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** 見つかった中身を、書式の印を外して見つけた語のまわりだけにする */
export function snippet(hit: string, q: string, around = 10): string {
  const plain = searchNorm(
    hit
      .replace(/<[^>]+>/g, "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*_`~>|[\]()]/g, ""),
  ).trim();
  q = searchNorm(q).trim();
  const i = q ? plain.indexOf(q) : -1;
  if (i < 0) return plain.slice(0, around * 2);
  const s = Math.max(0, i - around);
  return `${s > 0 ? "…" : ""}${plain.slice(s, i + q.length + around)}${i + q.length + around < plain.length ? "…" : ""}`;
}

/** 日付の見出し（星 → 今日 → 昨日 → この 7 日 → それより前）。探しているときは見出しを付けない */
export function groupOf(c: Pick<ConversationItem, "starred" | "updated_at">, now = new Date()): string {
  if (c.starred) return "星";
  const d = new Date(c.updated_at);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  return diff <= 0 ? "今日" : diff === 1 ? "昨日" : diff < 7 ? "この 7 日" : "それより前";
}
const GROUP_ORDER = ["星", "今日", "昨日", "この 7 日", "それより前"];

export function ConversationList({ agent }: { agent: Agent }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  // 「…」の箱は一覧の枠に切られないよう、いちばん上の層に出す（components/ui/popover.ts）
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useAnchoredPopover(moreRef, { side: "below", align: "end" });
  const list = useQuery({
    queryKey: ["agent-conversations", q],
    queryFn: () => agentConversations(q.trim() || undefined),
    refetchInterval: 10_000,
  });
  // メニューは外を押すか Esc で閉じる
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest("[data-conv-menu]"))
        setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);
  const reload = () => void qc.invalidateQueries({ queryKey: ["agent-conversations"] });
  const act = async (f: () => Promise<unknown>, fail: string) => {
    setMenu(null);
    try {
      await f();
    } catch (e) {
      toast(`${fail}（${e instanceof Error ? e.message : "理由は分かりません"}）`);
    } finally {
      reload();
    }
  };
  const items = list.data ?? [];
  const current = agent.conversationId;
  const searching = q.trim() !== "";
  const row = (c: ConversationItem) => {
    const on = c.id === current;
    const unread = c.unread > 0 && !on;
    if (renaming === c.id)
      return (
        <li key={c.id} className="tl-item on" data-conversation={c.id}>
          <form
            className="tl-rename"
            onSubmit={(e) => {
              e.preventDefault();
              const t = name.trim();
              if (t) void act(() => agentConversationSet(c.id, { title: t }), "名前を直せませんでした");
              setRenaming(null);
            }}
          >
            <input
              value={name}
              aria-label="会話の名前"
              maxLength={80}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
              onBlur={() => setRenaming(null)}
            />
            <button type="submit" hidden>
              決める
            </button>
          </form>
        </li>
      );
    return (
      <li key={c.id} className={cn("tl-item", on && "on", c.hit && "hit")} data-conversation={c.id}>
        <button
          type="button"
          className="tl-open"
          onClick={() => agent.select(c.id)}
          aria-current={on ? "page" : undefined}
          aria-label={`${c.title}${c.starred ? "（星）" : ""}${c.incognito ? "（記憶に使わない）" : ""}${unread ? `（新しい返事 ${c.unread}）` : ""}`}
          title={c.title}
        >
          <span className="tl-t">
            <span className="tl-name">{c.title}</span>
            {c.incognito ? (
              <span className="tl-tag" title="記憶に使わない会話">
                記憶なし
              </span>
            ) : null}
          </span>
          {c.hit ? <span className="tl-hit">{snippet(c.hit, q.trim())}</span> : null}
        </button>
        {unread ? (
          <span className="tl-unread" aria-label={`新しい返事 ${c.unread}`}>
            {c.unread}
          </span>
        ) : null}
        <button
          type="button"
          className="tl-more"
          aria-label="この会話の操作"
          aria-haspopup="menu"
          aria-expanded={menu === c.id}
          data-conv-menu
          ref={menu === c.id ? moreRef : undefined}
          onClick={() => setMenu(menu === c.id ? null : c.id)}
        >
          <MoreHorizontal />
        </button>
        {menu === c.id ? (
          <div className="tl-menu" role="menu" data-conv-menu ref={menuRef}>
            <button
              type="button"
              role="menuitem"
              aria-label={c.starred ? "星を外す" : "星を付ける"}
              onClick={() =>
                void act(() => agentConversationSet(c.id, { starred: !c.starred }), "星を付けられませんでした")
              }
            >
              <Star />
              {c.starred ? "星を外す" : "星を付けて上に置く"}
            </button>
            <button
              type="button"
              role="menuitem"
              aria-label="名前を直す"
              onClick={() => (setMenu(null), setRenaming(c.id), setName(c.title))}
            >
              <Pencil />
              名前を直す
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              aria-label="消す"
              onClick={async () => {
                setMenu(null);
                const ok = await confirmDialog({
                  title: `「${c.title}」を消しますか`,
                  body: "消すと一覧から無くなり、この会話の続きは話せません。",
                  ok: "消す",
                  danger: true,
                });
                if (!ok) return;
                void act(async () => {
                  await agentConversationDelete(c.id);
                  if (c.id === current) agent.select(null);
                }, "消せませんでした");
              }}
            >
              <Trash2 />
              消す
            </button>
          </div>
        ) : null}
      </li>
    );
  };
  // 見出しごとに並べる（探しているときは当たった順のまま 1 つ）
  const groups = searching
    ? [{ label: null as string | null, rows: items }]
    : GROUP_ORDER.map((label) => ({
        label: label as string | null,
        rows: items.filter((c) => groupOf(c) === label),
      })).filter((g) => g.rows.length);
  return (
    <nav aria-label="会話の一覧" className="tlist" data-part="conversation-list">
      {/* 探す欄と「新しく話す」（アイコンだけ・乗せると名前が出る・2026-09-30 user「文章なくてもアイコンでわかる」） */}
      <div className="tl-top">
        <label className="tl-search">
          <Search />
          <input
            placeholder="会話を探す（中身も）"
            aria-label="会話を探す"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="tl-new"
          title="新しく話す"
          aria-label="新しく話す"
          onClick={() => void agent.startNew()}
          data-new-conversation
        >
          <SquarePen />
        </button>
      </div>
      {list.isPending ? (
        <p className="tl-empty">読んでいます</p>
      ) : items.length ? (
        groups.map((g) => (
          <div key={g.label ?? "hit"} className="tl-sec">
            {g.label ? <div className="tl-grp">{g.label}</div> : null}
            <ul>{g.rows.map(row)}</ul>
          </div>
        ))
      ) : (
        <p className="tl-empty">{searching ? "見つかりません" : "まだ会話はありません"}</p>
      )}
    </nav>
  );
}
