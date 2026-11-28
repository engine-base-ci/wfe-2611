"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 4（F3）の「PC と使った量」の PC の行に足す部品の下絵の索引（部品先行・枝 c/段4）。1 行 ＝ 1 つの状態
export default function MockF3PcIndex() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f3-pc-title">
      <header className="k-page-head">
        <h1 id="mock-f3-pc-title">段 4 のモック（PC の行：Claude Code・AI が使うブラウザ・PC を外す）</h1>
        <p className="k-desc">本番と同じ部品で並べた画面。幅を変えて見る（375・768・1440）</p>
      </header>
      <section aria-label="bridge-setup">
        <h2>bridge-setup</h2>
        <ul>
          {MOCKS.map((m) => (
            <li key={m.id}>
              <Link href={`/dev/mock/f3-pc/${m.id}`}>{m.label}</Link>（{m.ticket}）
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
