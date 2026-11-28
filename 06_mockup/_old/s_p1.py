# -*- coding: utf-8 -*-
"""P1 立ち上げ：setup / bridge / credentials / ai-add / duty-test / ledger-def"""
from _icons import ic, LOGO
from _parts import *

# ============================================================ setup（シェル無し・ウィザード）
def _wiz(step, inner):
    # ステップ表示は上部の状態タブが担うので、ここでは二重に出さない
    return f'<div style="max-width:760px;margin:0 auto">{inner}</div>'

_s1 = _wiz(0, card(
  head("会社のことを教えてください") +
  '<p class="muted" style="font-size:13px;margin-bottom:20px">あとから全部変えられます。まず動かすための最小限だけ聞きます。</p>' +
  field("会社名（または屋号）", inp("株式会社ENGINE BASE")) +
  field("いま何人ですか",
    '<div style="display:flex;gap:9px;flex-wrap:wrap">' + "".join(
      f'<label style="display:flex;gap:8px;align-items:center;padding:10px 16px;border:1.5px solid '
      f'{"var(--primary)" if i==0 else "var(--line)"};{"background:var(--primary-c);" if i==0 else ""}'
      f'border-radius:var(--r-md);font-size:13.5px"><input type="radio" name="n" {"checked" if i==0 else ""} '
      f'style="accent-color:#22345C">{x}</label>' for i, x in enumerate(["1人", "2〜5人", "6〜30人", "31人以上"])) + '</div>',
    "1人の場合、「部署」の層は画面に出しません。増えたときに出します") +
  field("期首", '<select class="inp" style="max-width:200px"><option>4月</option></select>') +
  '<div style="display:flex;gap:9px;margin-top:22px">' + btn("次へ", "p", "right") + '</div>'))

_s2 = _wiz(1, card(
  head("何をしている会社ですか") +
  '<p class="muted" style="font-size:13px;margin-bottom:20px">この文章から、台帳とAI社員の候補を作ります。長くなくて構いません。</p>' +
  field("事業内容",
    '<textarea class="inp" rows="4" style="resize:none">受託開発（Web・アプリ）と、自社SaaSの開発をしています。'
    'いまは私ひとりで、外注が2名います。案件は発注ナビ経由と紹介が半々です。</textarea>') +
  ai("この文章から、こう読み取りました",
     "受託開発が主で、案件が段階を進んでいく形なので <b>ファネル型の台帳「案件パイプライン」</b>が要ります。"
     "外注への支払いと顧客への請求があるので <b>取引型の台帳「請求」</b>も。<br>"
     "一番時間を取られていそうなのは<b>案件の取り込みと、提案後の追い</b>です。"
     "最初のAI社員は<b>営業</b>から始めるのがよさそうです。",
     btn("この読み取りでよい", "p", "check") + btn("違う。自分で選ぶ")) +
  '<div style="display:flex;gap:9px;margin-top:22px">' + btn("次へ", "p", "right") + btn("戻る") + '</div>'))

def _cand(name, unit, val, why, sel=False):
    return (f'<label style="display:block;padding:14px;border:1.5px solid '
      f'{"var(--primary)" if sel else "var(--line)"};{"background:var(--primary-c);" if sel else ""}'
      f'border-radius:var(--r-md);cursor:pointer;margin-bottom:9px">'
      f'<div style="display:flex;gap:12px;align-items:flex-start">'
      f'<input type="radio" name="metric" {"checked" if sel else ""} style="margin-top:4px;accent-color:#22345C">'
      f'<div style="flex:1"><div style="display:flex;gap:9px;align-items:baseline;flex-wrap:wrap">'
      f'<b style="font-size:14.5px">{name}</b>'
      f'<span class="tag" style="font-size:11px">単位 {unit}</span>'
      f'<span class="num" style="font-size:15px;font-weight:600">{val}</span></div>'
      f'<div class="muted" style="font-size:12.5px;margin-top:4px">{why}</div></div></div></label>')

