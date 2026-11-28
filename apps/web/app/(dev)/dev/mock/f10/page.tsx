"use client";
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 11 の下絵の索引。1 行 ＝ 1 つの状態
export default function MockF10Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f10-title">
      <header className="k-page-head">
        <h1 id="mock-f10-title">段 11 のモック（人とアカウントを管理する）</h1>
      </header>
      <ul>
        {MOCKS.map((m) => (
          <li key={m.id}>
            <Link href={`/dev/mock/f10/${m.id}`}>{`${m.no} ${m.label}`}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
