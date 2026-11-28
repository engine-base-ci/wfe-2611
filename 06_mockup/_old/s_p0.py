# -*- coding: utf-8 -*-
"""P0 契約・登録：signup / verify / invite-accept / twofa-setup / signin / account-recover"""
from _icons import ic, LOGO
from _parts import *

def _left(h2, p, steps=None):
    st = ""
    if steps:
        st = '<div class="steps">' + "".join(
            f'<div>{ic("check") if d else ic("clock")}<span style="{"" if d else "opacity:.6"}">{s}</span></div>'
            for s, d in steps) + '</div>'
    return (f'<div class="auth-l"><div class="brand">{LOGO}<span>Kaname</span></div>'
            f'<h2>{h2}</h2><p>{p}</p>{st}'
            f'<div style="margin-top:auto;font-size:12px;opacity:.55">株式会社ENGINE BASE</div></div>')

LEAD = ("会社のかなめを、<br>1つの定義に。",
        "目標・台帳・担当業務・組織を1か所に置き、人と AI 社員が同じ席に並びます。"
        "目標から逆算されたタスクが配られ、実行され、測られ、次の計画に戻る ── その輪をここで閉じます。")

def _box(inner): return f'<div class="auth-r"><div class="auth-box">{inner}</div></div>'
def _wrap(left, box): return f'<div class="auth">{left}{box}</div>'

STEPS = [("アカウントを作る", False), ("会社のことを教える", False),
         ("最初の目標を決める", False), ("AI社員を1体作る", False)]

# ============================================================ signup
_su = _wrap(_left(*LEAD, steps=STEPS), _box(f"""
 <h1>アカウントを作る</h1>
 <div class="sub">3分で終わります。クレジットカードは不要です。</div>
 {field("メールアドレス", inp("", "name@example.com", "email"))}
 {field("パスワード", inp("", "8文字以上", "password"),
        "英字と数字を含む8文字以上。よく使われるパスワードは弾きます")}
 {field("会社名（または屋号）", inp("", "株式会社ENGINE BASE"),
        "あとから変えられます。個人事業なら屋号かお名前で構いません")}
 <label style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--on-sv);margin-bottom:18px">
   <input type="checkbox" style="margin-top:3px;accent-color:#22345C">
   <span>利用規約とプライバシーポリシーに同意します</span></label>
 <button class="btn btn-p" style="width:100%">{ic("login")}アカウントを作る</button>
 <div style="display:flex;align-items:center;gap:12px;margin:20px 0">
   <div style="flex:1;height:1px;background:var(--line)"></div>
   <span class="muted" style="font-size:12px">または</span>
   <div style="flex:1;height:1px;background:var(--line)"></div></div>
 <button class="btn btn-o" style="width:100%">Google で続ける</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:22px">
   すでにお持ちですか？ <a href="v1-signin.html" style="color:var(--primary);font-weight:600">サインイン</a></p>"""))

_su_err = _wrap(_left(*LEAD, steps=STEPS), _box(f"""
 <h1>アカウントを作る</h1>
 <div class="sub">3分で終わります。クレジットカードは不要です。</div>
 {field("メールアドレス", inp("info@engine-base.com", "", "email", "err"),
        "このメールアドレスは既に登録されています。<a href='v1-signin.html' style='color:var(--error);font-weight:600'>サインイン</a>するか、<a href='v1-account-recover.html' style='color:var(--error);font-weight:600'>パスワードを再設定</a>してください。", err=True)}
 {field("パスワード", inp("", "8文字以上", "password"))}
 {field("会社名（または屋号）", inp("株式会社ENGINE BASE"))}
 <button class="btn btn-p" style="width:100%">{ic("login")}アカウントを作る</button>"""))

SIGNUP = ("signup", [
  ("n", "通常", "", _su),
  ("e", "既に登録済み", "エラーで終わらせない。サインインとパスワード再設定への導線を必ず出す。", _su_err),
], AUTH_CSS, True)