_s3 = _wiz(2, card(
  head("今期、何を追いますか") +
  '<p class="muted" style="font-size:13px;margin-bottom:18px">'
  '<b>売上とは限りません。</b>いただいた事業内容から候補を3つ出しました。選ぶか、自分で書いてください。</p>' +
  ai("事業内容から見た候補",
     "受託開発が主で、案件が段階を進んでいく形なので、<b>追うべき数字は3通り</b>考えられます。"
     "どれを選んでも、四半期・月・今週まで私が割ります。") +
  '<div style="height:16px"></div>' +
  _cand("売上", "円", "48,000,000",
        "一番わかりやすい。ただし「売上を上げろ」は打ち手に直結しないので、下の層で件数に変換することになります。", True) +
  _cand("受注件数", "件", "40 件",
        "打ち手に直結する。平均単価が安定している事業ならこちらのほうが動かしやすい。") +
  _cand("継続率", "%", "92 %",
        "自社SaaSを伸ばすならこちら。<b>割合は四半期に割れない</b>ので、割り方が変わります。") +
  '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:13px;'
  'background:var(--surface);border-radius:var(--r-md);margin-bottom:18px">'
  '<span style="font-size:13px;font-weight:600">自分で書く</span>'
  '<input class="inp" placeholder="例：紹介件数・稼働率・NPS" style="max-width:220px">'
  '<select class="inp" style="max-width:180px"><option>単位を選ぶ</option><option>円（金額）</option>'
  '<option>件（件数）</option><option>%（割合）</option><option>時間</option><option>回</option>'
  '<option>＋ 新しい単位を作る</option></select>'
  '<input class="inp num" placeholder="目標値" style="max-width:120px;text-align:right"></div>' +
  note("<b>単位はあなたの会社で作れます。</b>「顧客満足度スコア」「稼働率」など、ここに無い指標も作れます。"
       "運営が用意した6つに限りません。", "primary") +
  '<div class="card-h" style="margin-top:22px"><h2 style="font-size:13.5px">選んだ指標の割り方</h2></div>' +
  ai("売上（円）を選んだ場合",
     "受託開発は年度末に偏る傾向があるため、均等割りにしていません。" +
     table(["期間", ("配分","r"), ("比率","r")],
           [["Q1（4〜6月）", ("10,000,000","n"), ("20.8%","n")],
            ["Q2（7〜9月）", ("11,000,000","n"), ("22.9%","n")],
            ["Q3（10〜12月）", ("12,000,000","n"), ("25.0%","n")],
            ["Q4（1〜3月）", ("15,000,000","n"), ("31.3%","n")]])) +
  '<div style="height:16px"></div>' +
  note("<b>「継続率 92%」を選ぶと、割り方が変わります。</b>割合は足し算で割れないため、"
       "四半期ごとに<b>同じ 92% を置く</b>（各期で達成すべき水準）形になります。"
       "金額・件数は「割る」、割合・状態は「置く」── この違いは Kaname が自動で判断します。", "warn") +
  '<div style="display:flex;gap:9px;margin-top:22px">' + btn("この指標で進む", "p", "right") + btn("戻る") + '</div>'))

