"use client";
// 段 12 の下絵の 1 つの状態を描く。id の頭で会社の側（render-cu.tsx）とゲストの側（render-cp.tsx）に振り分ける。
//   どちらにも無い id は「この状態はまだありません」（撮る台本が拾う）。製品の時点を data-ps に出す
import type { Theme } from "@/lib/theme";
import { MOCKS } from "./mocks";
import { renderCp } from "./render-cp";
import { renderCu } from "./render-cu";

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  const node = id.startsWith("pt-") ? renderCp(id, theme) : renderCu(id, theme);
  return (
    <div data-ps={MOCKS.find((m) => m.id === id)?.ps}>
      {node ?? <p className="k-root k-page">この状態はまだありません</p>}
    </div>
  );
}
