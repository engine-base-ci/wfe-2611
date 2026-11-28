"use client";
// 作る面の頭の作り方（K-446・A129）。「過去のチケットから複製」で元を選ぶ小窓（探す道具は K-443 の use-ticket-search）を開き、
//   元を選んで「この元から作る」を押したら元の詳細を getTicket で 1 回読み、詳細と同じ複製の小窓（DuplicateFlow）を開く。
//   小窓は開く前も開いた直後も口を呼ばない（探す字を打ってから）。読めなければ元を選ぶ小窓の上の赤い箱（選びは残す）。
//   作る面で書いていた下書きには触らない（複製は元から写す・書きかけは下書きの一覧に残る）
import { useState, type ReactNode } from "react";
import { errorCodeOf, errorText } from "@/components/k/error-of";
import { mmdd } from "@/features/F4/due/dates";
import { useTicketSearch, type TicketSearchRow } from "@/features/F4/pick/use-ticket-search";
import { call } from "@/lib/api/call";
import { DuplicateFlow, sourceOf, type DupSource } from "./duplicate-button";
import { SRC_GONE } from "./use-duplicate";
import { CreateHow, DuplicatePickDialog } from "./views";
import type { PickItem } from "../parent/views";

const SCREEN = "tickets";

/** 候補の下の小さな字：「<グループ> ・ <段> ・ 期限 MM/DD」 */
function metaOf(r: TicketSearchRow): string | undefined {
  const parts = [r.scope?.name, r.stage?.name, r.due_on ? `期限 ${mmdd(r.due_on)}` : undefined].filter(
    (x): x is string => Boolean(x),
  );
  return parts.length ? parts.join(" ・ ") : undefined;
}

export function DuplicateHow({ lead }: { lead?: ReactNode } = {}): ReactNode {
  const search = useTicketSearch();
  const [pickOpen, setPickOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [reading, setReading] = useState(false);
  const [source, setSource] = useState<DupSource | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

  const openPick = () => {
    search.reset();
    setChosen(null);
    setFailure(undefined);
    setReading(false);
    setPickOpen(true);
  };
  const closePick = () => {
    if (!reading) setPickOpen(false);
  };
  const confirm = async () => {
    if (!chosen || reading) return;
    setReading(true);
    setFailure(undefined);
    const r = await call("getTicket", { params: { id: chosen }, screenId: SCREEN }).catch(() => null);
    setReading(false);
    if (!r || !r.ok) {
      const text =
        r && (r.kind === "not_found" || r.code === "NOT_FOUND")
          ? SRC_GONE
          : errorText(r ? errorCodeOf(r) : "E-PAGE-007").title;
      return setFailure(text);
    }
    setSource(sourceOf(r.data as unknown as Record<string, unknown>));
    setPickOpen(false);
    setDupOpen(true);
  };

  const items: PickItem[] = search.rows.map((r) => {
    const meta = metaOf(r);
    return { id: r.id, lead: r.number, title: r.title, ...(meta ? { meta } : {}), selected: r.id === chosen };
  });
  return (
    <>
      <CreateHow onDuplicate={openPick} {...(lead ? { lead } : {})} />
      <DuplicatePickDialog
        open={pickOpen}
        query={search.text}
        items={items}
        state={search.state}
        busy={reading}
        onQuery={search.setText}
        onPick={setChosen}
        onClose={closePick}
        onConfirm={() => void confirm()}
        {...(failure ? { failure } : {})}
      />
      {source ? <DuplicateFlow source={source} open={dupOpen} onOpenChange={setDupOpen} /> : null}
    </>
  );
}
