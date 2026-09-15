---
name: Kaname
colors:
  # Primary — 要（中心・収束）
  primary: "#22345C"
  on-primary: "#FFFFFF"
  primary-container: "#DCE4F2"
  on-primary-container: "#101C33"
  # Secondary — 補助操作
  secondary: "#186F69"
  on-secondary: "#FFFFFF"
  secondary-container: "#CFEAE7"
  on-secondary-container: "#0A3330"
  # Tertiary — AI 由来を示す
  tertiary: "#6D4AA6"
  on-tertiary: "#FFFFFF"
  tertiary-container: "#E9E0F5"
  on-tertiary-container: "#33235C"
  # Surface
  surface: "#F7F8FA"
  on-surface: "#131B27"
  surface-variant: "#E9ECF1"
  on-surface-variant: "#4A5563"
  # Error
  error: "#B91C1C"
  on-error: "#FFFFFF"
  # Neutral
  neutral: "#8A94A3"
  on-neutral: "#131B27"
typography:
  headline-display:
    fontFamily: "M PLUS 2"
    fontSize: 72px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "M PLUS 2"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: "M PLUS 2"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.25
  body-lg:
    fontFamily: "M PLUS 2"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0.01em
  body-md:
    fontFamily: "M PLUS 2"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "M PLUS 2"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: "M PLUS 2"
    fontSize: 14px
    fontWeight: 600
    letterSpacing: 0.04em
  label-md:
    fontFamily: "M PLUS 2"
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 0.05em
  label-sm:
    fontFamily: "M PLUS 2"
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.06em
  metric-lg:
    fontFamily: "M PLUS 2"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.02em
    fontVariantNumeric: tabular-nums
  metric-md:
    fontFamily: "M PLUS 2"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.01em
    fontVariantNumeric: tabular-nums
  metric-sm:
    fontFamily: "M PLUS 2"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    fontVariantNumeric: tabular-nums
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  2xl: 96px
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 12px
  xl: 20px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    border: "1.5px solid {colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-inverted:
    backgroundColor: "{colors.on-primary}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.surface-variant}"
  input:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# Kaname Design System

## Overview

**「要（かなめ）── バラバラのものが、一点に集まる」**

Kaname は、会社の目標を人間と AI 社員の両方で達成する運営基盤。営業も経理も CS も、人間も AI も、外部ツールも、すべてが一つの定義に集まる。扇の要 ── 抜けると全部バラバラになる中心の金具 ── がブランドの核である。

このデザインシステムは **業務データを長時間見るための情報設計**として組む。読み物ではなく、目標・台帳・承認・タスクが密度高く並ぶ画面が主戦場になる。したがって装飾を削り、余白と罫線で構造を出し、数値と状態が一目で読めることを最優先する。

姉妹製品 Atelier（工房の静謐・暖かい生成り紙）とは意図的に差別化する。Atelier が「作る場所」なら Kaname は「束ねる中心」であり、扱うものも読み物から数値へ移る。ただし ENGINE BASE の共通作法 ── **絵文字を使わず Lucide で統一する / Material Design 3 の役割ベース命名 / 日本語主体** ── は揃える。

**Design Principles**

1. **数値が主役（Numbers First）** ── 目標の進捗・金額・件数がこの製品の中身。数値は本文と同じ書体で組み、桁だけを揃える。装飾が数値を邪魔しない。
2. **色は二層に分ける（Two Color Layers）** ── システム色（操作・状態）とデータ色（部署・台帳の識別）を混ぜない。混ぜると「オレンジは経理か、それとも警告か」が読めなくなる。
3. **色だけで意味を伝えない（Never Color Alone）** ── 状態には必ずアイコンとテキストを添える。データ色には必ずラベルを添える。色覚特性に依存しない。
4. **AI 由来が一目で分かる（AI is Visible）** ── AI が提案したもの・AI が作ったものは Tertiary（バイオレット）で示す。人が決めたものと AI が提案したものを混同させない。
5. **影より罫線（Rules over Shadows）** ── 密度の高い画面で影を多用すると濁る。境界線と余白で構造を出す。

