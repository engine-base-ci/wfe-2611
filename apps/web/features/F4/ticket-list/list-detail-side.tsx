"use client";
// 一覧の右に開く詳細（K-252・D-128.165・D-128.14）。幅 1024 以上で行（番号・題名）を押すと、移らずにここへ開く。
//   中身は詳細の部品の横の形（ticket-detail.tsx の layout="side"：題名の行・右のパネル・パネルを開く／閉じるは描かず、題名は h2）。
//   番号から id が分からない（一覧に無い）ときは、正本の E-PAGE-001「見つかりませんでした」（見出しは h2）。
//   「全画面で開く」「閉じる」は詳細の本文のチケット（K-226）が足す
import { ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { TicketDetailSide } from "../create-ticket/ticket-detail";
import type { OpenLookup } from "./use-ticket-list";

export function ListDetailSide({ open }: { open: OpenLookup }) {
  return (
    <aside className="k-list-detail" aria-label="チケットの詳細">
      {open.state === "found" ? (
        <TicketDetailSide key={open.id} id={open.id} />
      ) : open.state === "missing" ? (
        <ErrorState code={PAGE_ERROR.notFound} />
      ) : (
        <Loading />
      )}
    </aside>
  );
}
