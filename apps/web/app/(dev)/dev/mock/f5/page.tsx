"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 6（F5 AI に任せて、確かめて、終える）の下絵のモックの索引（部品先行・枝 c/段6）。1 行 ＝ 1 つの状態（製品の時点つき）
export default function MockF5Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f5-title">
      <header className="k-page-head">
        <h1 id="mock-f5-title">段 6 のモック（AI に任せて、確かめて、終える）</h1>
        <p className="k-desc">本番と同じ部品で並べた画面。幅を変えて見る（375・768・1440）</p>
      </header>
      <section aria-label="状態の一覧">
        <h2>状態の一覧</h2>
        <ul>
          {MOCKS.map((m) => (
            <li key={m.id}>
              <Link href={`/dev/mock/f5/${m.id}`}>{m.label}</Link>（{m.screen}・{m.ps}）
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
