"use client";
// 問い合わせ 1 件のやり取り（K-1007・画面 inquiry・道 /inquiry/[id]）。外枠（TicketShell）の中に、運営とのやり取り・返事を書く欄・済みにする。
//   見た目はモック /dev/mock/f12-user/uh-thread・uh-thread-done・uh-thread-notfound と同じ部品（views.tsx の Thread・ThreadNotFound）。
//   返事は JS が先に確かめる（空・長すぎるは口を呼ばない）。書いた・済みにした後は読み直した答えのとおりに札を出す（済みの後に書くと開き直る・D-156.25）。
//   無い・見えない問い合わせ（口が 404）は見つからない（E-PAGE-001）で、困ったとき・お知らせへ戻る道。読めないときは E-PAGE-007 で「もう一度」。
//   書けない・済みにできないときは赤い箱（書いた字は残る・札は前のまま）
import { useState } from "react";
import { ErrorState, errorText, Loading, PAGE_ERROR, PageBody } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { HELP_CRUMBS } from "./help-screen";
import { replyProblem, threadView } from "./thread-shape";
import { ThreadCallError, useInquiry, useReply, useResolve } from "./use-thread";
import { Thread, ThreadNotFound, type ThreadNotice } from "./views";

const HOME = "/notices";
const MISSING_CRUMB = "問い合わせ";

const codeOf = (e: unknown): string => (e instanceof ThreadCallError ? e.code : PAGE_ERROR.loadFailed);
const isGone = (e: unknown): boolean => e instanceof ThreadCallError && e.notFound;
const noticeOf = (e: unknown): ThreadNotice => {
  const code = codeOf(e);
  return { code, text: errorText(code).entry.message };
};

export function ThreadScreen({ id }: { id: string }) {
  const inquiry = useInquiry(id);
  const reply = useReply(id);
  const resolve = useResolve(id);
  const [draft, setDraft] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ThreadNotice | null>(null);
  const [resolveNotice, setResolveNotice] = useState<ThreadNotice | null>(null);
  /** 書く・済みにする間に見えなくなった（口が 404） */
  const [gone, setGone] = useState(false);
  const busy = reply.isPending || resolve.isPending;

  const send = (): void => {
    if (busy) return;
    const problem = replyProblem(draft);
    setReplyError(problem);
    if (problem) return;
    setNotice(null);
    reply.mutate(draft.trim(), {
      onSuccess: () => setDraft(""),
      onError: (e) => (isGone(e) ? setGone(true) : setNotice(noticeOf(e))),
    });
  };

  const markDone = (): void => {
    if (busy) return;
    setResolveNotice(null);
    resolve.mutate(undefined, {
      onError: (e) => (isGone(e) ? setGone(true) : setResolveNotice(noticeOf(e))),
    });
  };

  const missing = gone || (inquiry.isError && isGone(inquiry.error));
  const data = missing ? undefined : inquiry.data;
  const crumbs = [...HELP_CRUMBS, { label: data ? data.title : MISSING_CRUMB }];
  let body;
  if (missing) body = <ThreadNotFound backHref={HOME} />;
  else if (inquiry.isError)
    body = (
      <PageBody labelledBy="thread-failed">
        <div className="k-uh-top">
          <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void inquiry.refetch()]} heading={1} />
        </div>
      </PageBody>
    );
  else if (!data) body = <Loading />;
  else {
    const v = threadView(data);
    body = (
      <Thread
        title={v.title}
        kind={v.kind}
        sentAt={v.sentAt}
        messages={v.messages}
        state={v.state}
        {...(v.done ? { done: true } : {})}
        draft={draft}
        onDraft={(t) => {
          setDraft(t);
          if (replyError) setReplyError(null);
        }}
        onSend={send}
        onResolve={markDone}
        sending={reply.isPending}
        resolving={resolve.isPending}
        replyError={replyError}
        notice={notice}
        resolveNotice={resolveNotice}
      />
    );
  }
  return (
    <TicketShell screen="notices" crumbs={crumbs}>
      {body}
    </TicketShell>
  );
}
