# Kaname UI ライブラリ候補 ── 画面を実装するときに何を借りるか（2026-09-11 調査）

> **2026-09-11 確定（D-067）。** 候補を並べて提示し、user「お願いします」で推奨（★）どおりに決定。反映先: `02_tech_stack/selected-stack.json` `frontend`、決定ログ §67、アーキテクチャ設計書 §3、自前実装リスト L9〜L10。
> 前提：フロントは Next.js 15（D-046〜）、会話 UI は AG-UI＋assistant-ui（D-057）、アイコンは Lucide 固定、絵文字禁止、
> デザイントークンは `04_design/DESIGN-kaname.md`（D-052）。モックの検査（hover／focus-visible／24px／コントラスト／11px／スマホ 16px）は
> 実装後も同じ治具で回す（`make_state_rig.py` 検査 4・5）。

---

## 0. 結論（推奨の組み合わせ）

| 領域 | 推奨 | 理由の要点 | 代替 |
|---|---|---|---|
| 部品の土台 | **shadcn/ui（Base UI 版）** | 2026-07 に shadcn の既定が Base UI になった。assistant-ui の CLI も既定が Base UI 版。同じ土台に揃うと二重のプリミティブを抱えない。コードを自分で持つので DESIGN.md のトークンをそのまま当てられる | shadcn（Radix 版）／React Aria Components／Mantine |
| 会話 | **assistant-ui**（決定済み D-057） | ストリーミング・ツール UI・添付・分岐・編集して送り直しを持つ。承認カード・受領・引用・失敗回復は自前（自前実装リスト L1〜L8） | CopilotKit（AG-UI 本家。基盤ごと抱えるので過剰）／Vercel AI Elements（AI SDK に寄る） |
| 図表 | **Recharts** | React 向け SVG の既定。shadcn の charts も Recharts 上。SSR で描ける。データ量は台帳の集計程度で十分 | ECharts（大量データ・Canvas）／visx（自由度、工数増）／Nivo |
| 表 | **TanStack Table**（決定済み） | 動的台帳の列定義をデータで持つのに合う（ヘッドレス） | AG Grid（重い・商用） |
| フォーム | **React Hook Form ＋ Zod** | 動的スキーマ（台帳・会社モデル）と OpenAPI 由来の型を Zod で共有できる | TanStack Form（新しい。型は強いが実績が浅い）／react-jsonschema-form（既定にしていたが、見た目の自由度が低い。**動的台帳の入力だけ**に限定して併用） |
| 通知（トースト） | **sonner** | shadcn の既定。受領カードの「取り消し」ボタンをトーストに載せられる | radix toast |
| コマンド（/・@） | **assistant-ui の composer ＋ cmdk** | 入力欄の補完は assistant-ui、画面全体の「どこへでも」検索は cmdk | kbar |
| 日付 | **react-day-picker** | shadcn の既定。日本語ロケール | — |
| 並べ替え・渡す（ドラッグ） | **pragmatic-drag-and-drop**（Atlassian） | タスクを「渡す」「引き取る」を列間ドラッグで。軽量・アクセシブル | dnd-kit（保守が緩やか） |
| 目標の木 | **自前（`<details>`＋roving tabindex）** | 層が可変（会社＞…＞個人＞AI 社員）で、可視範囲・配分・かけたものを行に持つ。既製の tree はこの列を持てない | react-arborist（仮想化が要るほど深くならない） |
| 仮想リスト | **TanStack Virtual** | 会話の履歴・証跡・台帳の長い一覧 | react-window |
| アイコン | **Lucide**（固定・全社ルール） | — | — |
| スタイル | **Tailwind v4（CSS-first）＋ DESIGN.md のトークンを `@theme` に写す** | 色・書体・間隔を 1 か所に。モックの `_tokens.py` と同じ値 | CSS Modules |

