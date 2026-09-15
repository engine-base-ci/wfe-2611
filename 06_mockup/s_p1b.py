# -*- coding: utf-8 -*-
"""P1 はじめの設定：bridge-setup / credentials / onboard-testrun / onboard-golive"""
from _icons import ic
from _parts import *
from _wiz import *

def _step(n, t, d, state):
    i = {"done":ic("check"),"now":'<span class="spin dark"></span>',"todo":ic("clock")}[state]
    c = {"done":"var(--st-success)","now":"var(--st-progress)","todo":"var(--on-sv)"}[state]
    return (f'<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line-soft)">'
            f'<span style="color:{c};margin-top:3px">{i}</span><div><div style="font-weight:600;font-size:13.5px">{n}. {t}</div>'
            f'<div class="muted" style="font-size:12.5px">{d}</div></div></div>')

# ============================================================ bridge-setup
_br_why = card(head(f'{ic("shield")}Bridge が何をするか・しないか') +
  '<div class="dl">' + "".join(f'<div>{ic("check")}<span>{t}</span></div>' for t in [
    "あなたのPCで、あなたのブラウザ・あなたのログイン済みセッションを使って動く",
    "だから CAPTCHA や bot 検知に到達しない（本人の環境・本人のペース）",
    "PCが閉じている間は動きません。起きたときに溜まった分を順に片づけます（サーバー経路は段階2）",
  ]) + "".join(f'<div>{ic("ban")}<span>{t}</span></div>' for t in [
    "資格情報を読まない（預かり先の番号だけを受け取る）",
    "銀行をブラウザで触らない",
    "利用規約で自動操作を禁じるサービスは操作しない",
  ]) + '</div><div style="margin-top:12px"><a href="v1-security-brief.html" style="color:var(--primary);font-weight:600;font-size:13px">できること・できないことの全一覧 →</a></div>')

_br = grid([
  card(head("自分のPCをつなぐ") +
    '<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:16px">' + "".join(
      f'<a class="card" style="padding:16px;display:flex;gap:10px;align-items:center" href="#">{ic("download")}<div><b>{o}</b><div class="muted" style="font-size:12px">{d}</div></div></a>'
      for o,d in [("macOS","Apple Silicon / Intel · 38 MB"),("Windows","10 以降 · 41 MB")]) + '</div>' +
    _step(1,"インストーラを入れる","ダウンロードして開く。管理者権限は要りません","done") +
    _step(2,"ブラウザの許可を出す","Bridge が Chrome を操作するための許可を1回だけ","now") +
    _step(3,"接続コードを入れる",'<span style="font-family:var(--font-code);font-size:15px;letter-spacing:.2em">KNM-4821</span>　この画面の番号を Bridge に入れる',"todo") +
    _step(4,"自己診断","Bridge が自分で確かめて、結果をここに返す","todo")),
  _br_why], "g21")

_br_ok = grid([
  card(head("つながりました", pill("接続中","su","check")) +
    kv([("端末","MacBook Pro（高本）· macOS 15.6"),("ブラウザ","Chrome 129 · ログイン済みプロファイル"),
        ("経路","Bridge（本人PC・本人のサブスク）· API は使いません"),("Bridge の版","1.4.2 · 自動更新"),("接続コード","KNM-4821 · 使用済み")]) +
    '<div style="margin-top:16px;display:flex;gap:9px;flex-wrap:wrap">' + btn("この端末を外す","d","x") +
    '<a class="btn btn-p btn-sm" href="v1-onboard-interview.html">' + ic("clone") + '高本AIと話すへ</a></div>') +
  card(head("自己診断の結果") + table(["確かめたこと","結果"], [
      ["Chrome を開いて閉じられる", pill("OK","su")],["ログイン済みのセッションが使える（Google）", pill("OK","su")],
      ["外部への送信を Kaname 経由に限定", pill("OK","su")],["資格情報の直接読み取り", pill("できない（想定どおり）","su")],
      ["PC を閉じたとき", pill("止まる → 起きたら追いつく","su")]])),
  _br_why], "g21")

_br_ng = grid([
  card(head("つながっていません", pill("未接続","da","x")) +
    note("Bridge は入っていますが、<b>ブラウザの許可</b>が出ていません。Chrome の「拡張機能」で Kaname Bridge を有効にしてください。", "danger") +
    _step(1,"インストーラを入れる","","done") + _step(2,"ブラウザの許可を出す","ここで止まっています","now") +
    _step(3,"接続コードを入れる","","todo") + _step(4,"自己診断","","todo") +
    '<div style="margin-top:16px;display:flex;gap:9px;flex-wrap:wrap">' + btn("もう一度確かめる","p","repeat") + btn("あとでやる（高本AIはまだ話せません）","g") + '</div>'),
  _br_why], "g21")

