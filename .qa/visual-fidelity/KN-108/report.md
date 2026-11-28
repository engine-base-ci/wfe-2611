# 見た目の突き合わせ（KN-108・2026-11-04）

比べたもの：キャンバス `04_design/canvas/Main.dc.html` と、新しい画面の見本 `/dev/k/showcase`（外枠＋部品＋4 つの状態）。幅 1440・明るいテーマ。
回し方：`node scripts/ci/visual_fidelity.mjs .qa/visual-fidelity/KN-108/pairs.json`（next dev を 3123 で立てておく）。数の結果は `result.json`、絵は `canvas.png`・`app.png`（ほかに `app-dark.png`・`app-375.png`・`app-375-dark.png`）。

**判定：合格（BLOCK 0・HIGH 0）**

## 段 1：トークン（正本 DESIGN-kaname.md と、新しい画面の styles/k-tokens.css）

| 項目 | 正本 | 新しい画面 | 判定 |
|---|---|---|---|
| 色（明るい：colors・syntax・state・data） | 66 | 66（値も全部同じ） | OK |
| 色（暗い：dark の同じ 4 つ） | 66 | 66（値も全部同じ） | OK |
| 文字の段 | 12 | 12（大きさ・行の高さ・太さ） | OK |
| 角丸の段 | 8 | 8 | OK |
| 余白の段 | 6 | 6 | OK |
| 部品の値（components） | 16 | 16（--k-c-*・色はテーマに付いていく） | OK |
| 書体 | Noto Sans JP | Noto Sans JP（@fontsource-variable で画面と同じ所から配る） | OK（このチケットで直した） |
| 部品に直接書いた色（#hex・rgb()） | — | 0 件（`grep` と `apps/web/test/k-tokens.test.ts`） | OK |
| コントラスト（文字と地の 41 組） | AA | 明るい 4.53〜・暗い 6.36〜（`gen_tokens.py --web --check`） | OK |

design_gate（新しい部品・`--part`）：

```
D1_色_正本に無い: {}  D2_書体_正本に無い: {}  D3_角丸_段に無い: {}  D4_文字_段に無い: {}
D5_部品: 検査していません（design-gate.json の component_selectors が無い）
D6: 一部だけ見ています（--part・製品全体は新しい画面がそろってから）
PASS
```

## 段 2：描いた画面どうし（同じ役割の要素の見た目の値・40 項目）

| 部品 | 比べた値 | 判定 |
|---|---|---|
| 左のバー | 幅 216・地・線・上の余白 | OK |
| 左のバーの今の項目 | 高さ 32・地（紺）・字の色・角丸 6・字 13・太さ 500・左の余白 | OK |
| 左のバーの項目 | 高さ・字の色・角丸・字 | OK |
| チケットを作る | 高さ 34・地・字の色・角丸 | OK |
| 上の帯 | 高さ 48・地・下の線・左の余白 24 | OK |
| 探す | 幅 280・高さ 32・角丸（丸）・地・線 | OK |
| 自分の顔 | 28・地・字の色・丸 | OK |
| 知らせの数 | 高さ 16・地（橙）・字の色 | OK |
| 本文の書体 | 書体の指定・字 13・字の色 | OK |
| 読み込んだ書体 | キャンバス：Noto Sans JP ／ 新しい画面：Noto Sans JP（Variable） | OK |

違う値：0 / 40。

## 見て分かった違い（数では出ないもの）

| 違い | 重さ | 扱い |
|---|---|---|
| 新しい画面は書体を読み込んでいなかった（名前だけ合っていて、端末の別の書体で描いていた） | HIGH | **直した**：@fontsource-variable/noto-sans-jp（OFL）を入れ、画面と同じ所から配る。CSP は font-src 'self' のまま |
| 会社の名前の「▾」が無い | LOW | 会社を切り替える仕組みのチケットで足す |
| 探す欄の「⌘K」の印が無い | LOW | 画面全体の検索（cmdk）のチケットで足す |
| 右のパネル：キャンバスの Main には無い／新しい画面は出す | — | 決まり（flow の assistant_panel：全部の作業画面に出す）のとおり。Main のキャンバスが古い |
| 横のはみ出し・字の縦折れ | — | 375・768・1024・1440 で 0（`apps/web/tests/k-shell.spec.ts`） |
