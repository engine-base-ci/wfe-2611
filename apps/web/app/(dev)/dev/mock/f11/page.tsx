"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 12（F11 ゲストと回す）の下絵の索引。1 行 ＝ 1 つの状態（製品の時点つき）
export default function MockF11Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f11-title">
      <header className="k-page-head">
        <h1 id="mock-f11-title">段 12 のモック（ゲストと回す）</h1>
        <p className="k-desc">
          本番と同じ部品で並べたゲストを招く小窓・届いた依頼・チケットをゲストに見せる・ゲストの場所。幅を変えて見る（375・768・1440）
        </p>
      </header>
      <ul>
        {MOCKS.map((m) => (
          <li key={m.id}>
            <Link href={`/dev/mock/f11/${m.id}`}>{`${m.no} ${m.label}`}</Link>（{m.ps}）
          </li>
        ))}
      </ul>
    </main>
  );
}
