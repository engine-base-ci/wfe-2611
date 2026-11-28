"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 4（F3 使い始めの準備の残り：預けたログイン情報）の下絵のモックの索引（部品先行・枝 c/段4）。1 行 ＝ 1 つの状態
export default function MockF3Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f3-title">
      <header className="k-page-head">
        <h1 id="mock-f3-title">段 4 のモック（預けたログイン情報）</h1>
        <p className="k-desc">本番と同じ部品で並べた画面。幅を変えて見る（375・768・1440）</p>
      </header>
      <section aria-label="credentials">
        <h2>credentials</h2>
        <ul>
          {MOCKS.map((m) => (
            <li key={m.id}>
              <Link href={`/dev/mock/f3/${m.id}`}>{m.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
