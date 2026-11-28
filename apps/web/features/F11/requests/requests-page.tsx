"use client";
// 届いた依頼の画面の入れ物（K-898・道 /requests と /requests/:id）。口を読み・押し、値と関数を部品（list・views・dialogs）に渡すだけ。
//   PC は一覧が左・開いた依頼が右（/requests は先頭のさばいていない依頼）。スマホ（767 以下）は一覧だけ／開いた依頼だけ（data-mobile）。
//   見えない依頼（404）は「この依頼は見つかりません」だけを出す（題も先方の名前も一覧も出さない＝あるかどうかを伝えない）。
//   「チケットを作る」は K-930：小窓を開いたときに担当とグループの選び肢を前からの口で読み、acceptClientRequest を呼ぶ。分身の案は PC がつながっているときだけ（K-899）。
//   K-899：案があれば題・種別・担当・期限（M/D）・費用・届け先と理由・聞きたいことを出す。PC がつながっていて案が無ければ「案を作る」（use-request-draft）。
//   PC なしで手で書いた題名と期限、または案の値は、チケットを作る小窓の初期値になる（createInitialOf。小窓に渡すのは K-930 の小窓の props）
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Callout, Empty, ErrorState, Loading, NoAccess, PAGE_ERROR } from "@/components/k";
import { getToken } from "@/lib/api/client";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { AskDialog, CreateTicketDialog, DeclineDialog, type CreateValues } from "./dialogs";
import { useCreateChoices } from "./use-create-choices";
import { RequestList, type ReqRow } from "./list";
import { BackToRequests, RequestDetail, type Phase, type RequestData, type ThreadLine } from "./views";
import { useRequestActs, type ActKind, type CreateFailure, type CreateInput, type Failure } from "./use-request-acts";
import {
  failureOf,
  useRequestList,
  useRequestOne,
  type ReqDetail,
  type ReqItem,
  type ReqMessage,
} from "./use-requests";
import {
  askOf,
  createInitialOf,
  DRAFT_TEXT,
  dueLabel,
  ownerIdOf,
  scopeIdOf,
  useRequestDraft,
  whyOf,
} from "./use-request-draft";
import "./requests.css";

const CRUMBS = [{ label: "届いた依頼" }];
const LOADING = "届いた依頼を読み込んでいます…";

const WHEN = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const whenOf = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : WHEN.format(d);
};
const routed = (route?: string | null): string => (route ? `${route}に届いた` : "届いた");