BRIDGE = ("bridge-setup", [
  ("n","接続中","",wiz("bridge-setup",_br,"自分のPCをつなぐ","高本AIもAI社員も、あなたのPCで・あなたのサブスクで動きます。つながるまで高本AIは話せません。API は使いません。",brand=False)),
  ("ok","つながった","",wiz("bridge-setup",_br_ok,"自分のPCをつなぐ","つながりました。",brand=False)),
  ("ng","つながらない","止まっている段を示す。段階1は Bridge 以外の経路が無いので「あとでやる」しか出さない。",wiz("bridge-setup",_br_ng,"自分のPCをつなぐ","止まっています。",brand=False)),
  ("s","運用中（設定として）","同じ画面が運用中はアプリの枠で出る（サイドバー・第2ナビあり）。手順バーは無い。",
   '<div data-sec="0">' + card(head("接続", pill("つながっている","su","check"), "この PC") + kv([("端末","MacBook Pro（高本）· macOS 15"),("最後の応答",'<span class="num">3秒前</span>'),("今日の実行",'<span class="num">14 件</span> · 失敗 0'),("経路","Bridge（本人PC・本人のサブスク）· API は使いません")]) +
     '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">' + btn("接続を確かめる","o","repeat") + btn("この端末を外す","d","x") + '</div>') + '</div>' +
   '<div data-sec="1" hidden>' + card(head("この端末", sub="登録した PC") + table(["端末","登録","最後の応答",""], [["MacBook Pro（高本）",("8/28","n"),("3秒前","n"),pill("使用中","su")],["Mac mini（事務所）",("9/2","n"),("2日前","n"),pill("待機","ne")]])) + '</div>' +
   '<div data-sec="2" hidden>' + card(head("動く条件") + '<div class="dl">' + "".join(f'<div>{ic("check")}<span>{t}</span></div>' for t in ["PC が起きていて Bridge が動いているときだけ動く","PC が閉じている間は止まる。起きたら溜まった分を順に片づける","外部サービスの画面が変わると止まり、覚え直しを待つ"]) + '</div>') + '</div>'),
 ], WIZ_CSS, False)

# ============================================================ credentials
def _svc_row(name, kind, k, extra=""):
    lab = {"api":("正規API","su"),"allowed":("自動操作OK","su"),"unspecified":("規約に記載なし","wa"),"forbidden":("自動操作禁止","da"),"bank":("銀行","da")}[k]
    return [f'<b>{name}</b><div class="muted" style="font-size:12px">{kind}</div>', pill(*lab), extra]

_cr = grid([
  card(head("預けたもの", btn("追加する","o","plus"), "3件") +
    table(["サービス","自動操作","状態"], [
      _svc_row("発注ナビ","案件の入口","allowed", pill("預けた · 預かり先の番号 cr_8a21","ne","key")),
      _svc_row("Google Workspace","メール・カレンダー","api", pill("連携済み（OAuth）","ne","check")),
      _svc_row("freee","会計・請求","api", pill("連携済み（正規API）","ne","check")),
    ])) +
  card(head("追加する") +
    field("サービス", inp("","サービス名か URL を入れる")) +
    f'<div class="ai"><div class="ai-h">{ic("shield")}サービス台帳の判定</div>入力すると、そのサービスの利用規約から <b>自動操作の可否</b> を判定して出します。禁止のサービスは、預けても操作しません。</div>'),
  card(head(f'{ic("lock")}ここに預けたものの扱い') +
    '<div class="dl">' + "".join(f'<div>{ic("check")}<span>{t}</span></div>' for t in [
      "ログイン名・パスワード・ワンタイムコードの鍵は暗号化して保管",
      "入力するのは実行器（Bridge）。AIにも高本AIにも渡らない",
      "AIが受け取るのは預かり先の番号（cr_8a21 のような札）だけ",
      "誰がいつ使ったかは証跡に残る。あなたが見られる",
    ]) + '</div>')], "g21")

_cr_add = grid([
  card(head("追加する") +
    field("サービス", inp("マネーフォワード クラウド")) +
    f'<div class="ai" style="margin-bottom:16px"><div class="ai-h">{ic("shield")}サービス台帳の判定</div>{pill("正規API","su")}　マネーフォワードは公式の連携（API）があります。<b>ブラウザでの自動操作はせず、正規連携で接続します。</b>銀行口座の情報はマネーフォワード側にあり、Kaname は触りません。</div>' +
    '<a class="btn btn-p" href="#">' + ic("globe") + 'マネーフォワードで連携を許可する</a>'),
  card(head("追加する（規約で禁止の例）") +
    field("サービス", inp("某求人サイト")) +
    f'<div class="ai" style="background:#FDF2F2;border-left-color:var(--error);color:var(--error)"><div class="ai-h">{ic("ban")}サービス台帳の判定</div>{pill("自動操作禁止","da")}　このサービスは利用規約で自動操作を禁じています。<b>預けても、AI社員はこのサービスを操作しません。</b>人がやる前提のタスクとして配ります。</div>')], "g2")