## Colors

Material Design 3 の役割ベース命名を採用する。加えて Kaname 固有の **2 層構造** を持つ。

### システム色（UI の操作と状態）

#### Primary — `#22345C` ディープインディゴ
**要（中心）の色。** 主要アクション、アクティブなナビゲーション、リンク、目標の達成バー。1 画面に 1 つの Primary ボタンが原則。ENGINE BASE のロゴが持つ黒の硬質さを保ちながら、SaaS として色を持たせた。

#### Secondary — `#186F69` ティール
補助的なアクション、AI 社員に関わる要素、選択状態。Primary を引き立てる位置づけ。

#### Tertiary — `#6D4AA6` バイオレット
**AI 由来を示す専用色。** AI の提案・AI が生成した下書き・AI が書いた改訂案に使う。状態色（緑・橙・赤・青）のどれとも色相が重ならないため、「AI のものか」を状態と独立して読める。

#### Error — `#B91C1C`
破壊的操作の確認、入力エラー、失敗した実行。

### 状態色（semantic）

| 状態 | 色 | 使い方 |
|---|---|---|
| 成功 | `#166534` | 承認済み・完了・習得済み |
| 警告 | `#B45309` | 期限接近・要確認・学習中 |
| 危険 | `#B91C1C` | 期限超過・失敗・未達 |
| 進行中 | `#1D4ED8` | 実行中・承認待ち |

**必ず塗りのピル ＋ Lucide アイコン ＋ テキスト**で表示する。色だけで状態を伝えない。

### データ色（部署・台帳・業務の識別）

ロゴの「多色の線が一点に集まる」を画面上で表現する 6 色。**意味を持たない。ただの区別。**

| 色 | 値 | 想定 |
|---|---|---|
| indigo | `#2F4B7C` | 営業 |
| teal | `#186F69` | 経理 |
| amber | `#7E570D` | CS |
| coral | `#A34A3E` | 人事 |
| sage | `#516F46` | 制作 |
| plum | `#6B3F5E` | 外部ツール |

**使い方の制約（これが色の混同を防ぐ）**

- データ色は **4px の点** または **2px の左罫** としてのみ使う。**塗りに使わない**
- **必ずラベル（部署名・台帳名）を添える**。色だけで識別させない
- 顧客が自分で割り当てる。運営が意味を固定しない

```
   状態色  ▸ 塗りのピル ＋ アイコン ＋ テキスト   （面で見せる）
   データ色 ▸ 4px の点 ／ 2px の左罫 ＋ ラベル     （点と線で見せる）
   → 同じ色相でも、面積と形が違うので読み分けられる
```

### Surface & Neutral

サイドバーは `#EEF0F4`（本文 `surface` より半段暗い中間色）に右の罫線 1 本。文字は `on-surface-variant`、選択中は白い面＋罫線で `on-surface`。紺（primary）の面は使わない（D-072）。

`surface` は **`#F7F8FA`** ── わずかに寒色寄りのオフホワイト。Atelier の暖かい生成り紙と対照的に、数値と表の可読性を優先した。純白より目が疲れず、暖色より数字が締まる。

### WCAG コントラスト（全ペア検証済み）

| ペア | 比率 | 判定 |
|---|---|---|
| primary / on-primary | 12.25:1 | AAA |
| secondary / on-secondary | 5.97:1 | AA |
| tertiary / on-tertiary | 6.60:1 | AA |
| surface / on-surface | 16.28:1 | AAA |
| surface / on-surface-variant | 7.13:1 | AAA |
| surface-variant / on-surface | 14.61:1 | AAA |
| error / on-error | 6.47:1 | AA |
| 状態色（4 色すべて） | 4.73〜7.13:1 | AA 以上 |
| データ色（6 色すべて） | 5.32〜8.17:1 | AA 以上 |
| ダークモード（6 ペア） | 7.66〜15.29:1 | AAA |

