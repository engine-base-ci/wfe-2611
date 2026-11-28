"use client";
// ガントの画面（K-482・一覧の差し込み口 GanttSlot の中身）。棒の読み（use-gantt-data）・棒を動かす確かめ（use-move-bars）・
//   開始・期限が無いもの（nodate-panel・set-due-dialog）・保留の出し方（hold-hint・getTicket は行ごとに最初の 1 回だけ）をつなぐ。
//   スマホ（767 以下）は口を読まず、部品の案内だけ（GanttChart を空の行で出し、部品の CSS が案内だけを見せる）。
//   最初に開いたとき棒も期限なしも 0 件なら、チャートを出さず空の案内。棒の口が落ちたら E-PAGE-007 と「もう一度」
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState, Loading } from "@/components/k";
import { call } from "@/lib/api/call";
import { jstToday } from "../due/due-dates";
import { ViewEmpty } from "../overview/view-empty";
import { useListNames } from "../saved/use-list-names";
import { GanttChart, type GanttMove, type GanttRow, type GanttScale } from "./gantt-chart";
import { HoldHint } from "./hold-hint";
import { MoveImpactDialog } from "./move-impact-dialog";
import { NoDatePanel, type NoDateRow } from "./nodate-panel";
import { SetDueDialog } from "./set-due-dialog";
import { rangeOf, useGanttData, type Range, type Row } from "./use-gantt-data";
import { NO_FOLLOW, daysBetween, useMoveBars, type MoveRow } from "./use-move-bars";

const PHONE = "(max-width: 767px)";
const FOLLOW_LABEL = "あとに続くものも動かす";
const HOLD_FAILED = "読み込めませんでした";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nameOf = (v: unknown): string => (v && typeof v === "object" ? str((v as Row)["name"]) : "");
const keyOf = (v: unknown): string => (v && typeof v === "object" ? str((v as Row)["key"]) : "");
const ownerOf = (r: Row): string => {
  const a = r["assignee"];
  return a && typeof a === "object" ? str((a as Row)["display_name"]) : "";
};
const localDate = (ymd: string): Date =>
  new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));

/** スマホか（読む前は null） */
function usePhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/** 範囲に掛かる行（期限が最初の日以後で、開始（無ければ期限）が最後の日以前） */
export function inRange(items: readonly Row[], range: Range): Row[] {
  return items.filter((r) => {
    const due = str(r["due_on"]);
    if (!due) return false;
    const start = str(r["start_on"]) || due;
    return due >= range.from && start <= range.to;
  });
}

/** 行 → 棒の値。親の下に子（親は読んだ行の中にあるときだけ。子を持つ行は「【親】題名」の細い帯） */
export function rowsOf(items: readonly Row[]): GanttRow[] {
  const ids = new Set(items.map((r) => str(r["id"])));
  const parentOf = (r: Row): string => {
    const p = str(r["parent_ticket_id"]);
    return p && ids.has(p) ? p : "";
  };
  const kids = new Map<string, Row[]>();
  for (const r of items) {
    const p = parentOf(r);
    if (p) kids.set(p, [...(kids.get(p) ?? []), r]);
  }
  const out: GanttRow[] = [];
  const walk = (r: Row) => {
    const id = str(r["id"]);
    const due = str(r["due_on"]);
    const start = str(r["start_on"]) || due;
    const parent = (kids.get(id) ?? []).length > 0;
    const p = parentOf(r);
    out.push({
      id,
      number: str(r["number"]),
      title: parent ? `【親】${str(r["title"])}` : `${str(r["number"])} ${str(r["title"])}`,
      owner: ownerOf(r),
      stage: nameOf(r["stage"]),
      kind: parent ? "parent" : "task",
      ...(p ? { parentId: p } : {}),
      start: localDate(start),
      end: localDate(due),
      late: r["overdue"] === true,
    });
    for (const k of kids.get(id) ?? []) walk(k);
  };
  for (const r of items) if (!parentOf(r)) walk(r);
  return out;
}

interface HoldInfo {
  reason: string;
  resume: string;
  at: string | null;
}