_s4 = _wiz(3, card(
  head("最初の台帳を作ります") +
  '<p class="muted" style="font-size:13px;margin-bottom:20px">'
  '事業内容から候補を作りました。あとで項目も段階も自由に変えられます。</p>' +
  grid([
    '<div style="padding:16px;border:1.5px solid var(--primary);background:var(--primary-c);border-radius:var(--r-md)">'
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:7px">'
    '<input type="checkbox" checked style="accent-color:#22345C">'
    f'<b style="font-size:14px">{dot("d-indigo")}案件パイプライン</b>'
    '<span class="pill p-ne" style="font-size:10.5px">ファネル型</span></div>'
    '<div class="muted" style="font-size:12.5px;line-height:1.75">問い合わせ → ヒアリング → 提案済 → 内定 → 受注 → 失注<br>'
    '項目：案件名・会社名・想定金額・確度・担当・発生日・流入元</div></div>',
    '<div style="padding:16px;border:1.5px solid var(--primary);background:var(--primary-c);border-radius:var(--r-md)">'
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:7px">'
    '<input type="checkbox" checked style="accent-color:#22345C">'
    f'<b style="font-size:14px">{dot("d-teal")}請求</b>'
    '<span class="pill p-ne" style="font-size:10.5px">取引型</span></div>'
    '<div class="muted" style="font-size:12.5px;line-height:1.75">発行 → 送付済 → 入金済 ／ 期限超過<br>'
    '項目：請求書番号・取引先・金額・発生日・支払期限</div>'
    '<div style="font-size:12px;color:var(--primary);font-weight:600;margin-top:8px">'
    'この台帳の入金が、目標「売上」に積み上がります</div></div>',
  ]) +
  '<div style="margin-top:14px">' + btn("台帳を1から作る", "g", "plus", "v1-ledger-def.html") + '</div>' +
  note("<b>ここまでで会社モデルの骨格ができました。</b>次は AI 社員を1体作ります。"
       "作った AI 社員は<b>最初はテストモード</b>で動き、外に出る操作は一切しません。", "primary") +
  '<div style="display:flex;gap:9px">' + btn("この台帳で始める", "p", "check", "v1-ai-add.html") + btn("戻る") + '</div>'))

SETUP = ("setup", [("s1","1. 会社","4ステップだけ。ここが長いとセルフサーブが成立しない。",_s1),
                   ("s2","2. 事業内容","",_s2),("s3","3. 最初の目標","",_s3),("s4","4. 最初の台帳","",_s4)],
         AUTH_CSS, True)

# ============================================================ bridge
_br_off = (card(empty("bridge", "Bridge がまだ接続されていません",
  "Bridge はあなたのPCで動く小さなアプリです。これを入れると、<b>いま契約している Claude / ChatGPT / Gemini の"
  "サブスクの中で</b> AI 社員が動きます。API の従量課金は発生しません。",
  btn("macOS 版をダウンロード","p","arrow") + btn("Windows 版","o"))) +
 card(head("Bridge があると何が変わるか") + grid([
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">AIの費用が増えない</div>'
   '<div class="muted" style="font-size:12.5px">いま払っているサブスクの中で動きます。AI社員を10体に増やしても費用は増えません。</div></div>',
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">ログイン済みのブラウザが使える</div>'
   '<div class="muted" style="font-size:12.5px">あなたのPC・あなたの回線から操作するため、普段と同じ扱いになります。</div></div>',
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">社内データがクラウドに出ない</div>'
   '<div class="muted" style="font-size:12.5px">ローカルで完結する操作は、サーバーに送りません。</div></div>'], "g3")) +
 card(head("Bridge を使わない場合") +
   '<p style="font-size:13.5px;line-height:1.85">Bridge を入れなくても Kaname は動きます。その場合は<b>あなたの API キー</b>を'
   '登録するか、<b>Kaname 運営のAPI</b>（管理者が有効にした場合のみ・既定はオフ）を使います。どちらも従量課金です。</p>' +
   '<div style="margin-top:12px">' + btn("API キーを登録する","o",None,"v1-settings.html") + '</div>'))

_br_ing = card(
  '<div class="card-h"><span class="pill p-pr"><span class="spin"></span>接続中</span><h2>Bridge をつないでいます</h2></div>' +
  '<div style="display:flex;flex-direction:column;gap:0;margin:8px 0 18px">' + "".join(
    f'<div style="display:flex;gap:13px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line-soft)">'
    f'{i}<div style="flex:1"><div style="font-weight:{w};font-size:13.5px">{t}</div>'
    f'<div class="muted" style="font-size:12px">{m}</div></div>{s}</div>' for i, t, m, w, s in [
      (ic("check"), "Bridge アプリを起動した", "高本のMacBook Pro を検出", "500", pill("完了","su")),
      (ic("check"), "このアカウントと紐づけた", "ワンタイムコードで確認済み", "500", pill("完了","su")),
      ('<span class="spin dark"></span>', "使えるモデルを調べている",
       "Claude Code / Codex / Gemini CLI の有無を確認中", "600", pill("実行中","pr")),
      (ic("clock"), "ブラウザ操作の権限を確認する", "", "400", pill("待機")),
      (ic("clock"), "テスト実行", "覚えた操作を1つだけ試します", "400", pill("待機")),
    ]) + '</div>' +
  '<p class="muted" style="font-size:12.5px">この間、Kaname は使えます。AI 社員の実行だけが待ちになります。</p>',
  style="border-color:var(--st-progress)")

