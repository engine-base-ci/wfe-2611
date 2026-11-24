"use client";
// 詳細の「子チケット・つながり」のカードの先（K-571 が中身の無い形で先に置く・K-452 が LinksBlock に替える）。
//   今は前のまま：見出しと押せない「子を足す」「つながりを足す」
import type { ReactNode } from "react";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";

export function LinksEntryFill(props: EntryProps): ReactNode {
  void props; // 中身の葉が使う（今の既定は値を見ない）
  return (
    <section className="k-detail-links" aria-label="子チケット・つながり">
      <div className="k-detail-links-head">
        <h2>子チケット・つながり</h2>
        <InertButton size="sm">子を足す</InertButton>
        <InertButton size="sm">つながりを足す</InertButton>
      </div>
    </section>
  );
}
