# -*- coding: utf-8 -*-
"""P11 段階 2（D-082〜D-085）：billing-setup / llm-routes / app-setup / disclosure / ops-llm / ops-disclosure"""
from _icons import ic, LOGO
from _parts import *
from s_p2 import clone_box
from s_p8 import OPS_CSS, _plan
from s_p0 import AUTH_CSS, _wrap, _left, _box

P11_CSS = """
.rt{display:grid;gap:10px}.rt>label{display:grid;grid-template-columns:26px minmax(0,1fr);gap:10px;align-items:start;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-size:13px;cursor:pointer}
.rt>label.on{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in oklab,var(--primary) 18%,transparent)}.rt b{display:block}.rt small{display:block;color:var(--on-sv);font-size:11.5px;line-height:1.6}
.cap{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,88px);gap:0;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;font-size:12.5px}
.cap>div{padding:8px 10px;border-top:1px solid var(--line-soft)}.cap>div:nth-child(-n+4){border-top:0;background:var(--sv);font-weight:600}.cap .ok{color:var(--st-success)}.cap .ng{color:var(--on-sv)}
.dv{display:grid;grid-template-columns:minmax(0,1fr) 120px 110px;gap:12px;align-items:center;padding:11px 14px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-size:13px}.dv b{display:block}.dv small{display:block;color:var(--on-sv);font-size:11.5px}
.docl{display:grid;gap:8px}.docl>a{display:grid;grid-template-columns:30px minmax(0,1fr) 90px;gap:12px;align-items:center;padding:11px 14px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);color:inherit;text-decoration:none;font-size:13px}
.docl>a:hover{border-color:var(--primary)}.docl b{display:block}.docl small{display:block;color:var(--on-sv);font-size:11.5px}.docl .ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--sv);color:var(--on-sv)}
"""

# ============================================================ billing-setup（シェル無し・Stripe のホスト画面へ）
_bs_lead = ("支払い方法を登録する", "プランを選んで、カードは Stripe の画面で登録します。カード番号は Kaname を通りません。請求書払いなら何もしなくて構いません。")
_bs_steps = [("プランを選ぶ", True), ("Stripe で登録", False), ("確認", False)]
def _bs_plans(cur="s"):
    rows = ""
    for k, name, price, sub in [("e","エントリー","30,000 円／月","一人社長・個人事業"),("s","スタンダード","80,000 円／月","中小・ベンチャー"),("p","プロ","150,000 円／月","中堅")]:
        on = "on" if k == cur else ""
        rows += f'<label class="{on}"><input type="radio" name="plan" {"checked" if on else ""} style="accent-color:#22345C;margin-top:3px"><span><b>{name} · {price}</b><small>{sub}。税込。上限は「プランと請求」で見られます</small></span></label>'
    return f'<div class="rt">{rows}</div>'
_bs = _wrap(_left(*_bs_lead, steps=_bs_steps), _box(f"""
 <h1>支払い方法を登録する</h1>
 <div class="sub">毎月自動で請求・引き落とし。領収書とカードの変更は Stripe の画面で。</div>
 {field("プラン", _bs_plans())}
 {field("支払い方法", '<div class="rt"><label class="on"><input type="radio" name="pm" checked style="accent-color:#22345C;margin-top:3px"><span><b>カード（Stripe）</b><small>Stripe の画面で登録。番号は Kaname を通らない</small></span></label><label><input type="radio" name="pm" style="accent-color:#22345C;margin-top:3px"><span><b>請求書払い</b><small>毎月の請求書を受け取り、振込で払う。運営が入金を記録</small></span></label></div>')}
 <button class="btn btn-p" style="width:100%">{ic("credit-card")}Stripe で登録する</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:16px">Stripe の画面が開きます。戻ってくると登録の結果がここに出ます。</p>"""))