**全ペアが AA（4.5:1）以上。** データ色の amber は初案 `#9C6C12` が 4.33:1 で不合格だったため `#7E570D` に修正した。

## Typography

**M PLUS 2 の単一書体。見出し・本文・ラベル・数値をすべて 1 書体で組む。**

### なぜ 1 書体か

数値だけ別書体（等幅など）にすると、日本語の文の中に数字が現れたとき **数字だけが浮く**。Kaname は「目標 12,000,000 に対して 69.4%」のように、文と数値が同じ行に混ざる画面が中心なので、2 書体構成は構造的に破綻する。1 書体に統一すれば、この問題は起こりようがない。

桁の揃えは書体ではなく **設定**で担保する。詳細は下の「数値の組み方」。

### M PLUS 2 を選ぶ理由

| 理由 | 内容 |
|---|---|
| 可変ウェイト 100〜900 | 書体を増やさずに、見出し 700 / 数値 600 / ラベル 600 / 本文 400 の階層が作れる |
| 字面が大きい | テーブルの 13px でも潰れない。表と数字が主役の画面で効く |
| 数字が元から等幅 | 実測で全字同一幅。等幅書体に頼らず桁が揃う |
| 骨格が Noto と異なる | 姉妹製品 Atelier（Noto Sans JP）と製品として区別がつく |

**採用しなかった案**

| 案 | 却下理由 |
|---|---|
| Inter ＋ Noto Sans JP | 数字だけ Inter になり、「数字が浮く」問題が残る |
| BIZ UDPGothic | 太さが 400 / 700 の 2 段階しかなく、見出し・数値・ラベルの階層が作れない |
| Zen Kaku Gothic New | 角の丸みが数値主体の管理画面には緩い |
| Noto Sans JP 単体 | 妥当だが、Atelier と同一で製品の区別がつかない |

### 数値の組み方

**M PLUS 2 の数字は元から全字が同じ幅を持つ。** 実測で確認済み（`111,111,111` と `888,888,888` が同一幅。Helvetica や Georgia では一致しない）。したがって等幅書体を使わなくても桁は揃う。

| 指定 | 役割 | 必須か |
|---|---|---|
| `text-align: right` | 表の数値列を右寄せにする。**桁を縦に合わせているのはこれ** | **必須** |
| `font-variant-numeric: tabular-nums` | 数字1文字の幅を等しくする | 保険（M PLUS 2 では効果なし。将来フォントを差し替えたときに効く） |

つまり**右寄せを忘れると桁は揃わない**。幅の設定だけでは揃わない。

`metric-lg` / `metric-md` / `metric-sm` の 3 スケールを数値専用に定義してある。実装ではこのトークンを使い、サイズを直に書かない。

### Scale

`headline-display` → `headline-lg` → `headline-md` → `body-lg` → `body-md` → `body-sm` → `label-lg` → `label-md` → `label-sm`

数値は独立系統：`metric-lg`（40px / KPI）→ `metric-md`（26px / カード内）→ `metric-sm`（14px / 表のセル）

スケールを飛ばして使わない（display → md のジャンプは禁止）。

## Layout

8px ベースラインのスペーシングシステム。

### Spacing Scale
- `xs` 4px — アイコン内マージン、データ色の点とラベルの間隔
- `sm` 8px — コンパクトなスタック、テーブルのセル内
- `md` 16px — 標準コンポーネント内パディング
- `lg` 24px — カードパディング、セクション内間隔
- `xl` 48px — セクション間
- `2xl` 96px — ページセクション間

### Grid（マルチデバイスで機能同等が必須）

