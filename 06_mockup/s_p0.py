# -*- coding: utf-8 -*-
"""P0 契約・登録（シェル無し）：signup / verify-email / invite-accept / mfa-setup / login / password-reset"""
from _icons import ic, LOGO
from _parts import *

def _left(h2, p, steps=None):
    st = ""
    if steps:
        st = '<div class="steps">' + "".join(
            f'<div>{ic("check") if d else ic("clock")}<span style="{"" if d else "opacity:.78"}">{s}</span></div>'
            for s, d in steps) + '</div>'
    return (f'<div class="auth-l"><div class="brand">{LOGO}<span>Kaname</span></div>'
            f'<h2>{h2}</h2><p>{p}</p>{st}'
            f'<div style="margin-top:auto;font-size:12px;opacity:.72">株式会社ENGINE BASE</div></div>')

LEAD = ("高本AIが、<br>会社を回す。",
        "会社のことを高本AIに話すだけで、目標・台帳・担当業務・AI社員のたたき台ができます。"
        "毎日は高本AIと話し、高本AIがAI社員に配り、上がってきたものを一次確認してからあなたに上げます。"
        "あなたが押すのは、最後の一手だけです。")
STEPS = [("アカウントを作る", False), ("自分のPCをつなぐ（Bridge）", False), ("高本AIに会社のことを話す", False),
         ("たたき台を確かめる", False), ("テストで動かして本番へ", False)]

def _box(inner): return f'<div class="auth-r"><div class="auth-box">{inner}</div></div>'
def _wrap(left, box): return f'<div class="auth">{left}{box}</div>'
CB = '<input type="checkbox" style="margin-top:3px;width:18px;height:18px;accent-color:#22345C">'

# ============================================================ signup
_su = _wrap(_left(*LEAD, steps=STEPS), _box(f"""
 <h1>アカウントを作る</h1>
 <div class="sub">会社名とメールだけ。ここではまだ何も設定しません。設定はこのあと高本AIと話しながら作ります。</div>
 {field("メールアドレス", inp("", "name@example.com", "email"))}
 {field("パスワード", inp("", "8文字以上", "password"), "英字と数字を含む8文字以上。よく使われるパスワードは弾きます")}
 {field("会社名（または屋号）", inp("", "株式会社ENGINE BASE"), "あとから変えられます。個人事業なら屋号かお名前で構いません")}
 <label style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--on-sv);margin-bottom:18px">{CB}
   <span>利用規約とプライバシーポリシーに同意します</span></label>
 <button class="btn btn-p" style="width:100%">{ic("login")}はじめる</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:22px">
   すでにお持ちですか？ <a href="v1-login.html" style="color:var(--primary);font-weight:600">ログイン</a></p>"""))
_su_err = _wrap(_left(*LEAD, steps=STEPS), _box(f"""
 <h1>アカウントを作る</h1>
 <div class="sub">会社名とメールだけ。ここではまだ何も設定しません。</div>
 {field("メールアドレス", inp("info@engine-base.com", "", "email", "err"),
        "このメールアドレスは既に登録されています。<a href='v1-login.html' style='color:var(--error);font-weight:600'>ログイン</a>するか、<a href='v1-password-reset.html' style='color:var(--error);font-weight:600'>入り直す</a>へ。", err=True)}
 {field("パスワード", inp("", "8文字以上", "password"))}
 {field("会社名（または屋号）", inp("株式会社ENGINE BASE"))}
 <button class="btn btn-p" style="width:100%">{ic("login")}はじめる</button>"""))
SIGNUP = ("signup", [("n","通常","",_su),
  ("e","既に登録済み","エラーで終わらせない。ログインと入り直しへの導線を必ず出す。",_su_err)], AUTH_CSS, True)

# ============================================================ verify-email
_ve = _wrap(_left(*LEAD, steps=[("アカウントを作る",True)]+STEPS[1:]), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:var(--secondary-c);display:grid;place-items:center;margin-bottom:18px;color:var(--on-secondary-c)">{ic("mail")}</div>
 <h1>メールを確認してください</h1>
 <div class="sub"><b>info@engine-base.com</b> にリンクを送りました。押すと本人であることが記録され、高本AIとのはじめの設定に進みます。</div>
 <div class="pz">{ic("info")}<span>リンクは <b>30分</b> で失効します。届かない場合は迷惑メールも確認してください。</span></div>
 <button class="btn btn-o" style="width:100%">{ic("repeat")}もう一度送る</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:18px">メールアドレスを間違えた？ <a href="v1-signup.html" style="color:var(--primary);font-weight:600">入力し直す</a></p>"""))
