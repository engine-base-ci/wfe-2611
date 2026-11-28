# -*- coding: utf-8 -*-
"""P10 運営のスキル（D-078）：構築・アップロード・テスト・版・配布・装着"""
from _icons import ic
from _parts import *
from s_p8 import OPS_CSS, _plan

_sk_kind = {"meta": pill("構築メタ","ne"), "goal": pill("目標スキル","ne"), "duty": pill("業務スキル","ne")}
_sk_list = ('<div data-sec="0">' + card(head("スキル", btn("新しい版を上げる","p","upload"), "運営の資産（構築メタ・目標スキル・業務スキル）。顧客には名前・目的・版だけ見える。テストを通した版だけ出せる") + table(["スキル","種類","版","テスト","配布先",("装着","r"),"更新",""], [
    ["会社モデル構築",_sk_kind["meta"],"第 6 版",pill("通った 9/12","su"),"全プラン（自分のAI）",("38","n"),("9/12","n"),btn("開く","o","eye")],
    ["担当業務の定義",_sk_kind["meta"],"第 5 版",pill("通った 9/1","su"),"全プラン（自分のAI）",("38","n"),("9/1","n"),btn("開く","o","eye")],
    ["台帳の設計",_sk_kind["meta"],"第 3 版",pill("通った 8/20","su"),"全プラン（自分のAI）",("38","n"),("8/20","n"),btn("開く","o","eye")],
    ["目標の分解",_sk_kind["meta"],"第 4 版",pill("通った 9/10","su"),"全プラン（自分のAI）",("38","n"),("9/10","n"),btn("開く","o","eye")],
    ["改善提案の作り方",_sk_kind["meta"],"第 2 版",pill("通った 8/2","su"),"スタンダード以上",("31","n"),("8/2","n"),btn("開く","o","eye")],
    ["自分のAIの育成",_sk_kind["meta"],"第 3 版",pill("通った 8/28","su"),"全プラン",("38","n"),("8/28","n"),btn("開く","o","eye")],
    ["トラブル対応",_sk_kind["meta"],"第 4 版 · 第 5 版はテスト中",pill("テスト中","wa"),"全プラン",("38","n"),("9/15","n"),btn("開く","o","eye")],
    ["営業目標（受託開発）",_sk_kind["goal"],"第 3 版",pill("通った 9/1","su"),"スタンダード・プロ",("14","n"),("9/1","n"),btn("開く","o","eye")],
    ["営業目標（飲食）",_sk_kind["goal"],"第 1 版",pill("通った 8/15","su"),"プロ",("3","n"),("8/15","n"),btn("開く","o","eye")],
    ["納期遵守（制作）",_sk_kind["goal"],"第 2 版",pill("通った 8/30","su"),"スタンダード・プロ",("9","n"),("8/30","n"),btn("開く","o","eye")],
    ["発注ナビの新着を台帳に入れる",_sk_kind["duty"],"第 2 版",pill("通った 9/8","su"),"全プラン（営業社員）",("19","n"),("9/8","n"),btn("開く","o","eye")],
    ["請求書の型（税込・内訳）",_sk_kind["duty"],"第 3 版",pill("通った 9/5","su"),"全プラン（経理社員）",("26","n"),("9/5","n"),btn("開く","o","eye")],
    ["入金の照合（正規連携）",_sk_kind["duty"],"第 1 版",pill("通った 8/25","su"),"スタンダード以上（経理社員）",("11","n"),("8/25","n"),btn("開く","o","eye")],
    ["問い合わせの一次返信",_sk_kind["duty"],"第 2 版",pill("通った 7/20","su"),"スタンダード以上（CS社員）",("12","n"),("7/20","n"),btn("開く","o","eye")]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">スキルは自分のAIの中（Bridge 経由）で読まれます。資格情報や台帳の中身はスキルに書きません。</div>') + '</div>')
_sk_one = ('<div data-sec="0 1 2">' + card(head("トラブル対応", _sk_kind["meta"] + " " + pill("第 4 版 · 配布中","su") + " " + pill("第 5 版 · テスト中","wa"), "覚えた操作が壊れた時・承認が滞留した時に、自分のAIが取る手順の型") +
  '<div class="grid g21">' + card(head("版の履歴") + table(["版","いつ","何を変えた","テスト","状態",""], [
     ["第 5 版",("9/15","n"),"画面が変わった型の判定に「検索条件パネル」を追加",pill("テスト中 · 3/5 通過","wa"),pill("未公開","ne"),btn("テストで動かす","p","play")],
     ["第 4 版",("9/1","n"),"承認が滞留の型に「承認者が 1 人」を追加",pill("通った","su"),pill("配布中 · 38 社","su"),btn("戻す先にする","g","undo")],
     ["第 3 版",("8/10","n"),"初版からの整理",pill("通った","su"),pill("2 社が旧版","ne"),""]]) +
     '<div style="height:12px"></div>' + head("テストの結果（第 5 版）", sub="外に出ない。運営のテスト会社で動かす") + table(["場面","結果"], [["発注ナビの画面変更",pill("通った","su")],["承認者が 1 人で不在",pill("通った","su")],["PC が閉じたまま 3 日",pill("通った","su")],["外部サービスの規約変更（禁止に）",pill("失敗 · 案内文が出ない","da")],["資格情報の失効",pill("未実施","ne")]]) +
     note("失敗が 1 つでもあると出せません。直して再テスト。", "warn")),
   card(head("配布先と装着") + table(["プラン","配る","装着数"], [[_plan("e"),pill("配る","su"),"7 社 · 7 体"],[_plan("s"),pill("配る","su"),"22 社 · 24 体"],[_plan("p"),pill("配る","su"),"9 社 · 12 体"]]) +
     '<div style="height:12px"></div>' + head("装着の状況（会社 × AI社員）", sub="会社が外したものは灰色") + table(["会社","自分のAI","AI社員","版"], [["ENGINE BASE",pill("使う","su"),"営業社員 · 経理社員 · CS社員","第 4 版"],["ミナト建装",pill("使う","su"),"営業社員 · 経理社員","第 4 版"],["スミレ食品",pill("外した","ne"),"—","第 3 版（旧版）"]]) +
     '<div class="acts">' + btn("第 5 版を出す（テスト通過後）","p","upload") + btn("旧版の会社に版の更新を知らせる","o","send","v1-ops-notices.html") + '</div>') + '</div>') + '</div>')
_sk_up = ('<div data-sec="0 1 2">' + grid([card(head("新しい版を上げる", sub="スキルの中身（手順・型・判定基準）。Bridge 経由の Claude Code が読む形式") +
    field("スキル", '<select class="inp"><option>トラブル対応（第 5 版になる）</option><option>新しいスキル</option></select>') +
    f'<div class="dropz" style="padding:24px">{ic("upload")}スキルの一式を落とす<small>SKILL.md（発動条件・読む入力・手順・出す出力・判定基準・禁止・テスト場面）＋ 型と例 ＋ テスト場面の期待。資格情報・台帳の中身・会社名は入れない（機械で検査）</small></div>' +
    field("何を変えたか（版に残る）", inp("画面が変わった型の判定に「検索条件パネル」を追加")) +
    '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin:8px 0 14px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("check")}{x}</div>' for x in ["必須の節が揃い、資格情報・会社名・個人名が無い。場面が 5 つ以上ある（機械検査。落ちたら版は作られない）","運営のテスト会社で 5 場面を動かし、期待と突き合わせる（外に出ない）","通ったら「出す」。会社側は版を上げるまで変わらない"]) + '</div>' +
    '<div class="acts">' + btn("上げてテストで動かす","p","play") + btn("下書き","g") + '</div>'),
  card(head("テストの場面", sub="スキルの種類ごとに運営が決めた場面。全部通らないと出せない") + table(["場面","何を見る"], [["発注ナビの画面変更","覚え直しの案内が出るか"],["承認者が 1 人で不在","承認者を足す案内が出るか"],["PC が閉じたまま 3 日","サーバー経路の案内と溜まった分の扱い"],["外部サービスの規約変更（禁止に）","人へのハンドオフに落ちるか"],["資格情報の失効","再登録の案内が出るか（AI に見せない）"]]))], "g21") + '</div>')
OPS_SKILLS = ("ops-skills", [("n","スキル","運営の資産。構築・アップロード・テスト・版・配布・装着。",_sk_list),("d","1 つの中身","版の履歴・テストの結果・配布先・装着の状況。",_sk_one),("u","アップロード","新しい版を上げてテストで動かす。通ったら出す。",_sk_up)],
  OPS_CSS + ".dropz{border:1px dashed var(--line);border-radius:var(--r-xl);padding:34px 20px;text-align:center;background:var(--surface);font-size:13.5px}.dropz svg{display:block;margin:0 auto 10px;width:26px;height:26px;color:var(--on-sv)}.dropz small{display:block;color:var(--on-sv);font-size:12px;margin-top:6px}",
  False, {"スキル":"14","1 つの中身":"","アップロード":"!1"})
SCREENS = [OPS_SKILLS]