_bs_ok = _wrap(_left(*_bs_lead, steps=[("プランを選ぶ", True), ("Stripe で登録", True), ("確認", True)]), _box(f"""
 <h1>登録できました</h1>
 <div class="sub">スタンダード · カード（Visa · 4242）· 次の請求 10/1。</div>
 {kv([("プラン","スタンダード 80,000 円／月（税込）"),("支払い方法","カード Visa ···· 4242（有効期限 12/28）"),("次の請求","2026/10/1（日割り 9/16〜 の分は今月）"),("変更・領収書","Stripe の画面（プランと請求 › 支払い方法）")])}
 <a class="btn btn-p" href="../v1/v1-bridge-setup.html" style="width:100%;justify-content:center">{ic("arrow-right")}PC をつなぐへ進む</a>"""))
_bs_x = _wrap(_left(*_bs_lead, steps=[("プランを選ぶ", True), ("Stripe で登録", True), ("確認", False)]), _box(f"""
 <h1>カードが拒否されました</h1>
 <div class="sub">カード会社が承認しませんでした。Kaname には番号は残っていません。</div>
 {note("カードが拒否されました。別のカードを使うか、カード会社に確認してください。請求書払いに切り替えることもできます。", "warn")}
 <button class="btn btn-p" style="width:100%">{ic("credit-card")}別のカードで登録する</button>
 <div style="height:8px"></div>
 <button class="btn btn-g" style="width:100%">{ic("file-text")}請求書払いにする</button>"""))
_bs_i = _wrap(_left(*_bs_lead, steps=[("プランを選ぶ", True), ("請求書払い", True), ("確認", True)]), _box(f"""
 <h1>請求書払いにしました</h1>
 <div class="sub">毎月 1 日に請求書が届きます。振込で払うと運営が入金を記録します。</div>
 {kv([("プラン","スタンダード 80,000 円／月（税込）"),("支払い方法","請求書払い（振込）"),("請求書の送り先","info@engine-base.com（会社の設定で変えられます）")])}
 <a class="btn btn-p" href="../v1/v1-bridge-setup.html" style="width:100%;justify-content:center">{ic("arrow-right")}PC をつなぐへ進む</a>"""))
BILLING_SETUP = ("billing-setup", [("n","登録","プランと支払い方法を選ぶ。カードは Stripe の画面へ。",_bs),("ok","登録できた","Stripe から戻ってきた（写しは webhook で確定）。",_bs_ok),("x","カードが拒否された","E-PAY-001。番号は残らない。別のカードか請求書払いへ。",_bs_x),("i","請求書払い","v1 と同じ。運営が入金を記録する。",_bs_i)], AUTH_CSS + P11_CSS, True)

# ============================================================ llm-routes（AI の経路）
def _route(k, on, name, sub):
    return f'<label class="{"on" if on else ""}"><input type="radio" name="{k}" {"checked" if on else ""} style="accent-color:#22345C;margin-top:3px"><span><b>{name}</b><small>{sub}</small></span></label>'
_lr_default = card(head("既定の経路", sub="AI社員と高本AIが普段どこで動くか") + '<div class="rt">' +
  _route("d", True, "Bridge（あなたの PC で、あなたのサブスク）", "既定。PC が開いている間に動く。費用は Kaname の請求に乗らない") +
  _route("d", False, "自分の API キー（Anthropic・OpenAI・Google）", "PC が閉じていても動く。費用は提供者から直接あなたへ") +
  _route("d", False, "運営マネージド", "運営のキーで動く。プランの上限まで含み、超えた分は同じ請求書に従量で。運営の許可が要る（今：許可あり）") + '</div>')
_lr_offline = card(head("PC が閉じているとき", sub="Bridge が止まっている間、溜まった仕事をどこで動かすか") + '<div class="rt">' +
  _route("o", True, "待つ（起きたら順に片づける）", "段階 1 と同じ。外に出るものは止まったまま") +
  _route("o", False, "自分の API キーで動かす", "サーバー経路。承認が要るものは承認待ちで止まる") +
  _route("o", False, "運営マネージドで動かす", "上限に近づくと高本AIが先に言う") + '</div>' + '<div class="acts">' + btn("保存する","p","check") + '</div>')
