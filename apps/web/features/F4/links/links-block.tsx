"use client";
// 詳細の本文の下の「子チケット・つながり」のカード（K-452・A103）。閉じた形が既定（件数は getTicket の child_count・link_count）、
//   「開く」で口を 1 回読み、子とつながりの一覧・外す確かめ・つながりを足す小窓をつなぐ。口は use-links.ts、候補を探すのは use-ticket-search.ts。
//   置き場：口の断りは小窓（確かめ）の上の赤い箱／相手が消えた（404）は候補の下／書けた知らせは 5 秒の小さな知らせ／読めないはカードの中の赤い箱
import { useRef, useState, type ReactNode } from "react";
import { Button, NoticeBox, useNotify } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { useTicketSearch, type TicketSearchRow } from "@/features/F4/pick/use-ticket-search";
import { refusalText } from "@/features/F4/specs/spec-text";
import type { CallErr } from "@/lib/api/call";
import { apiKindOf, candidateRows, isLinked, toChildRows, toLinkRows, type ApiLink } from "./link-search";
import { useLinks } from "./use-links";
import { LinkAddDialog, LinksSection, UnlinkConfirm, type AddLinkKind, type LinkRow } from "./views";

const CANDIDATE_FAILED = "候補を読み込めませんでした";
const RETRY = "もう一度読む";

const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const textOf = (err: CallErr | null): string =>
  err ? refusalText(err) : errorText(PAGE_ERROR.loadFailed).entry.message;
const goneText = (): string => errorText(PAGE_ERROR.notFound).entry.message;

interface DetailOf {
  ticket?: { number?: string; title?: string };
  child_count?: number | null;
  link_count?: number | null;
}

const NO_LINKS: readonly ApiLink[] = [];

export function LinksBlock({ ticket }: { ticket: SlotTicket }): ReactNode {
  const d = ticket.detail as DetailOf;
  const self = { number: d.ticket?.number ?? "", title: d.ticket?.title ?? "" };
  const lk = useLinks(ticket.id);
  const notify = useNotify();
  const search = useTicketSearch({ limit: 20 });
  const sending = useRef(false);
  const links = lk.state.kind === "ready" ? lk.state.links : NO_LINKS;

  // つながりを足す小窓
  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<AddLinkKind>("related");
  const [chosen, setChosen] = useState<TicketSearchRow | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addNotice, setAddNotice] = useState<string | undefined>(undefined);
  const [addGone, setAddGone] = useState(false);
  const addKey = useRef("");

  // 外す確かめ
  const [target, setTarget] = useState<LinkRow | null>(null);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkNotice, setUnlinkNotice] = useState<string | undefined>(undefined);

  const openAdd = () => {
    search.reset();
    setKind("related");
    setChosen(null);
    setAddBusy(false);
    setAddNotice(undefined);
    setAddGone(false);
    addKey.current = newKey();
    setAddOpen(true);
  };
  const closeAdd = () => {
    if (sending.current) return;
    setAddOpen(false);
    search.reset();
  };
  const onKind = (k: AddLinkKind) => {
    setKind(k);
    setAddGone(false);
    if (chosen && isLinked(links, chosen.id, k)) setChosen(null);
  };
  const onQuery = (text: string) => {
    setAddGone(false);
    search.setText(text);
  };
  const onSelect = (number: string) => {
    const r = search.rows.find((x) => x.number === number);
    if (r && r.id !== ticket.id && !isLinked(links, r.id, kind)) setChosen(r);
  };
  const submit = async () => {
    if (!chosen || sending.current) return;
    sending.current = true;
    setAddBusy(true);
    setAddNotice(undefined);
    setAddGone(false);
    const r = await lk.add(chosen.id, apiKindOf(kind), addKey.current);
    sending.current = false;
    setAddBusy(false);
    if (r.ok) {
      setAddOpen(false);
      search.reset();
      notify(`${chosen.number} とつなぎました`);
      return;
    }
    if (r.err?.status === 404) setAddGone(true);
    else setAddNotice(textOf(r.err));
  };
  const createChild = () => {
    setAddOpen(false);
    lk.toCreateChild();
  };

  const askUnlink = (id: string) => {
    const row = toLinkRows(links).find((x) => x.id === id);
    if (!row) return;
    setTarget(row);
    setUnlinkNotice(undefined);
    setUnlinkOpen(true);
  };
  const confirmUnlink = async () => {
    if (!target || sending.current) return;
    sending.current = true;
    setUnlinkBusy(true);
    setUnlinkNotice(undefined);
    const r = await lk.remove(target.id);
    sending.current = false;
    setUnlinkBusy(false);
    if (r.ok) return setUnlinkOpen(false);
    if (r.err?.status === 404) {
      setUnlinkOpen(false);
      return lk.reload();
    }
    setUnlinkNotice(textOf(r.err));
  };

  const candidateError = addGone ? goneText() : search.state === "failed" ? CANDIDATE_FAILED : undefined;
  return (
    <>
      <Section
        state={lk.state}
        counts={{ children: d.child_count ?? 0, links: d.link_count ?? 0 }}
        onOpen={lk.open}
        onReload={lk.reload}
        onAddChild={lk.toCreateChild}
        onAddLink={openAdd}
        onUnlink={askUnlink}
      />
      <LinkAddDialog
        open={addOpen}
        ticket={self}
        kind={kind}
        query={search.text}
        candidates={candidateRows(search.rows, { selfId: ticket.id, links, kind })}
        selected={chosen?.number ?? null}
        busy={addBusy}
        idle={search.state === "idle"}
        {...(addNotice ? { notice: <NoticeBox>{addNotice}</NoticeBox> } : {})}
        {...(candidateError ? { candidateError } : {})}
        onKind={onKind}
        onQuery={onQuery}
        onSelect={onSelect}
        onSubmit={() => void submit()}
        onCancel={closeAdd}
        onCreateChild={createChild}
      />
      {target ? (
        <UnlinkConfirm
          open={unlinkOpen}
          link={target}
          busy={unlinkBusy}
          {...(unlinkNotice ? { notice: <NoticeBox>{unlinkNotice}</NoticeBox> } : {})}
          onOpenChange={(o) => {
            if (!o) setUnlinkOpen(false);
          }}
          onConfirm={() => void confirmUnlink()}
        />
      ) : null}
    </>
  );
}

interface SectionProps {
  state: ReturnType<typeof useLinks>["state"];
  counts: { children: number; links: number };
  onOpen: () => void;
  onReload: () => void;
  onAddChild: () => void;
  onAddLink: () => void;
  onUnlink: (id: string) => void;
}

/** カード：閉じた形・読む途中・読めない・一覧 */
function Section({ state, counts, onOpen, onReload, onAddChild, onAddLink, onUnlink }: SectionProps): ReactNode {
  if (state.kind === "closed") {
    return <LinksSection collapsed counts={counts} childTickets={[]} links={[]} onOpen={onOpen} />;
  }
  if (state.kind === "loading") {
    return <LinksSection childTickets={[]} links={[]} notice={<div aria-busy="true" />} />;
  }
  if (state.kind === "failed") {
    return (
      <LinksSection
        childTickets={[]}
        links={[]}
        notice={
          <>
            <NoticeBox>{textOf(state.err)}</NoticeBox>
            <Button variant="outlined" size="sm" onClick={onReload}>
              {RETRY}
            </Button>
          </>
        }
      />
    );
  }
  return (
    <LinksSection
      childTickets={toChildRows(state.children)}
      links={toLinkRows(state.links)}
      onAddChild={onAddChild}
      onAddLink={onAddLink}
      onUnlink={onUnlink}
    />
  );
}