| ブレークポイント | カラム | ガター | マージン | ナビ |
|---|---|---|---|---|
| 1440px+ | 12 | 24px | 48px | 左サイドバー（展開）。三画面の画面（今日・承認待ち・タスク）は 72px のレール＋一覧 380px（1 行 48px・罫線）＋中身 640px 以上＋自分のAIのパネル 340px。列ごとに別々にスクロール（D-072） |
| 1180〜1439px | 12 | 24px | 32px | 左サイドバー（展開）。三画面の画面はレール |
| 1024〜1179px | 12 | 24px | 32px | 左サイドバー（アイコンのレール） |
| 768〜1023px | 8 | 16px | 24px | 左サイドバー（アイコン） |
| 375〜767px | 4 | 16px | 16px | **下部タブバー** |
| 320〜374px | 4 | 12px | 12px | 下部タブバー |

**スマホで機能が落ちてはならない。** とりわけ「承認」と「会話」は外出先で使われる中心機能であり、スマホで完結できなければ意味がない。

**横スクロールは `document.scrollWidth - clientWidth` で数値検証する。** 目視では気づけない。

## Elevation & Depth

**影はほぼ使わない。** 密度の高い業務画面で影を多用すると全体が濁り、数値が沈む。構造は境界線 `1px solid {colors.surface-variant}` と余白で出す。

例外は 3 つだけ。

| レベル | 影 | 用途 |
|---|---|---|
| 0 | なし | カード、テーブル、パネル（既定） |
| 1 | `0 1px 2px rgba(19,27,39,0.06)` | ホバー時のカード、固定ヘッダー |
| 2 | `0 8px 24px rgba(19,27,39,0.12)` | モーダル、ドロップダウン、ポップオーバー |

## Shapes

**標準の角丸（6px）。** ラグジュアリーでもポップでもない、業務ツールの実直さ。Atelier より 2px 小さく取り、より道具らしい印象にする。

- `none` (0px) — テーブル、フルブリードの帯
- `sm` (4px) — タグ、バッジ、データ色の点
- `md` (6px) — **ボタン、入力、チップ**
- `lg` (12px) — カード、モーダル
- `xl` (20px) — シート、大型コンテナ
- `full` (pill) — 状態ピル、アバター、カウントバッジ

## Components

### Buttons
- **Primary** — 最重要アクション。**1 画面に 1 つ**が原則（承認画面なら「承認する」）
- **Secondary** — 重要だが補助的（「直す」）
- **Outlined** — 代替アクション、破壊的操作の確認（「却下」）
- **Inverted** — Primary 背景上での使用

### Status Pill（状態ピル）
`rounded.full` の塗り ＋ Lucide アイコン ＋ テキスト。**アイコンとテキストを省略しない。**

### Data Dot / Rail（データ識別）
4px の円、または 2px の左罫。**必ずラベルを伴う。**

### AI Marker（AI 由来）
Tertiary の細い左罫、または `tertiary-container` の淡い背景 ＋ Lucide の `sparkles` 相当のアイコン。「AI が提案しました」を明示する。

### Metric（数値表示）
`metric-*` トークン ＋ `tabular-nums` ＋ 表では `text-align: right`。目標に対する実績は「目標 12,000,000 に対して 69.4%」のように**ラベル付きの日本語**で書き、進捗バーを併記する。「8,330,000 / 12,000,000」のようなスラッシュだけの分数表記は使わない（何が実績で何が目標か読み手に伝わらないため）。

### Cards
`surface` 背景 ＋ `1px solid surface-variant` の罫線。影は使わない。

### Inputs
`surface-variant` 背景でフォームフィールドを背景から浮かせる。フォーカスは `2px solid primary` のアウトライン。

## Do's and Don'ts

### Do's
- **表の数値列には必ず `text-align: right` を指定する**。桁を縦に揃えているのはこれ（`tabular-nums` は保険）
- **数値を別書体で組まない**。文中の数字が浮く
- **状態は色 ＋ アイコン ＋ テキストの 3 点セット**で示す
- **データ色には必ずラベルを添える**。色だけで部署を識別させない
- **AI 由来のものは Tertiary で明示する**。人が決めたものと混同させない
- スペーシングは必ず `spacing` トークンを使う
- コンポーネントはトークン参照 `{colors.primary}` を使い、直接 hex を書かない
- スマホ幅で機能が落ちていないか、**横スクロール量を数値で測る**