_lr_cap = card(head("使える機能は 3 社で同じ", sub="能力表を揃えています。揃わない機能はどの経路でも出ません") + '<div class="cap"><div>機能</div><div>Anthropic</div><div>OpenAI</div><div>Google</div>' +
  "".join(f'<div>{f}</div><div class="ok">{ic("check")}</div><div class="ok">{ic("check")}</div><div class="ok">{ic("check")}</div>' for f in ["会話・記憶・台帳の読み書き","ブラウザ操作（Bridge）","ファイルの読み書き（Bridge）","承認つきの外部送信","覚えた操作の再生"]) +
  '<div>画像の読み取り</div><div class="ng">出さない</div><div class="ng">出さない</div><div class="ng">出さない</div></div>' +
  '<div class="muted" style="font-size:12px;margin-top:10px">1 社でも無い機能はどの経路でも出しません（経路の違いを画面に出さない）。</div>')
_lr_keys = card(head("API キー", btn("キーを預ける","o","key"), "預けるだけ。中身は表示もログもされません") + table(["提供者","状態","預けた","最終確認",""], [
  ["Anthropic",pill("有効","su"),("9/16","n"),("9/16 10:02","n"),btn("失効させる","g","ban")],["OpenAI",pill("未登録","ne"),"","",btn("預ける","g","key")],["Google",pill("未登録","ne"),"","",btn("預ける","g","key")]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">預けたときに 1 回だけ提供者に確かめます。失効は即時で、動いている仕事は止まります。</div>')
_lr_usage = card(head("使用量（今月）", sub="提供者ごと。運営マネージドはプランの上限に含む") + '<div class="ub">' + "".join(
  f'<div><span class="l">{k}</span><span class="bar"><i class="{"bad" if v/m > .9 else ("warn" if v/m > .7 else "ok")}" style="width:{round(v/m*100)}%"></i></span><span class="v">{v} / {m} 万</span></div>'
  for k, v, m in [("運営マネージド（トークン相当）",62,100),("自分のキー Anthropic（参考）",18,999)]) + '</div>' +
  clone_box("高本AI","運営マネージドが 62% です。このペースなら 27 日に上限に届きます。超えた分は同じ請求書に従量で乗ります。"))
_lr = '<div data-sec="0">' + _lr_default + '</div><div data-sec="1"><div style="height:14px"></div>' + _lr_offline + '</div><div data-sec="2"><div style="height:14px"></div>' + _lr_keys + '<div style="height:14px"></div>' + _lr_cap + '</div><div data-sec="3"><div style="height:14px"></div>' + _lr_usage + '</div>'
_lr_key = ('<div data-sec="2">' + card(head("API キーを預ける", sub="Anthropic") + field("API キー", inp("","sk-ant-…","password"), "貼り付けた瞬間に vault に入り、画面には二度と出ません。提供者に 1 回だけ確かめます") +
  '<div class="acts">' + btn("確かめて預ける","p","key") + btn("やめる","g") + '</div>' + note("キーは AI社員にも運営にも渡りません。使うのはサーバー経路で動かすときだけです。", "info")) + '</div>')
_lr_x = ('<div data-sec="2">' + card(head("API キーが無効です") + note("Anthropic のキーが無効です（提供者が拒否）。新しいキーを預けるか、経路を Bridge か運営マネージドに戻してください。動いていた仕事は止めてあります。", "warn") +
  '<div class="acts">' + btn("新しいキーを預ける","p","key") + btn("Bridge に戻す","g") + '</div>') + '<div style="height:14px"></div>' +
  card(head("運営マネージドの上限") + note("運営マネージドが今月の上限（100 万）に届きました。超えた分は従量で同じ請求書に乗ります。止めるなら経路を Bridge に戻してください。", "warn") +
  '<div class="acts">' + btn("従量で続ける","p","check") + btn("Bridge に戻す","g") + '</div>') + '</div>')
LLM_ROUTES = ("llm-routes", [("n","AI の経路","既定と PC が閉じているとき。3 社で機能は同じ。",_lr),("k","キーを預ける","貼り付けた瞬間に vault へ。",_lr_key),("x","キーが無効・上限に届いた","E-LLM-001／E-LLM-003。仕事は止めてある。",_lr_x)], P11_CSS, False, {"既定の経路":"","PC が閉じているとき":"","API キー":"1","使用量":"!1"})

# ============================================================ app-setup（アプリと通知）
_ap_pc = card(head("PC", sub="Bridge の窓で開く") + kv([("Bridge","入っている（第 5 版 · MacBook Pro）"),("画面","Bridge のメニュー「Kaname を開く」で、この画面が窓で開きます"),("通知","承認待ち・AI が止まった・お知らせ を PC の通知に出す")]) +
  '<div class="acts">' + btn("Bridge の窓で開く","o","monitor") + '</div>')
_ap_mobile = card(head("スマホ", sub="App Store／Google Play") + '<div class="rt"><label class="on"><span style="grid-column:1/-1"><b>iPhone · Kaname 1.2</b><small>ログイン中 · 通知 許可あり · 最終 9/16 08:10</small></span></label><label><span style="grid-column:1/-1"><b>まだ入れていない端末</b><small>ストアで「Kaname」を検索。同じアカウントでログインすると通知の端末に加わります</small></span></label></div>' +
  '<div class="acts">' + btn("App Store","g","smartphone") + btn("Google Play","g","smartphone") + '</div>')
_ap_notify = card(head("通知", sub="どの端末に何を届けるか") + '<div class="t-wrap"><table class="ptbl"><thead><tr><th>出来事</th><th>iPhone</th><th>PC（Bridge）</th><th>メール</th></tr></thead><tbody>' +
  "".join(f'<tr><td>{w}</td><td><input type="checkbox" {"checked" if a else ""} style="accent-color:#22345C"></td><td><input type="checkbox" {"checked" if b else ""} style="accent-color:#22345C"></td><td><input type="checkbox" {"checked" if c else ""} style="accent-color:#22345C"></td></tr>' for w,a,b,c in [("承認待ちが来た",1,1,0),("AI が止まった",1,1,1),("お知らせ（障害・メンテ）",1,0,1),("問い合わせに返答が来た",1,0,1)]) +
  '</tbody></table></div><div class="acts">' + btn("保存する","p","check") + '</div>' + '<div class="muted" style="font-size:12px;margin-top:10px">つながっていない間は、最後に見た「今日」「タスク」「承認待ち」を読めます。書くのはつながってから。</div>')
_ap = '<div data-sec="0">' + _ap_pc + '</div><div data-sec="1"><div style="height:14px"></div>' + _ap_mobile + '</div><div data-sec="2"><div style="height:14px"></div>' + _ap_notify + '</div>'
_ap_p = ('<div data-sec="1 2">' + card(head("通知の許可を待っています", sub="iPhone") + note("iPhone で「通知を許可」を押すと、ここに端末が加わります。押さないと承認待ちの通知は届きません（メールには届きます）。", "info") +
  '<div class="acts">' + btn("もう一度たずねる","p","bell") + '</div>') + '</div>')
_ap_x = ('<div data-sec="1 2">' + card(head("通知が許可されていません") + note("iPhone の通知が許可されていません。承認待ちはメールと PC にだけ届きます。iPhone の設定 › 通知 › Kaname で許可すると、ここに戻ります。", "warn") +
  '<div class="acts">' + btn("設定の開き方を見る","g","help-circle") + '</div>') + '<div style="height:14px"></div>' +
  card(head("つながっていません") + note("インターネットにつながっていません。最後に見た「今日」「タスク」「承認待ち」は読めます。書くのはつながってから。", "warn")) + '</div>')
APP_SETUP = ("app-setup", [("n","アプリと通知","PC は Bridge の窓・スマホはストアのアプリ。",_ap),("p","許可待ち","端末で許可を押すまで。",_ap_p),("x","許可が無い・つながっていない","E-APP-001／E-APP-002。",_ap_x)], P11_CSS, False, {"PC":"","スマホ":"1","通知":""})

# ============================================================ disclosure（開示資料）
def _doc(icon, t, s, right):
    return f'<a href="#"><span class="ico">{ic(icon)}</span><span><b>{t}</b><small>{s}</small></span>{right}</a>'
_dc_list = card(head("開示資料", btn("まとめて PDF で出す","p","download"), "第 7 版 · 2026/9/16 生成 · 成果物から機械生成（手で書いたのは DPA の雛形だけ）") + '<div class="docl">' +
  _doc("list-checks","できる操作の完全な列挙","操作 87 件を 8 つの出口ごとに。ここに無いことはできません", pill("第 7 版","ne")) +
  _doc("shield","送るもの／送らないもの","外に出るデータの決まりから。資格情報・台帳の中身はサーバーに送らない", pill("第 7 版","ne")) +
  _doc("building-2","サブプロセッサ一覧","Supabase（東京）・Railway・Vercel・Anthropic／OpenAI／Google（経路を選んだとき）・Stripe・Resend", pill("変更あり 9/10","wa")) +
  _doc("file-text","DPA（データ処理契約）","雛形 第 2 版（法務確認 8/30）。締結は問い合わせから", pill("雛形","ne")) +
  _doc("trash-2","アンインストールの検証結果","Bridge 第 5 版 · 残留物ゼロ（macOS 14／Windows 11）· 2026/9/12", pill("通った","su")) +
  _doc("clock","監査ログの保持と出し方","7 年保持。持ち出しから自分で出せる", pill("第 7 版","ne")) + '</div>')
_dc_ver = card(head("版の履歴", sub="中身が変わると新しい版になり、お知らせで届きます") + table(["版","いつ","何が変わった","お知らせ"], [
  ["第 7 版",("9/16","n"),"サブプロセッサに Stripe を追加（カード決済・段階 2）",pill("9/16 送付","su")],["第 6 版",("9/10","n"),"できる操作に「覚えた操作の再生」を追加",pill("9/10 送付","su")],["第 5 版",("8/20","n"),"アンインストールの検証を Bridge 第 5 版で更新",pill("8/20 送付","su")]]))
_dc = '<div data-sec="0 1 2 3 4 5">' + _dc_list + '</div>'
_dc_v = '<div data-sec="5">' + _dc_ver + '</div>'
_dc_x = ('<div data-sec="0">' + card(head("PDF が作れませんでした") + note("PDF を作れませんでした（保存先が応答しません）。もう一度押すか、しばらくしてから試してください。画面の内容は最新の版です。", "warn") +
  '<div class="acts">' + btn("もう一度 PDF を出す","p","download") + '</div>') + '</div>')
DISCLOSURE = ("disclosure", [("n","資料","版つき。全部 PDF で出せる。",_dc),("v","版の履歴","何が変わったか。",_dc_v),("x","PDF が作れない","E-DISC-001。中身は最新。",_dc_x)], P11_CSS, False, {"できる操作":"87","送るもの／送らないもの":"","サブプロセッサ":"!1","DPA":"","アンインストール":"","版":"7"})

# ============================================================ ops-llm（運営：AI の経路と使用量）
_ol = ('<div data-sec="0">' + card(head("運営マネージドの許可", sub="会社ごと。許可した会社だけが運営のキーで動ける") + table(["会社","プラン","経路（既定／閉じているとき）","許可","今月の使用量",""], [
  ["株式会社ENGINE BASE",_plan("s"),"Bridge／運営マネージド",pill("許可 · 9/1","su"),("62 / 100 万","n"),btn("止める","g","ban")],
  ["合同会社ミナト",_plan("p"),"自分のキー（Anthropic）／自分のキー",pill("不要","ne"),("—","n"),""],
  ["山田設計",_plan("e"),"Bridge／待つ",pill("申請あり","wa"),("—","n"),btn("許可する","p","check")]])) + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("使用量（3 社・今月）", sub="運営のキー。会社の会話の中身は見ない") + table(["提供者","会社数","トークン相当（万）","費用（概算）"], [
  ["Anthropic",("14","n"),("820","n"),("246,000 円","n")],["OpenAI",("6","n"),("210","n"),("52,000 円","n")],["Google",("3","n"),("90","n"),("18,000 円","n")]])) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("費用", sub="プランの上限に含む分と、超過の従量") + table(["会社","上限","使用","超過","請求"], [
  ["株式会社ENGINE BASE",("100 万","n"),("62 万","n"),("0","n"),pill("上限内","su")],["株式会社サンプル商事",("100 万","n"),("131 万","n"),("31 万","n"),pill("従量 9,300 円 · 10/1 の請求書へ","wa")]])) + '</div>')
_ol_x = ('<div data-sec="2">' + card(head("従量に切り替わった会社") + note("株式会社サンプル商事が今月の上限に届きました。従量で続ける設定です。会社側の高本AIが先に伝えています。", "warn") + '<div class="acts">' + btn("会社の詳細を開く","o","building-2") + '</div>') + '</div>')
OPS_LLM = ("ops-llm", [("n","経路と使用量","会社ごとの許可・3 社の使用量・費用。",_ol),("x","従量に切り替わった会社","上限に届いて従量で続けている。",_ol_x)], OPS_CSS + P11_CSS, False, {"許可":"!1","使用量":"3","費用":"1"})

# ============================================================ ops-disclosure（運営：開示資料）
_od = ('<div data-sec="0">' + card(head("開示資料の版", btn("新しい版を出す","p","upload"), "設計から生成（できる操作・送るもの・技術選定・Bridge の検証）。差分があるときだけ出せる") + table(["版","生成","何が変わった","お知らせ","状態",""], [
  ["第 8 版（下書き）",("9/16 11:40","n"),"サブプロセッサに Stripe を追加・できる操作に決済 2 件",pill("未送付","ne"),pill("下書き","ne"),btn("出す（全社にお知らせ）","p","send")],
  ["第 7 版",("9/16","n"),"サブプロセッサに Stripe を追加",pill("9/16 送付","su"),pill("公開中","su"),btn("戻す先にする","g","undo")],
  ["第 6 版",("9/10","n"),"覚えた操作の再生を追加",pill("9/10 送付","su"),pill("旧版","ne"),""]])) + '</div>')
_od_d = ('<div data-sec="1"><div style="height:14px"></div>' + card(head("DPA の雛形", btn("雛形を差し替える","o","upload"), "法務確認 8/30（第 2 版）。締結は会社ごとに問い合わせから") + kv([("第 2 版","2026/8/30 法務確認 · 個人情報保護法の委託の位置づけを整理"),("締結済み","3 社（会社の詳細の「証跡とサポートアクセス」に PDF）")])) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("サブプロセッサ", btn("足す","o","plus"), "変更は 30 日前に全社へお知らせ") + table(["会社","目的","所在","扱うデータ","有効","通知"], [
  ["Supabase","DB・認証・ストレージ","東京","会社モデル・台帳・証跡（暗号化）",("2026/7/1","n"),pill("済","su")],["Railway","サーバー経路の実行","東京","実行中の一時データ",("2026/7/1","n"),pill("済","su")],["Vercel","画面の配信","東京","画面の静的ファイル",("2026/7/1","n"),pill("済","su")],
  ["Anthropic／OpenAI／Google","運営マネージドの LLM","米国","会話の断片（名前や番号は送らない）",("2026/10/1","n"),pill("9/16 通知","su")],["Stripe","カード決済","米国","請求先・カードの参照（番号は Stripe）",("2026/10/1","n"),pill("9/16 通知","su")],["Resend","メール送出","米国","メールアドレス・件名",("2026/7/1","n"),pill("済","su")]])) + '</div>')
OPS_DISCLOSURE = ("ops-disclosure", [("n","版","成果物から生成。差分があるときだけ出せる。",_od),("d","DPA とサブプロセッサ","雛形と一覧。変更は事前通知。",_od_d)], OPS_CSS + P11_CSS, False, {"版":"1","DPA の雛形":"","サブプロセッサ":"6"})

SCREENS = [BILLING_SETUP, LLM_ROUTES, APP_SETUP, DISCLOSURE, OPS_LLM, OPS_DISCLOSURE]