**土台を 1 つに揃える**のが一番の理由。shadcn（Base UI）＋ assistant-ui（Base UI 版）＋ Recharts（shadcn charts）＋ sonner ＋ react-day-picker は、
どれも shadcn の既定の組み合わせで、部品同士の見た目・フォーカス・キーボード操作が揃う。

---

## 1. 部品の土台（プリミティブ）── 4 案

| 案 | ライセンス | 形 | アクセシビリティ | 状態（2026-09） | 向き／不向き |
|---|---|---|---|---|---|
| **shadcn/ui on Base UI** ★ | MIT（コードを自分のリポジトリに持つ） | コピーして所有 | WAI-ARIA、MUI が専任で保守 | Base UI 1.6・週 600 万 DL。2026-07 から shadcn の既定 | 自分のトークンを当てやすい。**assistant-ui も既定が Base UI 版**で揃う |
| shadcn/ui on Radix | MIT | 同上 | 良い | WorkOS 買収後に更新が遅い部品あり（Combobox・複数選択）。shadcn は両方に出し続ける | 既存資産があるなら。新規で選ぶ理由は薄い |
| React Aria Components | Apache-2.0（Adobe） | ヘッドレス | 最も厳密 | shadcn の第 3 の土台として選べる（2026-07） | 国際化・日付・キーボードが強い。部品を全部自分で組む工数 |
| Mantine | MIT | スタイル済み・一式 | 良い | v8 系 | 早く作れるが見た目が Mantine になる。DESIGN.md と二重管理 |

