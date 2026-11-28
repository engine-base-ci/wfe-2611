# -*- coding: utf-8 -*-
"""AI が使うブラウザ（D-119・D-120）の部品。PC の画面（bridge-setup）と会話（clone-chat）の両方で同じものを使う（L-008：1 部品）。
  pick(cur)      … 自分の Chrome／Bridge 専用のブラウザ／使わない を PC ごとに選ぶ（Kaname が正本）
  fix(open_)     … Chrome とつながっていないときの一手：つなぎ方（公式の入口）・もう一度確かめる・専用のブラウザに切り替える
"""
from _icons import ic

# 公式の入口（2026-09-30 に code.claude.com/docs/en/chrome で確かめた）
CWS = "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn"

BROWSER_CSS = """
.bpick{display:grid;gap:8px;margin-top:4px}
.bpick label{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-md);cursor:pointer;background:var(--card)}
.bpick label:hover{border-color:var(--neutral)}
.bpick label:has(input:checked){border-color:var(--primary);background:var(--primary-c)}
.bpick input{margin-top:4px;accent-color:var(--primary)}
.bpick b{font-size:14px;font-weight:600}
.bpick .muted{display:block;font-size:12px;line-height:1.6}
.bfix{margin-top:8px}
.bfix .bact{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
.bfix details{margin-top:8px}
.bfix summary{cursor:pointer;font-size:14px;font-weight:600;color:var(--primary)}
.bfix ol{margin:8px 0 0;padding-left:20px;font-size:14px;line-height:1.8}
.bfix ol a{color:var(--primary);font-weight:600}
"""


def steps() -> str:
    return (
        '<ol>'
        '<li>Chrome を開く（閉じていると AI は使えません）</li>'
        f'<li>拡張機能「Claude in Chrome」を入れて有効にする：<a href="{CWS}" target="_blank" rel="noreferrer">Chrome ウェブストアで開く</a>。初めて入れたときは Chrome を一度開き直す</li>'
        '<li>拡張機能に、この PC の Claude Code と同じアカウントでログインする</li>'
        '</ol>'
    )


def fix(open_: bool = False) -> str:
    """つながっていないときの一手。押すものは 3 つ：つなぎ方を見る（開く）・もう一度確かめる・専用のブラウザに切り替える"""
    return (
        f'<div class="bfix" data-browser-fix>'
        f'<details{" open" if open_ else ""}><summary>つなぎ方を見る</summary>{steps()}</details>'
        f'<div class="bact">'
        f'<button class="btn btn-o btn-sm">{ic("repeat")}もう一度確かめる</button>'
        f'<button class="btn btn-g btn-sm">{ic("globe")}Bridge 専用のブラウザに切り替える</button>'
        f'</div></div>'
    )


OPTIONS = [
    ("chrome", "自分の Chrome（Claude in Chrome）", "いつもの Chrome とそのログインの状態をそのまま使います。拡張機能「Claude in Chrome」が要ります"),
    ("dedicated", "Bridge 専用のブラウザ", "いつもの Chrome とは別のログインの状態で動きます。Chrome を閉じていても使えます"),
    ("off", "使わない", "AI はブラウザを開きません"),
]


def pick(cur: str = "chrome") -> str:
    return '<div class="bpick" role="radiogroup" aria-label="AI が使うブラウザ">' + "".join(
        f'<label><input type="radio" name="browser" value="{v}"{" checked" if v == cur else ""}>'
        f'<span><b>{t}</b><span class="muted">{d}</span></span></label>'
        for v, t, d in OPTIONS
    ) + "</div>"