export function GanttView({ scopeId }: { scopeId: string | null }) {
  const phone = usePhone();
  const today = jstToday(new Date());
  const [scale, setScale] = useState<GanttScale>("day");
  const [offset, setOffset] = useState(0);
  const [assignee, setAssignee] = useState("");
  const [trayOpen, setTrayOpen] = useState(false);
  const [setDue, setSetDue] = useState<NoDateRow | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [holds, setHolds] = useState<ReadonlyMap<string, HoldInfo>>(new Map());
  /** 日を入れた行（棒の口の答えに入るまで、その日の棒として出す） */
  const [placed, setPlaced] = useState<ReadonlyMap<string, Row>>(new Map());
  const asked = useRef(new Set<string>());
  const everHad = useRef(false);
  const range = useMemo(() => rangeOf(scale, today, offset), [scale, today, offset]);
  const data = useGanttData({ scopeId, range, assignee, enabled: phone === false });
  const { people } = useListNames(phone === false);
  const moves = useMoveBars({ onMoved: data.reload });

  const items = useMemo(() => {
    const got = new Set(data.rows.map((r) => str(r["id"])));
    return inRange([...data.rows, ...[...placed.values()].filter((r) => !got.has(str(r["id"])))], range);
  }, [data.rows, placed, range]);
  const byId = useMemo(
    () => new Map(data.rows.concat([...placed.values()]).map((r) => [str(r["id"]), r])),
    [data.rows, placed],
  );
  const rows = useMemo(() => rowsOf(items), [items]);
  if (data.rows.length > 0 || data.none.rows.length > 0) everHad.current = true;

  const parentDue = useCallback(
    (r: Row): { number: string; due: string | null } | null => {
      const p = byId.get(str(r["parent_ticket_id"]));
      return p ? { number: str(p["number"]), due: str(p["due_on"]) || null } : null;
    },
    [byId],
  );

  const onMove = useCallback(
    (id: string, move: GanttMove) => {
      const r = byId.get(id);
      if (!r) return;
      const row: MoveRow = {
        id,
        number: str(r["number"]),
        title: str(r["title"]),
        owner: ownerOf(r),
        start: str(r["start_on"]) || null,
        due: str(r["due_on"]),
        parent: parentDue(r),
      };
      moves.openMove(row, move, scale);
    },
    [byId, parentDue, moves, scale],
  );

  const onHoverBar = useCallback(
    (id: string | null) => {
      const r = id ? byId.get(id) : undefined;
      if (!id || !r || keyOf(r["stage"]) !== "hold") {
        setHoverId(null);
        return;
      }
      setHoverId(id);
      if (asked.current.has(id)) return;
      asked.current.add(id);
      const keep = (h: HoldInfo) => setHolds((m) => new Map(m).set(id, h));
      call("getTicket", { params: { id }, screenId: "tickets" })
        .then((res) => {
          const h = res.ok && res.data.hold && typeof res.data.hold === "object" ? (res.data.hold as Row) : null;
          keep(
            h
              ? { reason: str(h["reason"]), resume: str(h["resume"]), at: str(h["at"]) || null }
              : { reason: HOLD_FAILED, resume: "", at: null },
          );
        })
        .catch(() => keep({ reason: HOLD_FAILED, resume: "", at: null }));
    },
    [byId],
  );

  const onSetDone = useCallback(
    (id: string, day: string | null) => {
      const r = data.none.rows.find((x) => str(x["id"]) === id);
      if (r && day) setPlaced((m) => new Map(m).set(id, { ...r, due_on: day, start_on: null }));
      data.dropNone(id);
      setSetDue(null);
      data.reload();
    },
    [data],
  );

  if (phone === null) return null;
  const chartProps = {
    scale,
    range: { start: localDate(range.from), end: localDate(range.to) },
    today: localDate(today),
    groupBy: "親子" as const,
    assignee,
    people,
    noDateCount: data.none.rows.length,
    noDateMore: data.none.more,
  };
  if (phone) return <GanttChart {...chartProps} rows={[]} />;
  if (data.state === "error")
    return (
      <div className="k-list-body">
        <ErrorState code={data.code} acts={[data.retry]} />
      </div>
    );
  if (data.state === "loading" || data.none.state === "loading")
    return (
      <div className="k-list-body">
        <Loading />
      </div>
    );
  if (!everHad.current)
    return (
      <div className="k-list-body">
        <ViewEmpty view="gantt" />
      </div>
    );

  const hold = hoverId ? holds.get(hoverId) : undefined;
  const holdRow = hoverId ? byId.get(hoverId) : undefined;
  const dlg = moves.dialog;
  const dueTarget = setDue
    ? (byId.get(setDue.id) ?? data.none.rows.find((x) => str(x["id"]) === setDue.id))
    : undefined;
  const dueParent = dueTarget ? parentDue(dueTarget) : null;
  return (
    <>
      <GanttChart
        {...chartProps}
        rows={rows}
        readonly={false}
        noDateOpen={trayOpen}
        tray={<NoDatePanel rows={data.none.rows.map(noDateOf)} more={data.none.more} onSetDue={setSetDue} />}
        {...(hold && holdRow
          ? {
              hint: (
                <HoldHint
                  number={str(holdRow["number"])}
                  title={str(holdRow["title"])}
                  reason={hold.reason}
                  resume={hold.resume}
                  since={hold.at ? `保留から ${daysBetween(jstToday(new Date(hold.at)), today)} 日` : ""}
                />
              ),
            }
          : {})}
        onMove={onMove}
        onScale={(s) => {
          setScale(s);
          setOffset(0);
        }}
        onPrev={() => setOffset((n) => n - 1)}
        onNext={() => setOffset((n) => n + 1)}
        onToday={() => setOffset(0)}
        onAssignee={setAssignee}
        onNoDateToggle={() => setTrayOpen((o) => !o)}
        onNoDateEscape={() => {
          if (setDue) return false;
          setTrayOpen(false);
          return true;
        }}
        onHoverBar={onHoverBar}
      />
      {dlg ? (
        <MoveImpactDialog
          open
          ticket={dlg.ticket}
          from={dlg.from}
          to={dlg.to}
          shift={dlg.shift}
          {...(dlg.parent ? { parent: dlg.parent } : {})}
          followers={[{ text: NO_FOLLOW }]}
          followLabel={FOLLOW_LABEL}
          followNote=""
          followChecked={false}
          weekend={dlg.weekend}
          owner={dlg.owner}
          reason={dlg.reason}
          reasonError={dlg.reasonError}
          notice={dlg.notice}
          busy={dlg.busy}
          confirmDate={dlg.confirmDate}
          onReason={moves.onReason}
          onWeekend={moves.onWeekend}
          onConfirm={moves.submit}
          onCancel={moves.cancel}
        />
      ) : null}
      {setDue ? (
        <SetDueDialog
          ticket={setDue}
          parent={dueParent && dueParent.due ? { number: dueParent.number, due: dueParent.due } : null}
          onClose={() => setSetDue(null)}
          onDone={onSetDone}
        />
      ) : null}
    </>
  );
}

const noDateOf = (r: Row): NoDateRow => ({ id: str(r["id"]), number: str(r["number"]), title: str(r["title"]) });
