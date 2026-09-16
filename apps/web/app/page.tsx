// 入口（/）。画面（signup／login／today …）は T-U-* が flow.json の route どおりに足す。ここは土台の存在確認（GET / が 200）と 4 幅の測定の的
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs tracking-widest text-on-surface-variant uppercase">ENGINE BASE</p>
      <h1 className="mt-2 text-3xl font-bold text-primary">Kaname</h1>
      <p className="mt-4 text-on-surface-variant">画面は準備中です。API は動いています。</p>
    </main>
  );
}
