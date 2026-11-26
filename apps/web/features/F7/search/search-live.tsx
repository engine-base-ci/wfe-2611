"use client";
// 探す箱に本物の値と動きをつなぐ（K-471）。差し込み口（search-slot.tsx）が開いている間だけ置く（閉じると打った字・札・選んだ行を捨てる）。
//   広い幅：箱の入力 1 つに打つ（開いたときと、開いている間に帯の探す欄へ焦点が来たときは、箱の入力へ焦点を渡す）。↑↓ Enter Esc は箱の入力が受ける。
//     箱の外（箱と帯の探す欄の外）を押すと閉じるだけ（続く click は止めて後ろへ通さない）。Esc で閉じたときの焦点は本文（帯の探す欄へ戻すと焦点で開き直すため）。
//   幅 767 以下：打つのは帯の欄（Shell の仕組み）。↑↓ Enter は帯の欄のキー（onSearchKeyDown）から届く。閉じるのは帯の × と Esc（Shell）。
//   日本語の変換中の Enter・Esc は何もしない（変換をやめるためのキー）
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { SearchPanel } from "./search-panel";
import { groupsOf } from "./search-hit-view";
import type { SearchHitView, SearchKind, SearchStatus } from "./search-types";
import { SEARCH_MAX_CHARS, queryOf, useSearch } from "./use-search";

/** 差し込み口が帯の欄のキーと Enter（探す）を箱へ渡す口 */
export interface SearchLiveApi {
  onKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  openActive: () => void;
}

export interface SearchLiveProps {
  query: string;
  onQuery: (q: string) => void;
  /** 閉じる（how：esc＝Esc・open＝行を開いた・outside＝外を押した） */
  onClose: (how: "esc" | "open" | "outside") => void;
  /** 開いている間に帯の探す欄へ焦点が来た回数（増えたら箱の入力へ焦点を渡す） */
  focusTick: number;
  apiRef: MutableRefObject<SearchLiveApi | null>;
}

/** 767 以下か（Shell と同じ区切り） */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** 箱の入力は中身 100 字まで（全角も 1 字）。前の空白は数えない（口へは前後の空白を取って送る） */
export function clampQuery(v: string): string {
  const lead = /^\s*/.exec(v)?.[0] ?? "";
  const body = v.slice(lead.length);
  return body.trim().length <= SEARCH_MAX_CHARS ? v : lead + body.slice(0, SEARCH_MAX_CHARS);
}

const composing = (e: KeyboardEvent<HTMLInputElement>): boolean => e.nativeEvent.isComposing || e.keyCode === 229;

/** 外を押して閉じた後に続く click を 1 回だけ止める（閉じるだけにして、幕の後ろのボタン・リンクへ押下を通さない）。
 *   押したまま動かして click が来なかったときは、次の押し始めで止めるのをやめる（後の別の押下を食べない） */
function swallowNextClick(): void {
  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    done();
  };
  const done = () => {
    document.removeEventListener("click", stop, true);
    document.removeEventListener("pointerdown", done, true);
  };
  document.addEventListener("click", stop, true);
  // いま配っている押し始めには効かない（配っている間に足した聞き手は呼ばれない）。次の押し始めから効く
  document.addEventListener("pointerdown", done, true);
}

export default function SearchLive({ query, onQuery, onClose, focusTick, apiRef }: SearchLiveProps) {
  const router = useRouter();
  const narrow = useNarrow();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SearchKind>("all");
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const read = useSearch(query);

  const all = useMemo(() => (read.hits ? groupsOf(read.hits) : []), [read.hits]);
  const groups = kind === "all" ? all : all.filter((g) => g.kind === kind);
  const flat: SearchHitView[] = groups.flatMap((g) => g.hits);
  const status: SearchStatus =
    query.trim() === "" || read.q === ""
      ? "start"
      : read.failed && !read.hits
        ? "failed"
        : !read.hits
          ? "loading"
          : read.hits.length === 0
            ? "empty"
            : "ready";
  // 打ち足してから口へ送るまで（口へ送った字が今の字と違う間）は、前の字の行を見せるだけで開く・選ぶ動きを止める（いまの字の答えだけを出す）
  const current = read.q === queryOf(query);
  const active = status === "ready" && current ? (flat.find((h) => h.id === activeId) ?? flat[0]) : undefined;

  // 広い幅：開いたとき・開いている間に帯の欄へ焦点が来たとき、箱の入力へ焦点を渡す
  useEffect(() => {
    if (!narrow) inputRef.current?.focus();
  }, [narrow, focusTick]);

  // 広い幅：箱と帯の探す欄の外を押すと閉じる
  useEffect(() => {
    if (narrow) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("section.k-f7-search") || t.closest("form.k-search")) return;
      swallowNextClick();
      onClose("outside");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [narrow, onClose]);

  const openHit = (hit: SearchHitView | undefined) => {
    if (!hit?.href) return;
    router.push(hit.href);
    onClose("open");
  };
  const move = (step: 1 | -1) => {
    if (!active) return;
    const i = flat.findIndex((h) => h.id === active.id);
    const next = flat[Math.min(flat.length - 1, Math.max(0, i + step))];
    if (next) setActiveId(next.id);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (composing(e)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openHit(active);
    } else if (e.key === "Escape" && !narrow) {
      e.preventDefault();
      onClose("esc");
    }
  };
  useEffect(() => {
    apiRef.current = { onKey, openActive: () => openHit(active) };
  });
  useEffect(
    () => () => {
      apiRef.current = null;
    },
    [apiRef],
  );

  return (
    <SearchPanel
      query={query}
      onQuery={(v) => onQuery(clampQuery(v))}
      kind={kind}
      onKind={(k) => {
        setKind(k);
        setActiveId(undefined);
      }}
      groups={groups}
      status={status}
      activeId={active?.id}
      placement="overlay"
      inputRef={inputRef}
      onInputKeyDown={onKey}
      onOpen={() => onClose("open")}
      onRetry={read.retry}
    />
  );
}
