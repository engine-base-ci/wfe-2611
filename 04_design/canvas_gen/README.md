# canvas_gen ── キャンバスの画面を作る・直すスクリプト

`04_design/canvas/*.dc.html`（Claude のデザインのキャンバスの画面）を作り、全部の画面にそろえの処理をかけるスクリプト。

## 正本はどれか

- **画面の正本は `04_design/canvas/*.dc.html`**。スクリプトは、そこにある画面を読んで作り直したり、上から直したりする。何もない所から全部を作り直すものではない（チケットの画面などは、前の段の画面を土台にして少しずつ直してきた）
- **値（色・文字・角丸）の正本は `04_design/DESIGN-kaname.md`**。`tokensnap.py` が画面をその段に寄せる
- 書き出し先は既定で `04_design/canvas/`。別の場所に出すときは `KANAME_CANVAS=/path/to/dir/` を付ける

## いつもの流れ

```bash
cd 04_design/canvas_gen
python3 op.py            # 例：運営の画面を作り直す（直したい所のスクリプトを回す）
python3 shellfix.py      # 全部の画面にそろえの処理をかける（必ず最後に回す）
```

`shellfix.py` は次を順に回す。

| 順 | スクリプト | すること |
|---|---|---|
| 1 | `shellfix.py` | 左のバー・上の帯・開閉・右のパネルを全部の画面でそろえる（顧客の画面と運営の画面でバーの中身が変わる） |
| 2 | `edwire.py` | 「直す・足す」の小窓へのつなぎと、はじめて使うときの見え方 |
| 3 | `linkfix.py` | 行き先のない所（`href="#"`）を 0 にする。画面へつなぐ／その場の操作の印／外のページ。古い呼び方をそろえる（D-128.74） |
| 4 | `tokensnap.py` | 色・角丸・文字の大きさを正本の段に寄せる（D-128.75） |
| 5 | `k219.py` の `after_shellfix()` | 全部の画面に同じに掛けた所のうち、絵ごとに違う所を直す（承認待ちが空の絵のバーの件数の印・「あとで」の絵のバーをはじめて入ったときの形に）。shellfix.py が最後に呼ぶ |

## 画面のまとまりとスクリプト

| スクリプト | 画面 |
|---|---|
| `room.py` `boards.py` `boards2.py` | 分身の部屋（Room*）・チケットの動き（St*） |
| `td.py` `td2.py` `talk.py` `talk2.py` `wire.py` | チケットの詳細から開くもの（Td*）とスレッド |
| `lists.py` `homes.py` | 一覧・承認待ち・カレンダー・ガント（Ls* Ap* Cal* Gt*） |
| `ws.py` | ワークスペースの管理（Ws*） |
| `kn.py` | ナレッジ（Kn*） |
| `cu.py` | 取引先とクライアントの場所（Cu* Cp*） |
| `me.py` | 自分の設定（Me*） |
| `auth.py` | ログイン・登録（Auth*） |
| `on.py` `err.py` | はじめて・空・失敗・エラー（On* Err*） |
| `k219.py` | キャンバスに絵が無かった状態の絵（AuthVerifying など。帯の 4 枚・StCompleteModal・MePCInstalled は k257.py に移した・UiDisabled・OnHomeLater）と、見比べの 1 枚（04_design/canvas-review/K-219.html）。最後に shellfix.py を回す |
| `k257.py` | 詳細の形の 7 枚（TicketDetail と帯の絵 St*。TicketDetail を土台に帯だけを替える・幅 1023 以下は右のパネルを本文の下に）・小窓 3 枚（StApproveModal・StReturnModal・StCompleteModal を 1 枚に 1 つ）・承認待ち（Approvals）・PC をつなぐの 3 枚（EdPC・MePC・MePCInstalled。今の画面に在る操作を描き足す）と、見比べの 1 枚（04_design/canvas-review/K-257.html）。これらの絵の持ち主は k257.py なので、me.py・ed.py・k219.py は書かない。K257_NO_SIDEFILES=1 で絵だけを書く。最後に shellfix.py を回す |
| `mb.py` | スマホ（Mb*） |
| `ed.py` `ed2.py` | 直す・足す の小窓（Ed*） |
| `op.py` | 運営と、顧客の側の 困ったとき・お知らせ・請求書（Op* Me* Ws*） |
| `ov.py` `subnav.py` `topbar.py` | 共通の部品（ボタン・小窓・2 つめのパネル） |

`base/` と `TicketDetail.base*.html` は、作り直すときの土台の画面。

## 確かめ方

```bash
python3 scripts/ci/canvas_design_gate.py                     # 値：中で design_gate.py --no-components を掛け、D1〜D4（色・書体・角丸・文字）が 0 件。D6 は知らせ
python3 scripts/ci/canvas_design_gate.py --canvas <写しの置き場>  # 写し（KANAME_CANVAS）で作り手を流したとき（同じく --no-components）
pnpm --filter @kaname/web exec playwright test tests/k/k254-canvas-layout.spec.ts   # 幅：375・768・1440 で横溢れ 0・潰れた箱 0・幅 767 以下の入力欄 16px
```

- 値の検査は design_gate.py をキャンバスに掛ける（--no-components）。赤なら、どの絵がどの値で赤かを絵ごとに出す。CI の spec の組（G71）で毎回流れる。D5 は掛けない（キャンバスの絵は部品のクラスを持たない・部品とキャンバスの突き合わせは G70）。D6（正本にあって絵が使っていない色）は、データ色の残りや会話のコードの色分けなど、絵に出ないものだけのはず
- 文字の大きさは正本の段だけ。段の外（22px・26px など）は `tokensnap.py` の SIZE で段に寄せる（22・26 は h1 の 20px・K-254）
- 幅 767 以下の入力欄は 16px（D-144.7）。`shellfix.py` が全部の絵の頭の style に 1 回だけ足す（kn-narrow）。スマホの絵の外枠（390px）は狭い幅で画面の幅に縮む。設定などの 2 つめの左の列（kn-sub）は幅 767 以下で本文の上に折り返す
- 今の時点で直せない絵の幅は台帳 `scripts/ci/canvas_layout_ledger.json` に理由つきで載せる。台帳は減らすだけで、直った絵の行は消す（幅の試験が赤にする）。段 1 の絵（fidelity.json の組の絵）は載せない

キャンバスに出すときは、`canvas.json`（ページ・画面の置き場所・メモ）も一緒に出す。出す前に、キャンバスで人が動かした分がないか、公開済みの `canvas.json` を読んで確かめる。