const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const iso = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const realDate = (y: number, m: number, d: number): boolean => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
/** 小窓の期限の字（「12/26」か「2026-12-26」）→ 日付。「12/26」は今日（日本時間）から見て次のその日付。形が違えば null */
export function dueOn(text: string, now: Date = new Date()): string | null {
  const t = text.trim().replace(/[０-９／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (full) {
    const [y, m, d] = [Number(full[1]), Number(full[2]), Number(full[3])];
    return realDate(y, m, d) ? iso(y, m, d) : null;
  }
  const md = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (!md) return null;
  const [m, d] = [Number(md[1]), Number(md[2])];
  const today = TODAY.format(now);
  const y0 = Number(today.slice(0, 4));
  for (const y of [y0, y0 + 1]) if (realDate(y, m, d) && iso(y, m, d) >= today) return iso(y, m, d);
  return null;
}

const rowOf = (i: ReqItem): ReqRow => ({
  id: i.id,
  initial: i.from_name.slice(0, 1),
  title: i.title,
  client: i.route_name ?? "",
  who: i.from_name,
  when: whenOf(i.created_at),
  status: i.state,
  ...(i.tag ? { tag: i.tag } : {}),
});

/** 聞いている帯の行：やり取りを古い順に（社内＝聞いたこと・先方＝先方の返事。日時は一覧と同じ M/D HH:mm・answer=551509bd2ce7） */
const threadOf = (messages: readonly ReqMessage[]): ThreadLine[] =>
  [...messages]
    .map((m, i) => ({ m, i, t: new Date(m.at).getTime() }))
    .sort((a, b) => (Number.isNaN(a.t) || Number.isNaN(b.t) || a.t === b.t ? a.i - b.i : a.t - b.t))
    .map(({ m }) => ({
      side: m.side,
      text: `${m.side === "we" ? "聞いたこと" : "先方の返事"}（${m.name} ・ ${whenOf(m.at)}）：${m.text}`,
    }));

function dataOf(d: ReqDetail, notice: Failure | null): RequestData {
  const r = d.request;
  const when = whenOf(r.created_at);
  const draft = d.ticket_draft;
  return {
    title: r.title,
    who: `${r.from_name}（${r.group_name}） ・ ${routed(r.route_name)} ・ ${when}`,
    initial: r.from_name.slice(0, 1),
    from: `${r.from_name} ・ ${when}`,
    body: r.body,
    proposal: draft
      ? {
          title: draft.title,
          kind: draft.kind,
          owner: draft.owner,
          due: dueLabel(draft.due),
          cost: draft.cost,
          route: d.route_suggestion?.name ?? draft.route_name ?? r.route_name ?? "",
          why: whyOf(d.route_suggestion?.reason),
        }
      : null,
    ...(draft && d.questions.length > 0 ? { ask: askOf(d.questions) } : {}),
    draft: d.reply_draft ?? "",
    routes: d.routes,
    route: r.route_name ?? "",
    thread: threadOf(d.messages),
    ...(r.ticket_id ? { ticketId: r.ticket_id } : {}),
    ...(r.ticket_number ? { ticketNumber: r.ticket_number } : {}),
    ...(r.declined_reason ? { declinedReason: r.declined_reason } : {}),
    ...(notice
      ? {
          notice: (
            <Callout tone="danger" {...(notice.title ? { title: notice.title } : {})}>
              {notice.body ?? null}
            </Callout>
          ),
        }
      : {}),
  };
}

function DetailState({ children }: { children: ReactNode }) {
  return (
    <section className="k-f11q-detail" aria-label="依頼">
      <BackToRequests />
      {children}
    </section>
  );
}

export function RequestsPage({ id }: { id?: string }) {
  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, []);
  const list = useRequestList();
  const items = list.data?.items ?? [];
  // /requests は先頭のさばいていない依頼を右に開く（スマホは一覧だけ）。/requests/:id は一覧と同時に読む
  const pickedId = id ?? (items.find((i) => i.state !== "done") ?? items[0])?.id;
  const one = useRequestOne(pickedId);
  const acts = useRequestActs(pickedId);
  const [phase, setPhase] = useState<{ id: string; phase: Phase } | null>(null);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [dialog, setDialog] = useState<{ kind: Exclude<ActKind, "route">; failure: Failure | null } | null>(null);
  const [notice, setNotice] = useState<{ id: string; failure: Failure } | null>(null);
  const [create, setCreate] = useState<{ failure: CreateFailure | null } | null>(null);
  const [created, setCreated] = useState<{ id: string; ticketId: string; number: string | null } | null>(null);
  const choices = useCreateChoices(create !== null);
  const [manual, setManual] = useState<{ id: string; title: string; due: string } | null>(null);
  const refetchOne = one.refetch;
  const reloadDraft = useCallback(async () => Boolean((await refetchOne()).data?.ticket_draft), [refetchOne]);
  const draftActs = useRequestDraft(pickedId, Boolean(one.data?.ticket_draft), reloadDraft);

  const listErr = failureOf(list.error);
  const oneErr = failureOf(one.error);
  const main = (() => {
    if (list.isError) {
      if (listErr?.status === 401) return <Loading label={LOADING} />;
      if (listErr?.kind === "forbidden") return <NoAccess />;
      return <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void list.refetch()]} />;
    }
    if (oneErr?.kind === "not_found") return <NotFound />;
    if (!list.data) return <Loading label={LOADING} />;
    if (items.length === 0 && !id)
      return (
        <Empty title="届いた依頼はまだありません">ゲストが「ゲストの場所」から依頼を出すと、ここに届きます。</Empty>
      );
    return (
      <div className="k-root k-f11q-wrap" data-mobile={id ? "detail" : "list"}>
        <RequestList rows={items.map(rowOf)} count={list.data.live} {...(pickedId ? { current: pickedId } : {})} />
        {detailOf()}
      </div>
    );
  })();

  function detailOf() {
    if (one.isError) {
      if (oneErr?.kind === "forbidden")
        return (
          <DetailState>
            <NoAccess />
          </DetailState>
        );
      return (
        <DetailState>
          <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void one.refetch()]} />
        </DetailState>
      );
    }
    if (!one.data || !pickedId)
      return (
        <DetailState>
          <Loading label={LOADING} />
        </DetailState>
      );
    const d = one.data;
    const cur = pickedId;
    const ps = d.pc_connected && d.ticket_draft ? "PS2" : "PS0";
    const waitingDraft = d.pc_connected && !d.ticket_draft;
    const hand = manual?.id === cur ? manual : { id: cur, title: d.request.title, due: "" };
    const text = reply?.id === cur ? reply.text : (d.reply_draft ?? "");
    // 「案を作る」の読み直しを伴う断り（もう決まっている・PC がつながっていない）は本文の頭の知らせに出す（案の区画が消えても読める）。
    //   PC なしの形に替わったら同じ字の押せない形が出るので、文のほうは出さない
    const draftHead =
      draftActs.headMessage && !(draftActs.headMessage === DRAFT_TEXT.needPc && !d.pc_connected)
        ? draftActs.headMessage
        : null;
    const shown: Failure | null = notice?.id === cur ? notice.failure : draftHead ? { body: draftHead } : null;
    const run = async (kind: ActKind, value: string) => {
      setNotice(null);
      const res = await acts.run(kind, value);
      if (res === null) return;
      if (res === true) {
        setDialog(null);
        if (kind !== "route") setPhase({ id: cur, phase: kind === "reply" ? "asked" : "declined" });
        return;
      }
      if (kind === "route") setNotice({ id: cur, failure: res });
      else setDialog((o) => (o ? { ...o, failure: res } : o));
    };
    const target = `${d.request.title} ・ ${d.request.group_name} ・ ${d.request.from_name}`;
    // 小窓の初期値：分身の案（題・期限・担当・グループ）か、PC なしで手で書いた題名と期限（K-899・D-155.8）。無ければ依頼の題
    const init = createInitialOf(d.ticket_draft, d.route_suggestion, manual?.id === cur ? manual : null);
    const initialTitle = init && init.title.trim() !== "" ? init.title : d.request.title;
    const initialDue = init?.due ?? "";
    const initialAssigneeId = init
      ? ownerIdOf(
          init.ownerName,
          choices.members.map((m) => ({ id: m.id, display_name: m.name })),
        )
      : null;
    const routeId = d.routes.find((r) => r.name === d.request.route_name)?.id;
    const draftScopeId = init ? scopeIdOf(init.routeName, choices.scopes) : null;
    const defaultScopeId = draftScopeId ?? choices.scopes.find((g) => g.id === routeId)?.id ?? choices.scopes[0]?.id;
    const made = created?.id === cur ? created : null;
    const ticketId = made?.ticketId ?? d.request.ticket_id ?? null;
    const runCreate = async (v: CreateValues) => {
      const due = dueOn(v.due);
      if (!due) {
        setCreate({ failure: { field: "due", body: "期限を入れてください" } });
        return;
      }
      setCreate({ failure: null });
      const input: CreateInput = {
        ...(v.title.trim() ? { title: v.title.trim() } : {}),
        ...(v.body !== d.request.body && v.body.trim() ? { body: v.body } : {}),
        assignee_member_id: v.assigneeId,
        due_on: due,
        scope_id: v.scopeId,
      };
      const res = await acts.acceptRun(input);
      if (res === null) return;
      if ("ticket_id" in res) {
        setCreate(null);
        setCreated({ id: cur, ticketId: res.ticket_id, number: res.number });
        setPhase({ id: cur, phase: "accepted" });
        return;
      }
      setCreate({ failure: res });
    };
    const live = (kind: Exclude<ActKind, "route">) => ({
      open: true,
      onClose: () => setDialog(null),
      onSubmit: (v: string) => void run(kind, v),
      target,
      busy: acts.busy[kind],
      failure: dialog?.failure ?? null,
      ...(kind === "reply" ? { initial: text } : {}),
    });
    return (
      <>
        <RequestDetail
          ps={ps}
          status={d.request.state}
          phase={phase?.id === cur ? phase.phase : "idle"}
          canAct={d.can_act}
          {...(d.pc_connected && !d.ticket_draft ? { pcConnected: true } : {})}
          data={{
            ...dataOf(d, shown),
            ...(made ? { ticketId: made.ticketId, ...(made.number ? { ticketNumber: made.number } : {}) } : {}),
          }}
          draftControl={{
            ...(waitingDraft ? { onMake: () => void draftActs.make() } : {}),
            making: draftActs.making,
            message: draftActs.message,
            manualTitle: hand.title,
            manualDue: hand.due,
            onManualTitle: (v) => setManual({ ...hand, title: v }),
            onManualDue: (v) => setManual({ ...hand, due: v }),
          }}
          acts={{
            onAsk: () => setDialog({ kind: "reply", failure: null }),
            onDecline: () => setDialog({ kind: "decline", failure: null }),
            onCreate: () => setCreate({ failure: null }),
            onChangeRoute: (rid) => void run("route", rid),
            ...(ticketId
              ? { onOpenTicket: () => window.location.assign(`/tickets/${encodeURIComponent(ticketId)}`) }
              : {}),
            reply: text,
            onReplyChange: (v) => setReply({ id: cur, text: v }),
          }}
        />
        {dialog?.kind === "reply" ? <AskDialog live={live("reply")} /> : null}
        {dialog?.kind === "decline" ? <DeclineDialog live={live("decline")} /> : null}
        {create ? (
          <CreateTicketDialog
            live={{
              open: true,
              onClose: () => setCreate(null),
              onCreate: (v) => void runCreate(v),
              creating: acts.busy.accept,
              createError: create.failure,
              target: `${d.request.title} ・ ${d.request.from_name}`,
              initialTitle,
              initialBody: d.request.body,
              initialDue,
              initialAssigneeId,
              guestGroup: d.request.group_name,
              members: choices.members,
              scopes: choices.scopes,
              ...(defaultScopeId ? { defaultScopeId } : {}),
              choicesState: { members: choices.membersState, scopes: choices.scopesState },
              onRetryMembers: choices.retryMembers,
              onRetryScopes: choices.retryScopes,
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <TicketShell screen="requests" crumbs={CRUMBS}>
      {main}
    </TicketShell>
  );
}

/** 見えない・無い依頼（404）。あるかどうかを伝えない */
function NotFound() {
  return (
    <section className="k-f11q-detail" aria-label="依頼">
      <Empty title="この依頼は見つかりません">
        <a href="/requests">届いた依頼へ戻る</a>
      </Empty>
    </section>
  );
}
