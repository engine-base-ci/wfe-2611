"use client";
// 運営の受信箱の画面（/ops/support・K-976）。URL の箱・種類・開いた 1 件を読み → 外枠の答え（caps・箱の数）と一覧・1 件の口を読み → 部品に値と押したときの関数を渡す。
//   箱・種類・1 件は URL に持つ（router.push で戻るが効く）。問い合わせ（inquiry）を持たない人は口を呼ばず見る権限がない形。
//   右の様子は開いた 1 件の、開いていなければ一覧の 1 行目のワークスペース（下絵 oq-inbox と同じ形）
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { errorCodeOf, errorText, PAGE_ERROR } from "@/components/k/error-of";
import { useSession } from "@/lib/auth/session";
import {
  BOXES,
  inboxQuery,
  inboxSearch,
  laterOf,
  messageView,
  rowView,
  shellInbox,
  sideView,
  threadSub,
  topicLabel,
  TOPICS,
  type InboxBox,
  type InboxQuery,
  type InqDetail,
  type LaterChoice,
} from "./inbox-shape";
import {
  InboxReadError,
  InboxWriteError,
  useInboxList,
  useInboxOne,
  useInboxPost,
  useInboxShell,
  useInboxUpdate,
} from "./use-ops-inbox";
import { InboxPage, type InboxChip, type InboxThread } from "./views-inbox";

const HOME = "/ops/support";
const BOX_LABEL: Record<InboxBox, string> = {
  unassigned: "まだ誰も持っていない",
  mine: "自分",
  waiting: "返事待ち",
  later: "後で",
  done: "済み",
};
const TAKEN = "E-OPS-005";
const LATER_PAST = "E-OPS-008";

/** 正本の 1 件の見出し（正本に無ければ答えの言葉か、読めなかった旨） */
function textOf(code: string, fallback: string | null): string {
  if (code in CATALOG) return errorText(code).title;
  return fallback ?? errorText(PAGE_ERROR.loadFailed).title;
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <PageBody labelledBy="oq-inbox-title">
      <PageHeader id="oq-inbox-title" title="問い合わせ" />
      <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry]} />
    </PageBody>
  );
}

