"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 3（F2 招かれて参加する）の詳細のモックの索引（部品先行・枝 c/段3）。1 行 ＝ 1 つの状態。押すとその状態だけを開く
export default function MockF2Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f2-title">
      <header className="k-page-head">
        <h1 id="mock-f2-title">段 3 のモック（F2 招かれて参加する）</h1>
        <p className="k-desc">本番と同じ部品で並べた画面。幅を変えて見る（375・768・1440）</p>
      </header>
      <section aria-label="invite-accept">
        <h2>invite-accept</h2>
        <ul>
          {MOCKS.map((m) => (
            <li key={m.id}>
              <Link href={`/dev/mock/f2/${m.id}`}>{m.label}</Link>（{m.ticket}）
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