### Don'ts
- **状態色とデータ色を同じ扱いで使わない**（データ色を塗りに使わない）
- **Primary を装飾目的で多用しない**。1 画面 1 つ
- **影で階層を作らない**。罫線と余白で出す
- **絵文字を使わない**。アイコンは Lucide で統一する
- タイポグラフィスケールを飛ばして使わない
- `surface` 上に `surface-variant` を重ねてコントラストを下げない
- 数値を本文フォント（プロポーショナル）で組まない


---

## 根拠となる決定（トレーサビリティ）

> 正本は `01_hearing/決定ログ_進行中.md`。検査: `python3 scripts/ci/trace_gate.py`

| 決定 | 何を決めたか | この文書のどこに効いているか |
|---|---|---|
| D-052 | デザインシステム確定。Primary #22345C・M PLUS 2 単一書体・色の二層分離（状態色は面／データ色は点と線）・影より罫線・数値列は右寄せ | 全体 |
| D-023 | ロゴ＝バラバラの色（業務／ツール／メンバー）がひとつの中心（要）に留められる。データ色6色の根拠 | Colors（データ色 6色） |
| D-011 | 製品名は Kaname（要） | name / Overview |
| D-053 | 画面は行為から導出する。デザインシステムは画面数・種類に依存しない | Components（1画面1主アクションの階層） |
| D-070 | 本文は幅 1180 以上で 720px を下回らない | Layout（Grid） |
| D-071 | 本文 15px・見出し 24/20/18・1px の箱を並べず罫線 1 本と余白で段を区切る | Typography / Elevation |
| D-072 | 手本は Linear / Notion。三画面（一覧｜中身｜自分のAI）。サイドバーは中間色 `#EEF0F4`＋罫線、選択中は白い面。三画面の画面ではレール 72px | Layout（Grid）/ Colors（Surface）/ Components（Sidebar） |
| D-073 | 役割ごとに中身が変わる（担当者・閲覧のみ・運営も自分の画面を持つ）。錠前だけの画面は作らない | Components（`data-roles` の塊。トークン追加なし。錠前の空状態は既存の empty） |
| D-074 | 抜ける・退会の依存を全オブジェクトで見せる | Components（依存の表は既存の表・札の色 4 種：消える／残る／移る／止まる） |
| D-075 | 問い合わせ・お知らせ・稼働状況・請求 | Components（状態の点＝既存の st-success／warning／danger。トークン追加なし） |
| D-076 | アカウント・会社の設定・取り込み・外部サービス | Components（フォーム・落とす箱・カードの縁色は既存トークン。追加なし） |
| D-077 | 運営の対応は会社の 1 社（8 面）の中で | Layout（第2ナビの段 `data-sec` で 8 面。トークン追加なし） |

> 2026-09-15 凍結時の確認：D-073〜D-077 で新しい色・書体・間隔・角丸は増えていない（新画面は既存トークンと画面内 CSS だけで描けた）。

## 決めたことの文の反映（機械追記）
- D-011.1 製品名
- D-011.2 由来と Hub の一致
- D-023.1 ロゴのコンセプト
- D-052.1 色
- D-052.2 色の二層分離
- D-052.3 コントラスト
- D-052.4 書体
- D-052.5 数値の組み方
- D-052.6 分数表記の禁止
- D-052.7 形
- D-052.8 アイコン
| D-079 | 目標と施策のタイムラインは svar-gantt。棒＝期間・線＝前後関係・ひし形＝検証。棒を押すと右に詳細。1023 以下は切り替え | Components（タイムライン：棒は primary-container、進みは primary、検証のひし形は tertiary。詳細パネルは card と同じ縁と角丸） |