_cr_in = grid([
  card(head("発注ナビ のログイン情報") +
    note("ここに入れた値は、<b>この画面を閉じた後は誰にも表示されません</b>。あなたにも、高本AIにも。", "primary") +
    field("メールアドレス（ログイン名）", inp("info@engine-base.com")) +
    field("パスワード", inp("••••••••••","","password")) +
    field("2段階認証のシークレット（あれば）", inp("","JBSW Y3DP ...","text","","font-family:var(--font-code)"), "認証アプリの登録時に出る文字列。Bridge が6桁を生成します") +
    '<div style="display:flex;gap:9px;margin-top:6px">' + btn("保存する","p","lock") + btn("やめる","g") + '</div>'),
  card(head("保存されたあと") + kv([("あなたに見えるもの","預かり先の番号 <span style='font-family:var(--font-code)'>cr_8a21</span> と最終使用日"),
    ("AIに渡るもの","預かり先の番号だけ"),("入力するのは","Bridge（あなたのPC）"),("消したいとき","この画面から1回で消える。証跡は残る")]))], "g2")

CREDS = ("credentials", [
  ("n","預けたもの","",wiz("credentials",_cr,"ログイン情報を預ける","AI社員が使う外部サービスのログイン情報を、暗号化して預けます。AIには一切見せません。",brand=False)),
  ("a","追加する","サービス台帳が可否を判定。銀行は正規連携のみ、禁止は操作しない。",wiz("credentials",_cr_add,"ログイン情報を預ける","サービスごとに、自動操作してよいかを先に判定します。",brand=False)),
  ("i","入力","入力後は本人にも再表示しない。",wiz("credentials",_cr_in,"ログイン情報を預ける","",brand=False)),
  ("s","運用中（設定として）","同じ画面が運用中はアプリの枠で出る。手順バーは無い。", _cr),
 ], WIZ_CSS, False, {"預けたもの":"3","追加する":""})

# ============================================================ onboard-testrun
_tr = grid([
  card(head("テストで動かす", pill("テストモード · 外に出ない","pr","flask")) +
    note("テストモードでは、AI社員は<b>実データを読みます</b>が、<b>外に一切出しません</b>（送信・投稿・書き込みはすべて止まります）。出てきたものを見て、納得したら本番に切り替えます。", "primary") +
    table(["AI社員","試す仕事","状態"], [
      [f'{ic("ai")} 営業社員', "発注ナビの新着を台帳に入れる（読むだけ）", pill("完了 · 12件","su","check")],
      [f'{ic("ai")} 経理社員', "納品済み案件の請求書を下書きする", pill("完了 · 2件","su","check")],
      [f'{ic("ai")} CS社員', "問い合わせに一次返信を下書きする", '<span style="display:flex;gap:6px;align-items:center"><span class="spin dark"></span>実行中</span>'],
    ])),
  card(head("上がってきたもの", sub="高本AIが一次確認済み") +
    '<div class="dl">' +
    f'<div><div style="flex:1"><b>請求書 下書き · 株式会社セイコー</b><div class="muted" style="font-size:12px">1,320,000円 · 案件「食品パッケージ画像編集SaaS」から作成</div></div>{pill("高本AI確認済み","su","check")}{btn("見る","g","eye")}</div>'
    f'<div><div style="flex:1"><b>請求書 下書き · 京蟻</b><div class="muted" style="font-size:12px">1,826,000円 · 税込表示に直すよう高本AIが差し戻し → 修正済み</div></div>{pill("差し戻し1回","wa","repeat")}{btn("見る","g","eye")}</div>'
    f'<div><div style="flex:1"><b>台帳「案件」に 12件</b><div class="muted" style="font-size:12px">発注ナビの新着から · 3件は条件外として見送り（理由つき）</div></div>{pill("高本AI確認済み","su","check")}{btn("見る","g","eye")}</div>'
    '</div>' +
    f'<div class="ai" style="margin-top:16px"><div class="ai-h">{ic("clone")}高本AI</div>3体とも想定どおりに動きました。京蟻の請求書は税込表示になっていなかったので、私が差し戻して直させています。<b>本番に切り替えると、明日の朝から自動で動きます。</b>止めたいときはいつでも止められます。</div>'),
], "g2") + '<div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap"><a class="btn btn-p" href="v1-onboard-golive.html">' + ic("zap") + '本番に切り替える</a>' + btn("もう少し試す","o","flask") + '</div>'

