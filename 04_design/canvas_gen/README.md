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
| `mb.py` | スマホ（Mb*） |
| `ed.py` `ed2.py` | 直す・足す の小窓（Ed*） |
| `op.py` | 運営と、顧客の側の 困ったとき・お知らせ・請求書（Op* Me* Ws*） |
| `ov.py` `subnav.py` `topbar.py` | 共通の部品（ボタン・小窓・2 つめのパネル） |

`base/` と `TicketDetail.base*.html` は、作り直すときの土台の画面。

## 確かめ方

```bash
python3 scripts/ci/design_gate.py --design 04_design/DESIGN-kaname.md --mocks "04_design/canvas/*.dc.html" --no-components
```

D1〜D4（色・書体・角丸・文字）が 0 件であること。キャンバスの絵は部品のクラス（.k-btn など）を持たないので D5 は掛けない（--no-components・部品とキャンバスの突き合わせは G70）。D6（正本にあって画面が使っていない色）は、データ色の残りや会話のコードの色分けなど、画面の見本に出ないものだけのはず。

キャンバスに出すときは、`canvas.json`（ページ・画面の置き場所・メモ）も一緒に出す。出す前に、キャンバスで人が動かした分がないか、公開済みの `canvas.json` を読んで確かめる。