- 参考：[shadcn/ui 2026-07 Base UI を既定に](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)／[shadcn/ui 2026-07 React Aria](https://ui.shadcn.com/docs/changelog/2026-07-react-aria)／[Radix vs Base UI（ShadcnDeck）](https://www.shadcndeck.com/blog/radix-vs-base-ui)／[Untitled UI の比較](https://www.untitledui.com/blog/react-component-libraries)

## 2. 会話（決定済み・補足）

| 案 | 何ができるか | Kaname で足りないもの |
|---|---|---|
| **assistant-ui** ★（D-057） | ストリーミング・ツール呼び出し UI・添付・分岐・編集して送り直し・提案チップ。Base UI 版／Radix 版 | 承認カード（中身全部）・受領＋取り消し・自信と引用・失敗種別の回復・3 層の絞り込み ＝ **自前 L1〜L8** |
| CopilotKit | AG-UI の本家。状態同期・生成 UI・エージェント連携まで | Kaname は経路を自前で持つ（関門 C3）ので基盤ごと抱えるのは過剰 |
| Vercel AI SDK + AI Elements | AI SDK に寄せると配線が少ない | 段階 1 は Bridge（本人 CLI）経路で、AI SDK のプロバイダ抽象を通らない |
| Deep Chat | Web Component、非 React 向け | 部品を分解できない（承認カードを差し込めない） |

- 参考：[2026 年に全 AI チャット UI を評価した記事](https://dev.to/alexander_lukashov/i-evaluated-every-ai-chat-ui-library-in-2026-heres-what-i-found-and-what-i-built-4p10)／[assistant-ui 代替の比較](https://designrevision.com/alternatives/assistant-ui)
- **入力欄の規則（D-066 に追記）**：日本語変換中の Enter は送らない（`isComposing` と `keyCode 229` の両方）。Enter で送る欄すべてに同じ規則。
  参考：[IME 中の Enter 誤送信の解説](https://dev.to/mahirhir/the-enter-key-that-submits-your-form-while-a-japanese-user-is-still-typing-4h6f)／[vercel-labs/agent-browser の同種の不具合](https://github.com/vercel-labs/agent-browser/issues/1379)

## 3. 図表

| 案 | 描画 | 向き | Kaname での判断 |
|---|---|---|---|
| **Recharts** ★ | SVG | React 向けの既定。shadcn charts の土台。SSR 可 | 目標の進み・かけたもの vs 出たもの・台帳の集計 ＝ 数百点まで。十分 |
| Apache ECharts | Canvas/SVG | 大量データ・リアルタイム | 証跡の長期グラフが要るまで不要。要るなら部分導入 |
| visx | SVG（低レベル） | 独自の可視化 | 目標の木の可視化を凝るなら候補。工数増 |
| Nivo | SVG/Canvas | 見た目の既定が良い | Recharts と役割が重なる |

- 参考：[LogRocket 2026 比較](https://blog.logrocket.com/best-react-chart-libraries-2026/)／[PkgPulse 比較](https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026)
- 注意：どの図表ライブラリも「読める図」にはしてくれない。**数値は必ず表でも出す**（グラフだけの画面を作らない・D-052 の数値列右寄せ）。

## 4. 実装時に守る作法（モックの検査をそのまま実装に持ち込む）

| 規則 | 検査 |
|---|---|
| 押せるものは全部 `:hover` と `:focus-visible` を持つ（`:focus` ではなく `:focus-visible`） | `make_state_rig.py` 検査 4 |
| 操作要素は 24px 以上（文中リンク・間隔の例外は WCAG 2.2 2.5.8 どおり）。スマホは 44px を目標 | 同上 |
| 文字のコントラスト 4.5:1（大きい文字 3:1）、11px 未満は使わない。無効な操作要素は対象外 | 検査 5 |
| スマホの入力欄は 16px（iOS の自動ズームを防ぐ） | 検査 5（幅 <768） |
| 骨組み（スケルトン）・回転は 200ms 遅らせて出し、最低 400ms 見せる | 実装時の L1 行 |
| `prefers-reduced-motion` を尊重する | トークン層に既定で入れた |
| 楽観的更新は失敗時に戻すか「取り消し」を出す（受領カードと同じ） | D-066 |

- 参考：[Vercel Web Interface Guidelines](https://vercel.com/design/guidelines)／[UXPin ボタンの状態](https://www.uxpin.com/studio/blog/button-states/)

## 5. 決めたこと（2026-09-11・D-067）

1. 部品の土台：**shadcn/ui（Base UI 版）**（採らなかった案：Radix 版／React Aria／Mantine）
2. フォーム：**React Hook Form＋Zod** を主にし、react-jsonschema-form は動的台帳の入力欄だけ
3. 図表：**Recharts**（証跡の長期グラフで ECharts を部分導入する余地は残す）
4. ドラッグ：**pragmatic-drag-and-drop**（タスクを渡す・引き取る）

→ 4 件とも推奨どおり確定。`selected-stack.json` と決定ログ §67 に反映済み。

## 6. 見え方（D-068）── カレンダーとタイムラインは候補のみ（実装の段で比較して決める）

| 見え方 | 使う層 | 決定 | 候補（未定） |
|---|---|---|---|
| リスト | 今日・仕事 | TanStack Table（決定済み） | — |
| カンバン | 仕事（列＝状態 or 担当）・案件（列＝工程） | pragmatic-drag-and-drop（D-067） | — |
| カレンダー（時間割） | 今日・仕事（週） | **未定** | FullCalendar（MIT 版。プレミアム機能は使わない）／schedule-x（MIT・軽い）／react-big-calendar（MIT・実績長い） |
| タイムライン（ガント） | 施策・目標 | **未定** | svar-gantt（MIT）／frappe-gantt（MIT・軽い）／vis-timeline（MIT/Apache・依存関係の線あり） |

決め方：①依存関係の線が要るか（施策→検証のひし形）②タブレット横で使えるか③DESIGN.md のトークンをそのまま当てられるか、の 3 点で比較表を出す。

> 2026-09-15 凍結時の確認（D-073〜D-077）：運営の 8 面・請求・問い合わせ・取り込み・外部サービスは既存の表・カード・会話の部品で描けた。追加の部品は無し。ガント（タイムライン）は user「完璧にいいものにして、詳細も見れる状態に」→ **svar-gantt（MIT）に決定（D-079）**。棒を押すと右に詳細。