_tr0 = card(empty("flask","まだ何も動かしていません","AI社員を1体選んで、試しに動かしてみてください。外には出ません。",
  btn("営業社員を動かす","p","play") + btn("経理社員を動かす","o","play")))

_tr_ng = grid([
  card(head("テストで動かす", pill("テストモード","pr","flask")) +
    table(["AI社員","試す仕事","状態"], [
      [f'{ic("ai")} 営業社員', "発注ナビの新着を台帳に入れる", pill("止まった","da","x")]])),
  card(head("止まった理由", sub="高本AIから") +
    f'<div class="ai" style="background:#FEF6EC;border-left-color:var(--st-warning);color:#7A4A05"><div class="ai-h">{ic("warn")}CAPTCHA が出ました</div>発注ナビのログインで画像認証が出ました。<b>Kaname は CAPTCHA を突破しません</b>（あなたのアカウントが凍結されるため）。あなたが一度ブラウザで通してくれれば、そのセッションで続きを動かします。</div>' +
    '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">' + btn("ブラウザで開く","p","globe") + btn("この仕事はやめる","g") + '</div>')], "g2")

TESTRUN = ("onboard-testrun", [
  ("n","動かした","",wiz("onboard-testrun",_tr,"テストで動かす","外に一切出ない状態でAI社員を動かし、出てきたものを見て納得してから本番へ。")),
  ("0","最初","",wiz("onboard-testrun",_tr0,"テストで動かす","")),
  ("x","止まった","CAPTCHAは突破しない。人に渡す導線を必ず出す。",wiz("onboard-testrun",_tr_ng,"テストで動かす","")),
 ], WIZ_CSS, True)

# ============================================================ onboard-golive
_gl = grid([
  card(head("本番に切り替える前に") +
    '<div class="dl">' + "".join(f'<div>{ic("check")}<span style="flex:1">{t}</span>{pill("OK","su")}</div>' for t in [
      "会社モデル（目標・台帳・担当業務・AI社員・ルール）が確定している","Bridge がつながっている","外に出るものは承認が要るルールになっている"]) +
    f'<div style="border-left:3px solid var(--st-warning);background:#FEF6EC"><span style="flex:1">経理社員が使う freee の連携が<b>読み取りのみ</b>です。請求書の作成には書き込み権限が要ります</span>{btn("連携を直す","o","wrench","v1-credentials.html")}</div>' +
    '</div>'),
  card(head("切り替えると、明日から") + '<div class="dl">' + "".join(f'<div>{ic("clock")}<span class="num muted" style="min-width:48px">{t}</span><span>{x}</span></div>' for t,x in [
      ("06:00","営業社員が発注ナビの新着を台帳に入れる"),("06:30","経理社員が入金を照合して台帳に書く"),
      ("07:00","高本AIが上がってきたものを一次確認し、承認待ちを作る"),("07:30","高本AIが申し送りを書く。あなたは今日の画面で読む")]) + '</div>' +
    f'<div class="ai" style="margin-top:14px"><div class="ai-h">{ic("clone")}高本AI</div>freee の権限だけ直せば切り替えられます。切り替えたあとも、私は外に出る前に必ずあなたに見せます。</div>')], "g2") + \
  '<div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">' + btn("切り替える（1件の警告を承知のうえで）","o","zap") + '</div>'

_gl_ok = card(f'<div style="text-align:center;padding:36px 20px"><div style="width:60px;height:60px;border-radius:var(--r-full);background:#DCFCE7;display:grid;place-items:center;margin:0 auto 18px;color:var(--st-success)">{ic("check")}</div>'
  '<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">本番で動いています</h2>'
  '<p class="muted" style="max-width:520px;margin:0 auto 22px;line-height:1.85">明日の朝、高本AIの申し送りから始まります。今日はもう何もしなくて大丈夫です。'
  '止めたいときは「今日」の画面からいつでも止められます。</p>'
  f'<a class="btn btn-p" href="v1-today.html">{ic("today")}今日の画面へ</a></div>')

GOLIVE = ("onboard-golive", [
  ("n","確認","足りない設定を潰してから切り替える。1件でも赤なら主アクションを出さない。",wiz("onboard-golive",_gl,"本番に切り替える","足りていない設定を潰して、明日から自動で動く状態にします。")),
  ("ok","切り替えた","",wiz("onboard-golive",_gl_ok,"本番に切り替える","")),
 ], WIZ_CSS, True)

SCREENS = [BRIDGE, CREDS, TESTRUN, GOLIVE]
