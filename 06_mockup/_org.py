# -*- coding: utf-8 -*-
"""この会社の層・人・権限（D-073）。層は会社ごと（運営／会社／会社が決めた層 0〜n／個人）。
 役割ごとに「見えるもの」「直せるもの」が変わる。画面はここを読んで役割ごとの塊（data-roles）を作る。"""
from _icons import ic

# 会社が決めた層（会社と個人の間）。名前はこの会社の呼び方。一人社長（R1）は 0 個
LAYERS = ["事業", "部署"]
UNITS = {"事業": [("受託開発", "高本")], "部署": [("営業", "高本"), ("制作", "佐藤"), ("CS", "高本"), ("経理", "高本")]}   # (名前, 長)
LEAD = {u: l for us in UNITS.values() for u, l in us}
LAYER_C = {"運営": "var(--on-sv)", "会社": "var(--d-indigo)", "事業": "var(--d-plum)", "部署": "var(--d-teal)", "個人": "var(--d-amber)", "AI社員": "var(--tertiary)"}
UNIT_C = {"営業": "var(--d-indigo)", "制作": "var(--d-plum)", "CS": "var(--d-teal)", "経理": "var(--d-amber)", "受託開発": "var(--d-plum)", "外部": "var(--on-sv)"}

# 役割ごと：本人・見える範囲・直せる範囲。範囲 = (層, 単位)。単位 "" は層そのもの
ROLE_ORG = {
 "R1": {"me": "高本", "role": "代表（一人）", "layers": [],
        "see": [("運営", ""), ("個人", "高本"), ("AI社員", "営業社員"), ("AI社員", "経理社員")],
        "edit": lambda l, u: l in ("個人", "AI社員")},
 "R2": {"me": "高本", "role": "代表", "layers": LAYERS,
        "see": None,                                   # 全部
        "edit": lambda l, u: l != "運営"},
 "R3": {"me": "佐藤", "role": "担当者（制作）", "layers": LAYERS,
        "see": [("運営", ""), ("会社", ""), ("部署", "制作"), ("個人", "佐藤"), ("AI社員", "CS社員")],
        "edit": lambda l, u: (l, u) in (("個人", "佐藤"), ("部署", "制作"))},   # 制作の長なので制作は直せる
 "R4": {"me": "鈴木", "role": "閲覧のみ（外部）", "layers": LAYERS,
        "see": [("運営", ""), ("個人", "鈴木")],
        "edit": lambda l, u: (l, u) == ("個人", "鈴木")},
}
def can_see(role, layer, unit):
    s = ROLE_ORG[role]["see"]; return True if s is None else (layer, unit) in s
def can_edit(role, layer, unit): return ROLE_ORG[role]["edit"](layer, unit)
def editor(layer, unit):
    """その範囲を直せる人（権限の既定）"""
    return {"運営": "運営（変えられない）", "会社": "代表・権限のある人", "個人": "本人だけ", "AI社員": "担当業務の管理者（高本）"}.get(layer) or f"{unit}の長（{LEAD.get(unit, '—')}）"
def scope_name(layer, unit): return layer if not unit else f"{layer} · {unit}"
def me_of(role): return ROLE_ORG[role]["me"]
def lock_chip(text="見るだけ"): return f'<span class="ro">{ic("lock")}{text}</span>'
def you_line(role, layer, unit):
    if can_edit(role, layer, unit):
        return "直せる（本人のもの）" if layer == "個人" else f"直せる（{editor(layer, unit)}）"
    return f"見るだけ。直したいときは {editor(layer, unit)} に頼む"
ORG_CSS = """
.ro{display:inline-flex;gap:4px;align-items:center;font-size:11.5px;color:var(--on-sv);white-space:nowrap}.ro svg{width:12px;height:12px}
.grp.v .ro{margin-left:auto}
.you{display:inline-flex;gap:6px;align-items:center;font-size:12px;padding:3px 9px;border-radius:var(--r-full);background:var(--surface)}
.you.ok{background:#DCFCE7;color:#166534}.you svg{width:13px;height:13px}
.ptbl{width:100%;border-collapse:collapse;font-size:13px}
.ptbl th,.ptbl td{padding:9px 10px;border-bottom:1px solid var(--line-soft);text-align:left;vertical-align:middle}
.ptbl th{font-size:11.5px;font-weight:600;color:var(--on-sv);background:var(--surface)}
.ptbl td:first-child{font-weight:600;white-space:nowrap}
.pt{display:inline-flex;gap:5px;align-items:center;font-size:12px;padding:3px 9px;border-radius:var(--r-full);border:1px solid var(--line);background:var(--card);margin:2px 3px 2px 0;cursor:pointer}
.pt[aria-pressed=true]{background:var(--primary-c);border-color:transparent;color:var(--on-primary-c)}
.pt.fixed{background:var(--sv);border-color:transparent;color:var(--on-sv);cursor:default}
.pt.fixed svg{width:11px;height:11px}
.pt:hover:not(.fixed){border-color:var(--primary)}
.ptbl .cell{display:flex;flex-wrap:wrap}
@media(max-width:767px){.ptbl{display:block;overflow-x:auto;white-space:nowrap}}
"""