_ve_ok = _wrap(_left(*LEAD, steps=[("アカウントを作る",True)]+STEPS[1:]), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#DCFCE7;display:grid;place-items:center;margin-bottom:18px;color:var(--st-success)">{ic("check")}</div>
 <h1>確認できました</h1>
 <div class="sub">次は自分のPCをつなぎます。<b>高本AIはあなたのPCで、あなたのサブスクで動く</b>ので、つながるまで話せません。そのあと訊かれたことに答えるだけで、会社のたたき台ができます。</div>
 <a class="btn btn-p" style="width:100%" href="v1-bridge-setup.html">{ic("bridge")}はじめの設定をはじめる（PCをつなぐ）</a>"""))
_ve_exp = _wrap(_left(*LEAD, steps=[("アカウントを作る",True)]+STEPS[1:]), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#FDF2F2;display:grid;place-items:center;margin-bottom:18px;color:var(--error)">{ic("warn")}</div>
 <h1>リンクの期限が切れています</h1>
 <div class="sub">30分を過ぎました。新しいリンクを送ります。古いリンクはもう使えません。</div>
 <button class="btn btn-p" style="width:100%">{ic("mail")}新しいリンクを送る</button>"""))
VERIFY = ("verify-email", [("n","送信済み","",_ve),("ok","確認できた","リンクを押した直後。ここからはじめの設定へ。",_ve_ok),
  ("x","期限切れ","詰まらせない。再送だけで回復できる。",_ve_exp)], AUTH_CSS, True)

# ============================================================ invite-accept
_inv_left = _left("招かれた人は、<br>自分の分だけ見える。",
  "会社全体の数字や統制は見えません。見えるのは、あなたに配られた仕事と、その進みだけです。"
  "どこを見ればいいかは、代表のAIが最初に説明します。")
_ia = _wrap(_inv_left, _box(f"""
 <div class="pz" style="background:var(--primary-c);color:var(--on-primary-c)">{ic("users")}<span><b>田中 誠</b>（株式会社◯◯ 代表）があなたを <b>担当者</b> として招待しています</span></div>
 <h1>参加する</h1>
 <div class="sub">名前とパスワードだけで入れます。</div>
 {field("お名前", inp("", "佐藤 健"))}
 {field("メールアドレス", inp("sato@example.com", "", "email") , "招待されたアドレス。変えられません")}
 {field("パスワード", inp("", "8文字以上", "password"))}
 {card('<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:8px">あなたに見えるもの</div>'
       + '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">'
       + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("check")}{t}</div>' for t in
         ["今日やること・承認待ち（自分の分）","配られた案件（3件）と自分の進み","代表のAIからの申し送り"])
       + '</div><div style="font-size:12px;color:var(--on-sv);margin-top:10px">見えないもの：会社の目標の全体・売上・他の人の担当・ルールの編集</div>',
       style="margin-bottom:18px;padding:14px")}
 <button class="btn btn-p" style="width:100%">{ic("login")}参加する</button>"""))
_ia_r4 = _wrap(_inv_left, _box(f"""
 <div class="pz" style="background:var(--primary-c);color:var(--on-primary-c)">{ic("users")}<span><b>高本 雅人</b>（ENGINE BASE）があなたを <b>閲覧のみ</b> で招待しています</span></div>
 <h1>参加する</h1>
 <div class="sub">進捗を見るだけの参加です。書き込みはできません。</div>
 {field("お名前", inp("", "鈴木 美咲"))}
 {field("パスワード", inp("", "8文字以上", "password"))}
 {card('<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:8px">あなたに見えるもの</div>'
       + '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">'
       + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("check")}{t}</div>' for t in
         ["共有された案件（2件）の段階と進み"]) + '</div>', style="margin-bottom:18px;padding:14px")}
 <button class="btn btn-p" style="width:100%">{ic("login")}参加する</button>"""))