# ============================================================ verify
_v_wait = _wrap(_left("あと1歩です。", "メールを確認すると、会社のことを教えるステップに進みます。",
  steps=[("アカウントを作る",True),("会社のことを教える",False),("最初の目標を決める",False),("AI社員を1体作る",False)]), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:var(--primary-c);
   color:var(--primary);display:grid;place-items:center;margin-bottom:20px">{ic("mail")}</div>
 <h1>メールを確認してください</h1>
 <div class="sub"><b class="num">info@engine-base.com</b> に確認メールを送りました。<br>
   メール内のボタンを押すと、続きに進めます。</div>
 <div class="pz">{ic("info")}<span>届かない場合は迷惑メールをご確認ください。それでも届かなければ再送できます。</span></div>
 <button class="btn btn-o" style="width:100%">確認メールを再送する</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:18px">
   <a href="#" style="color:var(--primary);font-weight:600">別のメールアドレスに変える</a></p>"""))

_v_done = _wrap(_left("確認できました。", "このまま会社のことを教えてください。4ステップで終わります。",
  steps=[("アカウントを作る",True),("会社のことを教える",False),("最初の目標を決める",False),("AI社員を1体作る",False)]), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#DCFCE7;
   color:var(--st-success);display:grid;place-items:center;margin-bottom:20px">{ic("check")}</div>
 <h1>確認できました</h1>
 <div class="sub">続いて、会社のことを教えてください。<b>4ステップ・約5分</b>です。<br>
   ここが終われば、翌朝から「今日」が動きます。</div>
 <a class="btn btn-p" href="v1-setup.html" style="width:100%">{ic("arrow")}はじめの設定に進む</a>"""))

_v_exp = _wrap(_left("リンクの有効期限が切れました。", "確認メールのリンクは24時間で切れます。もう一度送ります。"), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#FEF6EC;
   color:var(--st-warning);display:grid;place-items:center;margin-bottom:20px">{ic("clock")}</div>
 <h1>リンクの有効期限が切れました</h1>
 <div class="sub">確認メールのリンクは<b>24時間</b>で切れます。安全のための仕組みです。<br>
   新しいリンクをすぐ送れます。</div>
 <button class="btn btn-p" style="width:100%">{ic("mail")}新しいリンクを送る</button>"""))

VERIFY = ("verify", [
  ("w", "確認待ち", "", _v_wait),
  ("d", "確認できた", "確認して終わりにしない。次の行動（はじめの設定）へ必ず送る。", _v_done),
  ("e", "期限切れ", "", _v_exp),
], AUTH_CSS, True)

# ============================================================ invite-accept
_ia = _wrap(_left("佐藤さん、<br>参加をお待ちしていました。",
  "参加すると、あなたに配られた仕事だけが見えます。会社全体の数字や設定は見えません。"), _box(f"""
 <div style="background:var(--surface);border-radius:var(--r-md);padding:15px;margin-bottom:22px">
   <div style="font-size:12px;color:var(--on-sv);margin-bottom:5px">招待元</div>
   <div style="font-weight:700;font-size:15px;margin-bottom:3px">株式会社ENGINE BASE</div>
   <div style="font-size:12.5px;color:var(--on-sv)">高本 雅人 さんからの招待</div></div>
 <h1>参加する</h1>
 <div class="sub">パスワードを決めるだけで参加できます。</div>
 {field("メールアドレス", inp("sato@example.com", "", "email", "", "background:var(--line-soft);color:var(--on-sv)"),
        "招待されたアドレスです。変更できません")}
 {field("お名前", inp("佐藤 健"))}
 {field("パスワード", inp("", "8文字以上", "password"))}
 <div class="pz">{ic("lock")}<span><b>あなたに見えるもの</b>：今日 ／ 承認 ／ 会話 ／ 探す ／ 目標 ／ 台帳 ／ 担当業務<br>
   <b>見えないもの</b>：実行ログ ／ 証跡 ／ ポリシー ／ 資格情報 ／ Bridge ／ 設定 ／ 請求</span></div>
 <button class="btn btn-p" style="width:100%">{ic("check")}参加する</button>"""))

_ia_exp = _wrap(_left("この招待は使えません。", "招待は7日で切れます。招待した方に再送を依頼してください。"), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#FEF6EC;
   color:var(--st-warning);display:grid;place-items:center;margin-bottom:20px">{ic("clock")}</div>
 <h1>招待の有効期限が切れました</h1>
 <div class="sub">この招待リンクは <b class="num">2026-09-01</b> に発行され、<b>7日</b>で期限切れになりました。<br>
   招待した <b>高本 雅人</b> さんに、再送を依頼してください。</div>
 <button class="btn btn-o" style="width:100%">{ic("mail")}再送を依頼する</button>"""))

INVITE_ACCEPT = ("invite-accept", [
  ("n", "招待を受ける", "招待された人が「自分に何が見えるか」を参加前に分かる状態にする。", _ia),
  ("e", "期限切れ", "", _ia_exp),
], AUTH_CSS, True)

