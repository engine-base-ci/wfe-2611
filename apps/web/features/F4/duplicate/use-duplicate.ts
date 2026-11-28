"use client";
// 複製の小窓の状態と送り方（K-446・A129・D-126.16・D-150.6・D-150.9）。題名・期限・写すもののチェック・手元の確かめの理由・
//   小窓の上の赤い箱の文・送っている間・期限の日付の小窓を持つ。小窓が開くたびに元の値へ戻し、冪等キーを作り直す（押し直しは同じキー）。
//   「複製して開く」：手元の確かめ（題名・期限）を通したら createTicket を 7 つの鍵だけで 1 回送り、201 で作った詳細へ移る（K-60 と同じ着地）。
//   断りの文：E-VAL-012・E-VAL-028 は期限の欄の下（赤い箱は出さない）／E-DUP-001 は「元のチケットが見つかりません」／
//   正本に番号があればその文を全部／無ければ 403 などはページ共通の番号の 1 文目・500 とつながらないは下絵の失敗の文。書いた中身は消さない
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { errorCodeOf, errorText } from "@/components/k/error-of";
import { SCOPES_KEY, ONCE, readScopes } from "@/features/F4/create-ticket/ticket-shell";
import { mmddWeek } from "@/features/F4/due/dates";
import type { DueDialogProps } from "@/features/F4/due/views";
import { call, type CallErr } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import type { CopyRow, DuplicateDialogProps } from "./views";

const SCREEN = "tickets";
const TITLE_MAX = 200;
const JST_MS = 9 * 3600_000;
export const SRC_GONE = "元のチケットが見つかりません";
export const FAILED_TEXT =
  "複製できませんでした。ネットがつながっていないか、Kaname が混み合っています。もう一度「複製して開く」を押してください";
const TITLE_EMPTY = "題名を入れてください";
const TITLE_LONG = `題名は ${TITLE_MAX} 文字までです`;
const DUE_EMPTY = "期限を入れてください";
/** 期限の欄の下に出す口の断り（欄なしの 409） */
const DUE_CODES = new Set(["E-VAL-012", "E-VAL-028"]);

/** 複製の元（getTicket の答えから作る） */
export interface DupSource {
  id: string;
  number: string;
  title: string;
  scope_id: string;
  kind_id: string;
  due_on: string | null;
  assignee_id: string | null;
  child_count: number;
}

/** 口の copy の名前（小窓の並びと 1 対 1・この順で送る。添付は無い・D-150.9） */
const COPY_KEYS = ["body", "assignee", "fields", "specs", "links", "children"] as const;
type CopyKey = (typeof COPY_KEYS)[number];
const ALL_ON: Record<CopyKey, boolean> = {
  body: true,
  assignee: true,
  fields: true,
  specs: true,
  links: true,
  children: true,
};

/** 今日（日本時間・YYYY-MM-DD）。小窓を開くたびに数える */
export const todayJst = (): string => new Date(Date.now() + JST_MS).toISOString().slice(0, 10);

const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const pastText = (): string => CATALOG["E-VAL-012"]?.message ?? "";

/** 期限の手元の確かめ（空・今日より前） */
const dueProblem = (due: string | null, today: string): string | undefined =>
  !due ? DUE_EMPTY : due < today ? pastText() : undefined;

function titleProblem(title: string): string | undefined {
  const t = title.trim();
  if (!t) return TITLE_EMPTY;
  return [...t].length > TITLE_MAX ? TITLE_LONG : undefined;
}

/** 口の断り → 小窓の上の赤い箱の文 */
export function noticeOf(r: CallErr | null): string {
  if (!r) return FAILED_TEXT;
  if (r.code === "E-DUP-001") return SRC_GONE;
  const entry = CATALOG[r.code];
  if (entry) return entry.message;
  if (r.kind === "forbidden" || r.kind === "not_found") return errorText(errorCodeOf(r)).title;
  return FAILED_TEXT;
}

function rowsOf(src: DupSource, checks: Record<CopyKey, boolean>): CopyRow[] {
  const noOwner = !src.assignee_id;
  return [
    {
      key: "body",
      label: "本文",
      checked: checks.body,
      note: "本文の中のチェックの箱は外して写します。日付や金額は、写したあとで直してください",
    },
    {
      key: "assignee",
      label: "担当者・承認する人",
      checked: noOwner ? false : checks.assignee,
      ...(noOwner ? { unavailable: "元に担当者がいません" } : {}),
    },
    { key: "fields", label: "項目（期限・優先度・会社の項目）", checked: checks.fields },
    { key: "specs", label: "確認項目", checked: checks.specs, note: "チェックは外して写します" },
    { key: "links", label: "つながり", checked: checks.links },
    { key: "children", label: `子チケット（${src.child_count} 件）`, checked: checks.children },
    { key: "files", label: "添付", checked: false, unavailable: "まだ使えません" },
  ];
}

