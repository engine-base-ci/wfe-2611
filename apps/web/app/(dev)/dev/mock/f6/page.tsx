"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 7（F6 自分で進める・話す・決める）の下絵のモックの索引（部品先行・枝 c/段7）。1 行 ＝ 1 つの状態（製品の時点つき）
export default function MockF6Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f6-title">
      <header className="k-page-head">
        <h1 id="mock-f6-title">段 7 のモック（自分で進める・話す・決める）</h1>
        <p className="k-desc">本番と同じ部品で並べたチケットの詳細。幅を変えて見る（375・768・1440）</p>
      </header>
      <section aria-label="tickets">
        <h2>tickets</h2>
        <ul>
          {MOCKS.map((m) => (
            <li key={m.id}>
              <Link href={`/dev/mock/f6/${m.id}`}>{m.label}</Link>（{m.ps}）
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
