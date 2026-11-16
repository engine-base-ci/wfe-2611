"use client";
// 親のチケット（K-224・D-128.152・D-128.157）。打った字で一覧の口（K-92）を q と view=all で引き、候補から選ぶ。
//   打ち終わってから 300ms 待って 1 回だけ引く（打つたびに口を呼ばない・G-16）。入力は 100 字まで（口の q の上限）
//   3 段目のチケットの下には作れないので、depth が 3 の候補は選べない（aria-disabled）
//   口が落ちたら（500・429 など）欄の下に「候補を読み込めませんでした」。親なしで作れる。0 件は「見つかりません」
//   下書きから戻した親は詳細の口で引き、番号と題名で欄に出す
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/k";
import { call } from "@/lib/api/call";

const WAIT_MS = 300;
const Q_MAX = 100;
const MAX_DEPTH = 3;
const LIMIT = 20;

interface Candidate {
  id: string;
  number: string;
  title: string;
  depth: number;
}
type Found = { kind: "idle" } | { kind: "ok"; rows: Candidate[] } | { kind: "failed" };

const labelOf = (c: { number: string; title: string }): string => `${c.number} ${c.title}`;
const cut = (s: string): string => [...s].slice(0, Q_MAX).join("");

export function ParentPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);
  /** 欄に出している親（選んだ・戻した）の id。打ち直したら外す */
  const shownFor = useRef<string | null>(null);

  // 下書きから戻した親：詳細の口で番号と題名を引いて欄に出す
  useEffect(() => {
    if (!value || shownFor.current === value) return;
    let alive = true;
    void call("getTicket", { params: { id: value }, screenId: "tickets" }).then((r) => {
      if (!alive || !r.ok) return;
      const t = (r.data as { ticket?: { number?: string; title?: string } }).ticket;
      if (!t?.number) return;
      shownFor.current = value;
      setText(labelOf({ number: t.number, title: t.title ?? "" }));
    });
    return () => {
      alive = false;
    };
  }, [value]);

  // 打ち終わってから 1 回だけ引く
  useEffect(() => {
    if (shownFor.current && shownFor.current === value) return;
    const q = text.trim();
    if (!q) {
      setFound({ kind: "idle" });
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      void call("listTickets", { query: { q, view: "all", limit: LIMIT }, screenId: "tickets" })
        .catch(() => null)
        .then((r) => {
          if (mine !== seq.current) return; // 後から打った字の答えを優先する
          if (!r || !r.ok) return setFound({ kind: "failed" });
          const rows = (r.data as unknown as Partial<Candidate>[]).map((x) => ({
            id: String(x.id),
            number: String(x.number ?? ""),
            title: String(x.title ?? ""),
            depth: Number(x.depth ?? 1),
          }));
          setFound({ kind: "ok", rows });
          setActive(-1);
          setOpen(true);
        });
    }, WAIT_MS);
    return () => clearTimeout(t);
  }, [text, value]);

  const pick = (c: Candidate) => {
    if (c.depth >= MAX_DEPTH) return;
    shownFor.current = c.id;
    setText(labelOf(c));
    setOpen(false);
    setFound({ kind: "idle" });
    onChange(c.id);
  };
  const clear = () => {
    shownFor.current = null;
    seq.current++;
    setText("");
    setFound({ kind: "idle" });
    setOpen(false);
    onChange(null);
  };

  const rows = found.kind === "ok" ? found.rows : [];
  const listOpen = open && found.kind === "ok";
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // 欄の Enter で作る面を送らない
      const c = rows[active];
      if (listOpen && c) pick(c);
      return;
    }
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!rows.length) return;
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + rows.length) % rows.length);
    }
  };

  return (
    <div className="k-create-assign-row">
      <div className="k-field">
        <label className="k-label" htmlFor={`${id}-in`}>
          親のチケット
        </label>
        <div className="k-create-parent">
          <input
            id={`${id}-in`}
            className="k-input"
            role="combobox"
            name="parent_ticket"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={`${id}-list`}
            {...(listOpen && active >= 0 ? { "aria-activedescendant": `${id}-o${active}` } : {})}
            maxLength={Q_MAX}
            placeholder="番号か題名で探す"
            value={text}
            onChange={(e) => {
              shownFor.current = null;
              if (value) onChange(null); // 打ち直したら選んでいた親は外す
              setText(cut(e.target.value));
            }}
            onKeyDown={onKey}
            onBlur={() => setOpen(false)}
            onFocus={() => found.kind === "ok" && setOpen(true)}
          />
          {listOpen ? (
            <ul id={`${id}-list`} className="k-create-options" role="listbox" aria-label="親の候補">
              {rows.length === 0 ? <li role="status">見つかりません</li> : null}
              {rows.map((c, i) => (
                <li
                  key={c.id}
                  id={`${id}-o${i}`}
                  role="option"
                  aria-selected={i === active}
                  {...(c.depth >= MAX_DEPTH
                    ? { "aria-disabled": true, title: "3 段目のチケットの下には作れません" }
                    : {})}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                >
                  {labelOf(c)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {found.kind === "failed" ? <span className="k-err">候補を読み込めませんでした</span> : null}
      </div>
      {value ? (
        <Button variant="ghost" size="sm" onClick={clear}>
          親を外す
        </Button>
      ) : null}
    </div>
  );
}