_ia_x = _wrap(_inv_left, _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#FDF2F2;display:grid;place-items:center;margin-bottom:18px;color:var(--error)">{ic("ban")}</div>
 <h1>この招待は取り消されています</h1>
 <div class="sub">招待した人が取り消したか、7日の期限を過ぎました。もう一度招待してもらってください。</div>"""))
INVITE = ("invite-accept", [("n","担当者として","",_ia),("r4","閲覧のみとして","閲覧のみの人は書き込めない。見える範囲が先に示される。",_ia_r4),
  ("x","取り消し済み","",_ia_x)], AUTH_CSS, True)

# ============================================================ mfa-setup
_mfa = _wrap(_left("入るときは、<br>もう1つの鍵を。",
  "パスワードだけでは入れません。認証アプリの6桁が要ります。端末を失くしたときのために回復コードを保管してください。"), _box(f"""
 <h1>2段階認証を設定する</h1>
 <div class="sub">認証アプリ（Google Authenticator 等）で読み取ってください。</div>
 <div style="display:grid;place-items:center;background:var(--sv);border-radius:var(--r-lg);padding:22px;margin-bottom:16px">
  <div style="width:150px;height:150px;background:repeating-conic-gradient(var(--on-surface) 0 25%,#fff 0 50%) 0 0/16px 16px;border:6px solid #fff;border-radius:4px"></div>
  <div class="muted" style="font-size:12px;margin-top:10px">読み取れない場合は <span style="font-family:var(--font-code)">JBSW Y3DP EHPK 3PXP</span></div></div>
 {field("アプリに出た6桁", inp("", "000000", "text", "", "font-family:var(--font-code);font-size:20px;letter-spacing:.3em;text-align:center"))}
 <button class="btn btn-p" style="width:100%">{ic("lock")}登録する</button>"""))
_mfa_rc = _wrap(_left("入るときは、<br>もう1つの鍵を。",
  "パスワードだけでは入れません。認証アプリの6桁が要ります。"), _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:#DCFCE7;display:grid;place-items:center;margin-bottom:18px;color:var(--st-success)">{ic("check")}</div>
 <h1>回復コードを保管してください</h1>
 <div class="sub">端末を失くしたとき、この10個のどれか1つで入れます。1つ使うと消えます。<b>ここを閉じると二度と表示しません。</b></div>
 <div class="code" style="font-size:14px;letter-spacing:.06em;line-height:2">k8f2-9x1m   p3q7-w2ne   a9d4-r6ty   z1c5-h8jl   m2v6-b4gk
t7n3-s5qw   e4r8-y2uo   i6p1-l9as   d3f7-g5hj   x8z2-c4vb</div>
 <div style="display:flex;gap:9px;margin:16px 0">{btn("コピー","o","file")}{btn("ファイルで保存","o","download")}</div>
 <label style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--on-sv);margin-bottom:14px">{CB}<span>安全な場所に保管しました</span></label>
 <a class="btn btn-p" style="width:100%" href="v1-bridge-setup.html">{ic("arrow")}次へ（PCをつなぐ）</a>"""))
MFA = ("mfa-setup", [("n","登録","",_mfa),("rc","回復コード","2FA紛失で復旧不能（L-003）を構造で潰す。",_mfa_rc)], AUTH_CSS, True)

# ============================================================ login
_lg_left = _left("今日も、<br>高本AIが先に動いている。",
  "夜のうちにAI社員が動き、高本AIが一次確認を終えています。ログインすると申し送りから始まります。")
_lg = _wrap(_lg_left, _box(f"""
 <h1>ログイン</h1>
 <div class="sub">毎日ここから。</div>
 {field("メールアドレス", inp("info@engine-base.com", "", "email"))}
 {field("パスワード", inp("••••••••••", "", "password"))}
 <button class="btn btn-p" style="width:100%">{ic("login")}ログイン</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:18px">
   <a href="v1-password-reset.html" style="color:var(--primary);font-weight:600">入れなくなった</a>　·　<a href="v1-signup.html" style="color:var(--primary);font-weight:600">アカウントを作る</a></p>"""))