export function InboxScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const q = useMemo(() => inboxQuery(sp), [sp]);
  const { session } = useSession();
  const shell = useInboxShell();
  const s = shell.data?.kind === "ok" ? shellInbox(shell.data.data) : null;
  const can = s?.caps.includes("inquiry") ?? false;
  const list = useInboxList(q, can);
  const sideId = q.id ?? list.data?.[0]?.id ?? null;
  const one = useInboxOne(sideId, can);
  const id = q.id ?? "";
  const me = s ? { member_id: s.me, name: session?.user.name ?? "" } : null;
  const update = useInboxUpdate(id);
  const reply = useInboxPost(id, "reply", me);
  const note = useInboxPost(id, "note", me);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Record<string, true>>({});

  if (shell.isPending) return null;
  if (!s) return <Failed onRetry={() => void shell.refetch()} />;
  if (!can) return <NoAccess />;
  if (list.isPending) return null;
  if (list.isError || !list.data) return <Failed onRetry={() => void list.refetch()} />;

  const now = new Date();
  const go = (next: InboxQuery) => router.push(`${pathname ?? HOME}${inboxSearch(next)}` as Route);
  const boxes: InboxChip[] = BOXES.map((b) => ({
    label: BOX_LABEL[b],
    on: q.box === b,
    ...(b !== "done" && s.counts[b] !== undefined ? { count: s.counts[b] } : {}),
    onClick: () => go({ box: b, topic: q.topic, id: null }),
  }));
  const topics: InboxChip[] = [
    { label: "すべて", on: q.topic === null, onClick: () => go({ ...q, topic: null, id: null }) },
    ...TOPICS.map((t) => ({
      label: topicLabel(t),
      on: q.topic === t,
      onClick: () => go({ ...q, topic: t, id: null }),
    })),
  ];
  const rows = list.data.map((r) => rowView(r, s.me, now));
  const mine = s.counts.mine;
  const sub = `顧客から届いた問い合わせ${mine !== undefined ? ` ・ 自分の担当 ${mine} 件` : ""}`;
  const detail = one.data && (q.id === null || one.data.id === q.id) ? one.data : null;

  const setError = (msg: string | null) =>
    setErrors(({ [id]: _drop, ...rest }) => {
      void _drop;
      return msg ? { ...rest, [id]: msg } : rest;
    });
  const onFail = (e: unknown) => {
    if (!(e instanceof InboxWriteError)) return setError(errorText(PAGE_ERROR.loadFailed).title);
    const err = e.err;
    if (err.code === TAKEN) {
      setConflicts((c) => ({ ...c, [id]: true }));
      setError(null);
      void one.refetch();
      return;
    }
    if (err.code === LATER_PAST) return setError(textOf(LATER_PAST, err.message));
    setError(textOf(errorCodeOf(err), err.message));
  };

  const threadOf = (d: InqDetail): InboxThread => {
    const conflict = conflicts[d.id] === true;
    const ownerOther = d.owner !== null && d.owner.member_id !== s.me ? d.owner : null;
    const holder: InboxThread["holder"] =
      ownerOther || conflict ? "other" : d.owner?.member_id === s.me ? "me" : "none";
    const takeToo = holder === "none" ? { take: true } : {};
    const text = drafts[d.id] ?? "";
    const busy = update.isPending || reply.isPending || note.isPending;
    const run = (fn: () => void) => () => {
      if (busy) return;
      setError(null);
      fn();
    };
    const post = (m: typeof reply) =>
      run(() => {
        if (text.trim() === "") return;
        m.mutate(text, {
          onSuccess: () =>
            setDrafts(({ [d.id]: _drop, ...rest }) => {
              void _drop;
              return rest;
            }),
          onError: onFail,
        });
      });
    return {
      title: d.title,
      sub: threadSub(d, now),
      owner: d.owner ? (d.owner.member_id === s.me ? `${d.owner.name}（自分）` : d.owner.name) : "なし",
      holder,
      ...(ownerOther
        ? {
            takenTitle: `${ownerOther.name} さんが担当になりました`,
            takenBody: `担当を取った人だけが返せます。あなたは見るだけです。担当を替えてもらうか、${ownerOther.name} さんに声をかけてください`,
          }
        : conflict
          ? { takenTitle: textOf(TAKEN, null), takenBody: "担当を取った人だけが返せます。あなたは見るだけです" }
          : {}),
      messages: d.messages.map((m) => messageView(m, now)),
      context: sideView(d).context,
      reply: text,
      onReply: (v) => setDrafts((x) => ({ ...x, [d.id]: v })),
      busy,
      error: errors[d.id] ?? null,
      onTake: run(() => update.mutate({ take: true }, { onError: onFail })),
      onRelease: run(() => update.mutate({ release: true }, { onError: onFail })),
      onDone: run(() => update.mutate({ ...takeToo, state: "done" }, { onError: onFail })),
      onLater: (c: LaterChoice) =>
        run(() => update.mutate({ ...takeToo, later_until: laterOf(c, new Date()) }, { onError: onFail }))(),
      onSend: post(reply),
      onNote: post(note),
    };
  };

  let thread: InboxThread | undefined;
  let threadState: ReactNode;
  if (q.id !== null) {
    if (detail) thread = threadOf(detail);
    else if (one.isError) {
      const nf = one.error instanceof InboxReadError && one.error.status === 404;
      threadState = nf ? (
        <ErrorState code={PAGE_ERROR.notFound} />
      ) : (
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void one.refetch()]} />
      );
    }
  }
  return (
    <InboxPage
      sub={sub}
      boxes={boxes}
      topics={topics}
      rows={rows}
      listLabel={BOX_LABEL[q.box]}
      empty={rows.length === 0}
      {...(q.id ? { current: q.id } : {})}
      onRow={(rid) => go({ ...q, id: rid })}
      {...(thread ? { thread } : {})}
      {...(threadState ? { threadState } : {})}
      side={detail ? sideView(detail) : null}
    />
  );
}