interface DueState {
  open: boolean;
  month: string;
  selected: string | null;
  today: string;
}

export interface Duplicate {
  /** 小窓（DuplicateDialog）に渡す値。onClose は呼ぶ側が足す */
  dialog: Omit<DuplicateDialogProps, "onClose" | "children">;
  /** 重ねて開く日付の小窓（DueDialog）に渡す値 */
  due: DueDialogProps;
}

export function useDuplicate(src: DupSource, open: boolean, onDone: (id: string) => void): Duplicate {
  const [title, setTitle] = useState(src.title);
  const [dueOn, setDueOn] = useState<string | null>(src.due_on);
  const [dueChanged, setDueChanged] = useState(false);
  const [checks, setChecks] = useState<Record<CopyKey, boolean>>(ALL_ON);
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [dueError, setDueError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [dueDlg, setDueDlg] = useState<DueState>({ open: false, month: "", selected: null, today: "" });
  const key = useRef("");
  const sending = useRef(false);
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const scopes = useQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes(SCREEN), ...ONCE });

  useEffect(() => {
    if (!open) return;
    setTitle(src.title);
    setDueOn(src.due_on);
    setDueChanged(false);
    setChecks(ALL_ON);
    setTitleError(undefined);
    // 元の期限が過去なら、開いた時点で理由を出す（空は押したときに出す）
    setDueError(src.due_on && src.due_on < todayJst() ? pastText() : undefined);
    setNotice(undefined);
    setBusy(false);
    setDueDlg((d) => ({ ...d, open: false }));
    key.current = newKey();
  }, [open, src.id, src.title, src.due_on]);

  const scope = scopes.data?.rows.find((s) => s.id === src.scope_id);
  const groupName = scope ? (scope.ticket_prefix ? `${scope.name}（${scope.ticket_prefix}）` : scope.name) : "";
  const owner = src.assignee_id;

  const confirm = async () => {
    if (sending.current) return;
    const tErr = titleProblem(title);
    const dErr = dueProblem(dueOn, todayJst());
    setTitleError(tErr);
    setDueError(dErr);
    if (tErr || dErr || !dueOn) return;
    const copyOwner = checks.assignee && Boolean(owner);
    const assignee = copyOwner ? owner : (who.data?.member_id ?? null);
    if (!assignee) return setNotice(FAILED_TEXT);
    const copy = COPY_KEYS.filter((k) => (k === "assignee" ? copyOwner : checks[k]));
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("createTicket", {
        body: {
          scope_id: src.scope_id,
          kind_id: src.kind_id,
          title: title.trim(),
          assignee_member_id: assignee,
          due_on: dueOn,
          duplicate_of: src.id,
          copy,
        },
        idempotencyKey: key.current,
        screenId: SCREEN,
      }).catch(() => null);
      if (r?.ok) {
        setNotice(undefined);
        return onDone(String((r.data as { id: string }).id));
      }
      if (r && DUE_CODES.has(r.code)) {
        setNotice(undefined);
        return setDueError(CATALOG[r.code]?.message ?? pastText());
      }
      setNotice(noticeOf(r));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const openDue = () => {
    const today = todayJst();
    const keep = dueOn && dueOn >= today ? dueOn : null;
    setDueDlg({ open: true, today, month: (keep ?? today).slice(0, 7), selected: keep });
  };
  const closeDue = () => setDueDlg((d) => ({ ...d, open: false }));
  const pickDue = () => {
    if (!dueDlg.selected) return;
    setDueOn(dueDlg.selected);
    setDueChanged(true);
    setDueError(undefined);
    closeDue();
  };

  const dialog: Duplicate["dialog"] = {
    open,
    sourceNumber: src.number,
    title,
    groupName,
    dueLabel: dueOn ? mmddWeek(dueOn) : "日付を選ぶ",
    copies: rowsOf(src, checks),
    busy,
    dueChanged,
    onTitle: (v) => {
      setTitle(v);
      setTitleError(undefined);
    },
    onToggle: (k, on) => {
      if ((COPY_KEYS as readonly string[]).includes(k)) setChecks((c) => ({ ...c, [k]: on }));
    },
    onDue: openDue,
    onConfirm: () => void confirm(),
    ...(notice ? { notice } : {}),
    ...(titleError ? { titleError } : {}),
    ...(dueError ? { dueError } : {}),
  };
  const due: DueDialogProps = {
    open: open && dueDlg.open,
    mode: "create",
    today: dueDlg.today || todayJst(),
    month: dueDlg.month || todayJst().slice(0, 7),
    selected: dueDlg.selected,
    onPick: (ymd) => setDueDlg((d) => ({ ...d, selected: ymd })),
    onMonth: (m) => setDueDlg((d) => ({ ...d, month: m })),
    onClose: closeDue,
    onConfirm: pickDue,
  };
  return { dialog, due };
}