_lg_mfa = _wrap(_lg_left, _box(f"""
 <h1>6桁を入れてください</h1>
 <div class="sub">認証アプリに出ている数字です。30秒ごとに変わります。</div>
 {field("6桁", inp("", "000000", "text", "", "font-family:var(--font-code);font-size:20px;letter-spacing:.3em;text-align:center"))}
 <label style="display:flex;gap:9px;align-items:center;font-size:12.5px;color:var(--on-sv);margin-bottom:16px">{CB}<span>この端末では30日間きかない</span></label>
 <a class="btn btn-p" style="width:100%" href="v1-today.html">{ic("arrow")}今日の画面へ</a>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:18px"><a href="v1-password-reset.html" style="color:var(--primary);font-weight:600">端末を失くした（回復コードで入る）</a></p>"""))
_lg_err = _wrap(_lg_left, _box(f"""
 <h1>ログイン</h1>
 <div class="sub">毎日ここから。</div>
 {field("メールアドレス", inp("info@engine-base.com", "", "email"))}
 {field("パスワード", inp("••••••", "", "password", "err"), "メールアドレスかパスワードが違います。あと4回で15分間ロックします。", err=True)}
 <button class="btn btn-p" style="width:100%">{ic("login")}ログイン</button>
 <p class="muted" style="font-size:12.5px;text-align:center;margin-top:18px"><a href="v1-password-reset.html" style="color:var(--primary);font-weight:600">入れなくなった</a></p>"""))
LOGIN = ("login", [("n","通常","",_lg),("m","6桁の入力","2段階目。「この端末ではきかない」で毎日の負担を下げる。",_lg_mfa),
  ("e","失敗","回数制限を出す（無制限試行を構造で潰す）。",_lg_err)], AUTH_CSS, True)

# ============================================================ password-reset
_pr_left = _left("詰まらせない。", "パスワードを忘れても、端末を失くしても、自分で入り直せます。運営に連絡しなくて済むように作ってあります。")
_pr = _wrap(_pr_left, _box(f"""
 <h1>入り直す</h1>
 <div class="sub">登録したメールアドレスに再設定のリンクを送ります。</div>
 {field("メールアドレス", inp("", "name@example.com", "email"))}
 <button class="btn btn-p" style="width:100%">{ic("mail")}再設定メールを送る</button>
 <div style="height:1px;background:var(--line);margin:22px 0"></div>
 <div style="font-size:13px;font-weight:600;margin-bottom:6px">端末を失くした（認証アプリが使えない）</div>
 <div class="muted" style="font-size:12.5px;margin-bottom:12px">設定時に保管した回復コードのどれか1つで入れます。</div>
 {field("回復コード", inp("", "k8f2-9x1m", "text", "", "font-family:var(--font-code)"))}
 <button class="btn btn-o" style="width:100%">{ic("key")}回復コードで入る</button>"""))
_pr_sent = _wrap(_pr_left, _box(f"""
 <div style="width:52px;height:52px;border-radius:var(--r-full);background:var(--secondary-c);display:grid;place-items:center;margin-bottom:18px;color:var(--on-secondary-c)">{ic("mail")}</div>
 <h1>送りました</h1>
 <div class="sub">登録があれば、<b>info@engine-base.com</b> に届きます（登録の有無はここでは表示しません）。リンクは30分で失効します。</div>
 <div class="pz">{ic("info")}<span>再設定すると、<b>今ログイン中の端末と Bridge の接続はすべて切れます</b>。入り直してからつなぎ直してください。</span></div>
 <a class="btn btn-g" style="width:100%" href="v1-login.html">ログインへ戻る</a>"""))
_pr_new = _wrap(_pr_left, _box(f"""
 <h1>新しいパスワード</h1>
 <div class="sub">前と同じものは使えません。</div>
 {field("新しいパスワード", inp("", "8文字以上", "password"))}
 {field("もう一度", inp("", "", "password"))}
 <button class="btn btn-p" style="width:100%">{ic("check")}変更してログイン</button>"""))
RESET = ("password-reset", [("n","入り直す","",_pr),("s","送信後","登録の有無を漏らさない。既存セッションの失効を先に伝える（G-14）。",_pr_sent),
  ("p","新しいパスワード","",_pr_new)], AUTH_CSS, True)

SCREENS = [SIGNUP, VERIFY, INVITE, MFA, LOGIN, RESET]
