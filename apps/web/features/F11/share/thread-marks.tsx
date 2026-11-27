"use client";
// やり取り（チャット）の頭の印（K-905）。段 7 のやり取りの一覧の書き込み 1 つを包む差し込み口（今の描き方は変えない）。
//   (a) 見せているチケット（見せる相手の答えの shared が空でない）：頭の書き込みの前に札「ゲストに見えるやり取り」。
//       問い合わせは区画と同じ ["guest-shares", id]（口を増やさない）。
//   (b) 依頼から作ったチケット：書き込みの from_request（true の行にだけ付く・K-882）が頭から続く間の前に札「依頼のやり取り」、
//       その最後の書き込みの後に区切り「ここからチケットのやり取り」。鍵の無い書き込みだけなら何も出さない。
//   並びが新しい順（desc）のときは、前と後ろを入れ替える（見た目の上下で同じ意味になる）
import type { ReactNode } from "react";
import { Badge } from "@/components/k";
import type { TimelineItem } from "@/features/F6/thread/to-items";
import { useGuestShares } from "./use-guest-shares";
import "./share.css";

export interface GuestThreadMarksProps {
  ticketId: string;
  /** やり取りの行（古い順・口の答えのまま） */
  rows: readonly TimelineItem[];
  /** 包む書き込みの id */
  postId: string;
  order: "asc" | "desc";
  children: ReactNode;
}

/** 頭の書き込みの id と、依頼のやり取りの連なり（頭から from_request が続く書き込みの id） */
export function headOf(rows: readonly TimelineItem[]): { first: string | null; fromRequest: string[] } {
  const posts = rows.filter((r) => r.message !== null);
  const fromRequest: string[] = [];
  for (const r of posts) {
    if (r.message?.from_request !== true) break;
    fromRequest.push(r.id);
  }
  return { first: posts[0]?.id ?? null, fromRequest };
}

export function GuestThreadMarks({ ticketId, rows, postId, order, children }: GuestThreadMarksProps): ReactNode {
  const g = useGuestShares(ticketId);
  const head = headOf(rows);
  const shared = (g.data?.shared.length ?? 0) > 0 && head.first === postId;
  const reqFirst = head.fromRequest[0] === postId;
  const reqLast = head.fromRequest.length > 0 && head.fromRequest[head.fromRequest.length - 1] === postId;
  if (!shared && !reqFirst && !reqLast) return <>{children}</>;
  const before = (
    <>
      {shared ? (
        <div className="k-f11v-chat-mark">
          <Badge tone="progress">ゲストに見えるやり取り</Badge>
        </div>
      ) : null}
      {reqFirst ? (
        <div className="k-f11v-chat-mark">
          <Badge tone="ai">依頼のやり取り</Badge>
        </div>
      ) : null}
    </>
  );
  const after = reqLast ? <div className="k-f11v-chat-mark k-f11v-chat-line">ここからチケットのやり取り</div> : null;
  return order === "asc" ? (
    <>
      {before}
      {children}
      {after}
    </>
  ) : (
    <>
      {after}
      {children}
      {before}
    </>
  );
}
