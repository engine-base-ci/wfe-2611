"use client";
// 親を決める欄（K-443・A103）。作る面の ParentField（見出しの上の入口と項目の表の「親」の行の 2 か所に同じ値）と、
//   詳細の右のパネル「関連」の区の「親」の行の ParentRow。どれも同じ小窓（views.tsx の ParentDialog）を開く。
//   作る面：決めた親の id を作る面へ渡すだけ（作る口へ送るのは K-442）。「写す」が入っていて親に担当者がいれば onCopy を 1 回。
//     札の字（番号と題名）は react-query の 1 問い合わせ（鍵 ["f4","parent-label",id]）で 2 か所が同じ値を読む。決めたときは答えを置く
//   詳細：決める・外す・変えるを updateTicket の 1 回で（体は parent_ticket_id だけ）。決めた後は getTicket 1 回で読み直す。
//     札は getTicket の parent から（口を増やさない）。見えない親は番号だけ
//   断りの文：答えの code が正本にあればその文を全部、無ければ errorCodeOf の番号の文の 1 文目（画面で文を作らない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import type { ParentSlotProps } from "@/features/F4/create-ticket/create-slot-types";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { CATALOG } from "@kaname/errors/catalog";
import { call, type CallErr } from "@/lib/api/call";
import { DEEP_TEXT, useParentPick } from "./use-parent-pick";
import { ParentDialog, ParentEntry } from "./views";

/** 選んだ親が消えた・見えない（404 E-PAGE-001・入口の NOT_FOUND） */
const GONE_TEXT = "その親は選べなくなりました。選び直してください";
const UNREAD_TEXT = "親を読み込めませんでした";
const SCREEN = "tickets";

interface Label {
  number: string;
  title: string;
}
export const parentLabelKey = (id: string | null) => ["f4", "parent-label", id] as const;

async function readLabel(id: string): Promise<Label> {
  const r = await call("getTicket", { params: { id }, screenId: SCREEN });
  const t = r.ok ? (r.data as { ticket?: { number?: string; title?: string } }).ticket : undefined;
  if (!t?.number) throw new Error(UNREAD_TEXT);
  return { number: t.number, title: t.title ?? "" };
}

/** 口の断りの文（正本に番号があれば全部・無ければページ共通の番号の 1 文目） */
function textOf(r: CallErr | null): string {
  if (!r) return errorText(PAGE_ERROR.loadFailed).title;
  const entry = CATALOG[r.code];
  return entry ? entry.message : errorText(errorCodeOf(r)).title;
}
/** 小窓の上の赤い箱の文（親だけを送るので、選び先の断りは親の断り・3 段は候補の理由と同じ字） */
function dialogTextOf(r: CallErr | null): string {
  if (r && (r.code === PAGE_ERROR.notFound || r.kind === "not_found")) return GONE_TEXT;
  if (r?.code === "E-TKT-003") return DEEP_TEXT;
  return textOf(r);
}

/** 作る面の親の欄（K-442 の ParentSlot の先が置く） */
export function ParentField({ value, onChange, error, onCopy, due }: ParentSlotProps): ReactNode {
  const pick = useParentPick({ mode: "create", selfDue: due });
  const qc = useQueryClient();
  const label = useQuery({
    queryKey: parentLabelKey(value),
    queryFn: () => readLabel(value as string),
    enabled: Boolean(value),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const confirm = () => {
    const c = pick.chosen;
    if (!c) return;
    qc.setQueryData<Label>(parentLabelKey(c.id), { number: c.number, title: c.title });
    onChange(c.id);
    if (pick.copy && c.assignee) onCopy(c.assignee.id);
    pick.close();
  };
  const text = !value
    ? undefined
    : label.data
      ? `親：${label.data.number} ${label.data.title}`
      : label.isError
        ? UNREAD_TEXT
        : null;
  return (
    <>
      {text === null ? (
        <span className="k-f4-par-entry" aria-busy="true" />
      ) : (
        <ParentEntry
          parent={null}
          {...(text ? { label: text } : {})}
          {...(error ? { error } : {})}
          onOpen={pick.open}
          onClear={() => onChange(null)}
        />
      )}
      <ParentDialog {...pick.dialog} onConfirm={confirm} />
    </>
  );
}

interface DetailParent {
  id: string | null;
  number: string;
  title: string | null;
  visible?: boolean;
}

/** 詳細の右のパネルの「親」の行（K-571 の ParentRowSlot の先が置く） */
export function ParentRow({ ticket }: { ticket: SlotTicket }): ReactNode {
  const d = ticket.detail as { parent?: DetailParent | null; ticket?: { due_on?: string | null } };
  const parent = d.parent?.number ? d.parent : null;
  const pick = useParentPick({ mode: "detail", selfDue: d.ticket?.due_on ?? null });
  const notify = useNotify();
  const [removing, setRemoving] = useState(false);
  const sending = useRef(false);

  const send = (id: string | null, key?: string) =>
    call("updateTicket", {
      params: { id: ticket.id },
      body: { parent_ticket_id: id },
      ...(key ? { idempotencyKey: key } : {}),
      screenId: SCREEN,
    }).catch(() => null);

  const confirm = async () => {
    const c = pick.chosen;
    if (!c || sending.current) return;
    sending.current = true;
    pick.setBusy(true);
    pick.setFailure(undefined);
    const r = await send(c.id, pick.key);
    sending.current = false;
    if (r?.ok) {
      pick.close();
      await ticket.reload();
      return;
    }
    pick.setBusy(false);
    pick.setFailure(dialogTextOf(r && !r.ok ? r : null));
  };
  const remove = async () => {
    if (sending.current) return;
    sending.current = true;
    setRemoving(true);
    const r = await send(null);
    if (r?.ok) await ticket.reload();
    else notify(textOf(r && !r.ok ? r : null));
    sending.current = false;
    setRemoving(false);
  };
  const text = parent
    ? parent.visible === false || !parent.title
      ? `親：${parent.number}`
      : `親：${parent.number} ${parent.title}`
    : undefined;
  return (
    <>
      <ParentEntry
        parent={null}
        {...(text ? { label: text } : {})}
        busy={removing}
        onOpen={pick.open}
        onClear={() => void remove()}
      />
      <ParentDialog {...pick.dialog} onConfirm={() => void confirm()} />
    </>
  );
}