# ============================================================ twofa-setup
_2f_qr = _wrap(_left("最後にひとつ。", "AI が外部サービスを操作する製品です。あなたのアカウントが乗っ取られると被害が大きいため、2段階認証を強くおすすめします。"), _box(f"""
 <h1>2段階認証の設定</h1>
 <div class="sub">認証アプリでQRコードを読み取り、表示された6桁を入力してください。</div>
 <div style="display:flex;gap:18px;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap">
   <div style="width:132px;height:132px;background:var(--on-surface);border-radius:var(--r-md);
     display:grid;place-items:center;color:#fff;font-size:10px;font-family:var(--font-code);flex:none">QR コード</div>
   <div style="flex:1;min-width:150px;font-size:12.5px;color:var(--on-sv);line-height:1.8">
     Google Authenticator / 1Password / Authy などが使えます。<br><br>
     QRが読めない場合はこのキーを手入力：<br>
     <span class="num" style="font-family:var(--font-code);font-size:12px;background:var(--sv);
       padding:3px 8px;border-radius:4px;display:inline-block;margin-top:5px">JBSW Y3DP EHPK 3PXP</span></div></div>
 {field("6桁のコード", inp("", "000000", "text", "num", "font-size:20px;letter-spacing:.26em;text-align:center;padding:13px"))}
 <button class="btn btn-p" style="width:100%">{ic("check")}確認して有効にする</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:16px">
   <a href="#" style="color:var(--on-sv)">あとで設定する</a></p>"""))

_2f_rec = _wrap(_left("これを保存してください。", "認証アプリが使えなくなったとき、このコードだけが入り直す手段になります。"), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#DCFCE7;
   color:var(--st-success);display:grid;place-items:center;margin-bottom:20px">{ic("check")}</div>
 <h1>リカバリコード</h1>
 <div class="sub"><b>10個すべてを安全な場所に保存してください。</b>この画面を閉じると二度と表示されません。<br>
   1つのコードは1回だけ使えます。</div>
 <div class="code" style="font-size:13px;letter-spacing:.06em">4f8a-2b91   7c3d-5e02
9a1b-6f47   2e8c-0d35
5b7f-3a19   8d2e-4c60
1c9a-7b53   6f0d-2e84
3e5b-9c17   0a4f-8d26</div>
 <div style="display:flex;gap:9px;margin:16px 0">
   <button class="btn btn-o btn-sm" style="flex:1">{ic("file")}ダウンロード</button>
   <button class="btn btn-o btn-sm" style="flex:1">コピー</button></div>
 <label style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--on-sv);margin-bottom:16px">
   <input type="checkbox" style="margin-top:3px;accent-color:#22345C">
   <span>保存しました。この画面を閉じると二度と表示されないことを理解しています</span></label>
 <button class="btn btn-p" style="width:100%">{ic("check")}設定を完了する</button>"""))

TWOFA = ("twofa-setup", [
  ("q", "認証アプリを登録", "", _2f_qr),
  ("r", "リカバリコード", "ここを飛ばすと「端末を失うと詰む」が起きる。10個発行し、保存の確認を必須にする。", _2f_rec),
], AUTH_CSS, True)

# ============================================================ signin
_si = _wrap(_left(*LEAD), _box(f"""
 <h1>サインイン</h1>
 <div class="sub">Kaname に入ります。</div>
 {field("メールアドレス", inp("info@engine-base.com", "", "email"))}
 {field("パスワード", inp("............", "", "password"),
        "<a href='v1-account-recover.html' style='color:var(--primary);font-weight:600'>入れなくなった場合</a>")}
 <button class="btn btn-p" style="width:100%">{ic("login")}サインイン</button>
 <div style="display:flex;align-items:center;gap:12px;margin:20px 0">
   <div style="flex:1;height:1px;background:var(--line)"></div>
   <span class="muted" style="font-size:12px">または</span>
   <div style="flex:1;height:1px;background:var(--line)"></div></div>
 <button class="btn btn-o" style="width:100%">Google で続ける</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:22px">
   アカウントがありませんか？ <a href="v1-signup.html" style="color:var(--primary);font-weight:600">新しく始める</a></p>"""))

_si_err = _wrap(_left(*LEAD), _box(f"""
 <h1>サインイン</h1>
 <div class="sub">Kaname に入ります。</div>
 {field("メールアドレス", inp("info@engine-base.com", "", "email"))}
 {field("パスワード", inp("......", "", "password", "err"),
        "メールアドレスまたはパスワードが違います。あと <b>3回</b> 間違えると15分間ロックされます。", err=True)}
 <button class="btn btn-p" style="width:100%">{ic("login")}サインイン</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:20px">
   <a href="v1-account-recover.html" style="color:var(--primary);font-weight:600">パスワードを再設定する</a></p>"""))

_si_2f = _wrap(_left(*LEAD), _box(f"""
 <h1>確認コード</h1>
 <div class="sub">認証アプリに表示されている6桁を入力してください。</div>
 {field("6桁のコード", inp("", "000000", "text", "num", "font-size:22px;letter-spacing:.28em;text-align:center;padding:14px"),
        "残り <b class='num'>4</b> 回まで試せます。超えると15分間ロックされます")}
 <button class="btn btn-p" style="width:100%">{ic("check")}確認する</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:20px">
   認証アプリが使えない場合は <a href="v1-account-recover.html" style="color:var(--primary);font-weight:600">リカバリコードを使う</a></p>"""))

SIGNIN = ("signin", [
  ("n", "通常", "", _si),
  ("e", "認証エラー", "試行回数に上限を置く。無制限に試せる状態を作らない。", _si_err),
  ("f", "2段階認証", "", _si_2f),
], AUTH_CSS, True)

# ============================================================ account-recover
_ar_req = _wrap(_left("入れなくなっても、詰みません。",
  "パスワードを忘れても、2段階認証の端末を失っても、自分で入り直せます。"), _box(f"""
 <h1>入り直す</h1>
 <div class="sub">登録したメールアドレスに、再設定用のリンクを送ります。</div>
 {field("メールアドレス", inp("", "name@example.com", "email"))}
 <button class="btn btn-p" style="width:100%">{ic("mail")}再設定メールを送る</button>
 <div style="border-top:1px solid var(--line);margin:26px 0 20px"></div>
 <div style="font-size:13px;font-weight:700;margin-bottom:8px">認証アプリが使えない場合</div>
 <p class="muted" style="font-size:12.5px;line-height:1.8;margin-bottom:13px">
   2段階認証の設定時に受け取った<b>リカバリコード</b>を1つ使ってください。</p>
 <button class="btn btn-o" style="width:100%">{ic("key")}リカバリコードを使う</button>
 <div style="border-top:1px solid var(--line);margin:26px 0 20px"></div>
 <div style="font-size:13px;font-weight:700;margin-bottom:8px">どちらも使えない場合</div>
 <p class="muted" style="font-size:12.5px;line-height:1.8">
   会社の<b>管理者</b>があなたの2段階認証をリセットできます。管理者にご連絡ください。<br>
   一人でお使いの場合は、本人確認のうえ運営が対応します（1営業日）。</p>"""))

_ar_sent = _wrap(_left("送りました。", "リンクの有効期限は1時間です。"), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:var(--primary-c);
   color:var(--primary);display:grid;place-items:center;margin-bottom:20px">{ic("mail")}</div>
 <h1>再設定メールを送りました</h1>
 <div class="sub"><b class="num">info@engine-base.com</b> にメールを送りました。<br>
   リンクの有効期限は<b>1時間</b>です。</div>
 <div class="pz">{ic("warn")}<span>再設定すると、<b>いま入っている全ての端末からサインアウト</b>されます。
   Bridge の接続も切れるので、再設定後につなぎ直してください。</span></div>
 <button class="btn btn-o" style="width:100%">メールを再送する</button>"""))

