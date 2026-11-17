import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 2（F1 の残り）の詳細のモックの索引（部品先行・枝 c/段2）。1 行 ＝ 1 つの状態。押すとその状態だけを開く
export default function MockF1Index() {
  const screens = ["login", "password-reset", "mfa-setup", "help"] as const;
  return (
    <main className="k-root k-page" aria-labelledby="mock-f1-title">
      <header className="k-page-head">
        <h1 id="mock-f1-title">段 2 のモック（F1 の残り）</h1>
        <p className="k-desc">本番と同じ部品で並べた画面。幅を変えて見る（375・768・1440）</p>
      </header>
      {screens.map((s) => (
        <section key={s} aria-label={s}>
          <h2>{s}</h2>
          <ul>
            {MOCKS.filter((m) => m.screen === s).map((m) => (
              <li key={m.id}>
                <Link href={`/dev/mock/f1/${m.id}`}>{m.label}</Link>（{m.ticket}）
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
