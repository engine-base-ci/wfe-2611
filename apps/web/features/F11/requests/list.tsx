"use client";
// 届いた依頼の左の列（キャンバス CuRequests）：新しい・聞いている・さばいたものの順。値は props で受け取って描くだけ
import { Badge } from "@/components/k";
import { Avatar } from "@/features/F11/clients/parts";
import "@/features/F11/clients/clients.css";
import "./requests.css";

export type ReqStatus = "new" | "asking" | "done";
export interface ReqRow {
  id: string;
  initial: string;
  title: string;
  /** 届け先の社内のグループ（空なら「届いた」の前に名前を出さない） */
  client: string;
  who: string;
  when: string;
  status: ReqStatus;
  /** 札の字（チケットにした など。無ければ status の字） */
  tag?: string;
}

export const REQS: readonly ReqRow[] = [
  {
    id: "r1",
    initial: "鈴",
    title: "12 月分の作業報告書もほしい",
    client: "営業",
    who: "鈴木 様",
    when: "今日",
    status: "new",
  },
  {
    id: "r2",
    initial: "大",
    title: "管理画面に検索の絞り込みを足したい",
    client: "受託開発",
    who: "大橋 様",
    when: "昨日",
    status: "asking",
  },
  {
    id: "r3",
    initial: "大",
    title: "ログイン画面の文言を直してほしい",
    client: "受託開発",
    who: "大橋 様",
    when: "10/31",
    status: "new",
  },
  {
    id: "r4",
    initial: "小",
    title: "10 月分の請求書の再発行",
    client: "経理",
    who: "小林 様",
    when: "10/30",
    status: "done",
    tag: "チケットにした",
  },
];

const TAG: Record<ReqStatus, string> = { new: "新しい", asking: "聞いている", done: "さばいた" };
const TONE: Record<ReqStatus, "warning" | "progress" | "success"> = {
  new: "warning",
  asking: "progress",
  done: "success",
};

export function RequestList({
  rows = REQS,
  current,
  count,
}: {
  rows?: readonly ReqRow[];
  current?: string;
  count?: number;
}) {
  const live = rows.filter((r) => r.status !== "done");
  const done = rows.filter((r) => r.status === "done");
  const item = (r: ReqRow) => (
    <li key={r.id}>
      <a className="k-f11q-item" href={`/requests/${r.id}`} aria-current={r.id === current ? "true" : undefined}>
        <Avatar initial={r.initial} />
        <span className="k-f11q-item-main">
          <b>{r.title}</b>
          {/* 札は題の横に置かない（狭い列で題が 1 字ずつ折れる）。誰から・いつの行の後ろに並べる */}
          <span className="k-f11q-item-meta">
            <span className="k-f11c-sub-text">
              {r.who} ・ {r.client ? `${r.client}に届いた` : "届いた"} ・ {r.when}
            </span>
            <Badge tone={TONE[r.status]}>{r.tag ?? TAG[r.status]}</Badge>
          </span>
        </span>
      </a>
    </li>
  );
  return (
    <aside className="k-f11q-list" aria-label="届いた依頼">
      <h2 className="k-f11q-list-title">届いた依頼 ・ {count ?? live.length}</h2>
      <ul>{live.map(item)}</ul>
      {done.length > 0 ? (
        <>
          <h3 className="k-f11q-list-sub">さばいたもの</h3>
          <ul>{done.map(item)}</ul>
        </>
      ) : null}
    </aside>
  );
}