_ar_rec = _wrap(_left("リカバリコードで入る。", "1つのコードは1回だけ使えます。使ったコードは無効になります。"), _box(f"""
 <h1>リカバリコードを使う</h1>
 <div class="sub">2段階認証の設定時に保存した10個のうち、まだ使っていないものを1つ入力してください。</div>
 {field("リカバリコード", inp("", "xxxx-xxxx", "text", "num", "font-size:17px;letter-spacing:.14em;text-align:center;padding:13px"),
        "残り <b class='num'>8</b> 個。使い切る前に、2段階認証を設定し直してください")}
 <button class="btn btn-p" style="width:100%">{ic("check")}このコードで入る</button>
 <div class="pz" style="margin-top:20px">{ic("info")}<span>入ったあと、<b>新しいリカバリコード10個</b>を発行し直すことをおすすめします。</span></div>"""))

ACCOUNT_RECOVER = ("account-recover", [
  ("r", "再設定を要求", "3つの手段（メール／リカバリコード／管理者リセット）を1画面で全部見せる。行き止まりを作らない。", _ar_req),
  ("s", "送信済み", "", _ar_sent),
  ("c", "リカバリコード", "", _ar_rec),
], AUTH_CSS, True)

ALL = [SIGNUP, VERIFY, INVITE_ACCEPT, TWOFA, SIGNIN, ACCOUNT_RECOVER]