_br_on = (card(
  '<div style="display:flex;gap:15px;align-items:center;flex-wrap:wrap">' + pill("接続済み","su","check") +
  '<div style="flex:1;min-width:200px"><div style="font-weight:600;font-size:15px">高本のMacBook Pro</div>'
  '<div class="muted" style="font-size:12.5px">macOS 15.6 · Bridge v1.0.4 · 最終応答 3秒前</div></div>' +
  btn("切断する") + '</div>', style="border-color:var(--st-success)") +
 grid([
  card(head("使えるモデル") + '<div style="display:flex;flex-direction:column;gap:10px">' + "".join(
    f'<div style="display:flex;gap:11px;align-items:center;padding:12px;background:var(--surface);'
    f'border-radius:var(--r-md);{"opacity:.55" if not on else ""}">{p}'
    f'<div style="flex:1"><b style="font-size:13.5px">{n}</b>'
    f'<div class="muted" style="font-size:12px">{d}</div></div>{x}</div>' for p, n, d, on, x in [
      (pill("既定","su","check"), "Claude（Max プラン）", "Claude Code 経由 · 追加費用なし", True, ""),
      (pill("予備"), "ChatGPT（Plus プラン）", "Codex 経由 · 追加費用なし", True, ""),
      (pill("未接続"), "Gemini", "Gemini CLI 経由", False, btn("つなぐ")),
    ]) + '</div><p class="muted" style="font-size:12px;margin-top:13px">'
    'どのモデルを使っても、Kaname の画面・会話・記憶は同じです。経路の違いは画面に出しません。</p>'),
  card(head("PCが閉じているとき") + '<div style="display:flex;flex-direction:column;gap:10px">' +
    '<label style="display:flex;gap:11px;align-items:flex-start;padding:13px;border:1.5px solid var(--primary);'
    'border-radius:var(--r-md);background:var(--primary-c)"><input type="radio" name="s" checked style="margin-top:3px;accent-color:#22345C">'
    '<div><b style="font-size:13.5px">サーバー側の経路に切り替える</b>'
    '<div class="muted" style="font-size:12.5px">仕事は止まりません。ただしその分は従量課金になります（今月 <span class="num">¥1,240</span>）</div></div></label>'
    '<label style="display:flex;gap:11px;align-items:flex-start;padding:13px;border:1.5px solid var(--line);border-radius:var(--r-md)">'
    '<input type="radio" name="s" style="margin-top:3px;accent-color:#22345C">'
    '<div><b style="font-size:13.5px">PCが起きるまで待つ</b>'
    '<div class="muted" style="font-size:12.5px">費用は増えませんが、朝までタスクが溜まります</div></div></label></div>' +
    '<div class="card-h" style="margin-top:20px"><h2 style="font-size:13.5px">この30日の内訳</h2></div>' +
    kv([("Bridge 経由", '<span class="num">1,261回（98.2%）</span>'),
        ("サーバー経由", '<span class="num">23回（1.8%）</span>'),
        ("従量課金の合計", '<span class="num">¥1,240</span>')])),
 ]))

BRIDGE = ("bridge", [("off","未接続","Kaname 固有の画面。「サブスクの中で動く」をここで理解してもらう。",_br_off),
                     ("ing","接続中","",_br_ing),("on","接続済み","",_br_on)], "", False)
