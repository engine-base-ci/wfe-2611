"use client";
// 作る面の「＋ つながりを足す」（K-580・A99・A103）。今あるチケットを探して選ぶ小窓を開き、関連か派生元で足す。
//   足した相手は作る面の状態（value・下書きに残る）で持ち、作るとき作る口の links に載る（つなぎの口は呼ばない）。
//   探すのは use-ticket-search の道具だけ（打ち終わりごとに 1 回）。足す・外すは口を呼ばない。小窓の中は <form> で包まない（G-01）
import { useRef, useState, type ReactNode } from "react";
import "@/features/F4/doc/extra.css";
import type { LinksSlotProps } from "@/features/F4/create-ticket/create-slot-types";
import { useTicketSearch, type TicketSearchRow } from "@/features/F4/pick/use-ticket-search";
import { LINKS_MAX, addLink, isLinked, removeLink, type CreateLinkKind } from "./create-links-model";
import { apiKindOf, candidateRows, stageTone } from "./link-search";
import { CreateLinkList, LinkAddDialog, type AddLinkKind, type ChosenLinkRow } from "./views";

const CANDIDATE_FAILED = "候補を読み込めませんでした";
const FULL_HINT = `つながりは ${LINKS_MAX} 件までです`;
const NEW_TICKET = "作成中のチケット";

const viewKind = (k: CreateLinkKind): AddLinkKind => (k === "related" ? "related" : "derived");
const targetOf = (title: string): string => (title.trim() ? `作成中：${title.trim()}` : NEW_TICKET);

export function CreateLinks({ value, onChange, busy, title }: LinksSlotProps): ReactNode {
  const search = useTicketSearch({ limit: LINKS_MAX });
  const addRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AddLinkKind>("related");
  const [chosen, setChosen] = useState<TicketSearchRow | null>(null);

  const linkedNow = (id: string, k: AddLinkKind): boolean => isLinked(value, apiKindOf(k), id);
  const full = value.length >= LINKS_MAX;

  const openAdd = () => {
    if (busy || full) return;
    search.reset();
    setKind("related");
    setChosen(null);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setChosen(null);
    search.reset();
    requestAnimationFrame(() => addRef.current?.focus());
  };
  const onKind = (k: AddLinkKind) => {
    setKind(k);
    if (chosen && linkedNow(chosen.id, k)) setChosen(null);
  };
  const onSelect = (number: string) => {
    const r = search.rows.find((x) => x.number === number);
    if (r && !linkedNow(r.id, kind)) setChosen(r);
  };
  const submit = () => {
    if (!chosen || busy) return;
    const stage = chosen.stage ? { stage: { key: chosen.stage.key, name: chosen.stage.name } } : {};
    onChange(
      addLink(value, { kind: apiKindOf(kind), id: chosen.id, number: chosen.number, title: chosen.title, ...stage }),
    );
    close();
  };

  const failed = search.state === "failed";
  const candidates = candidateRows(search.rows, { selfId: "", links: [], kind }).map((c, i) => {
    const row = search.rows[i];
    return row && linkedNow(row.id, kind) ? { ...c, linked: true } : c;
  });
  const rows: ChosenLinkRow[] = value.map((l) => ({
    kind: viewKind(l.kind),
    id: l.id,
    number: l.number,
    title: l.title,
    stage: l.stage?.name ?? "",
    stageTone: stageTone(l.stage),
  }));

  return (
    <>
      <CreateLinkList
        rows={rows}
        full={full}
        fullHint={FULL_HINT}
        busy={busy}
        addRef={addRef}
        onAdd={openAdd}
        onRemove={(k, id) => {
          if (!busy) onChange(removeLink(value, apiKindOf(k), id));
        }}
      />
      <LinkAddDialog
        open={open}
        mode="create"
        ticket={{ number: "", title }}
        targetLabel={targetOf(title)}
        confirmLabel="足す"
        kind={kind}
        query={search.text}
        candidates={candidates}
        selected={failed ? null : (chosen?.number ?? null)}
        idle={search.state === "idle"}
        {...(failed ? { candidateError: CANDIDATE_FAILED } : {})}
        onKind={onKind}
        onQuery={(text) => search.setText(text)}
        onSelect={onSelect}
        onSubmit={submit}
        onCancel={close}
      />
    </>
  );
}
