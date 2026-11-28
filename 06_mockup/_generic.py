# -*- coding: utf-8 -*-
"""空（データ 0 件）と AI が止まっている の汎用状態。画面ごとに手で作らず、flow.json の目的・主アクション・オブジェクトから作る（G18）。"""
import re
from _icons import ic
from _parts import card, empty, note, btn

STOP_NOTE = ('<div class="stopbar">' + note('<b>AI は止まっています。</b>人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。'
            '止まった理由と直し方は <a href="v1-automation-repair.html" style="font-weight:600">止まっているものを直す</a> にあります。', "warn") + '</div>')

def empty_state(sid, scr, icon):
    obj = (scr.get("objects") or ["もの"])[0]
    return ('<div data-sec="0 1 2 3 4 5 6">' + card(empty(icon, f"まだ{obj}がありません", scr["purpose"] + "。最初の 1 件が入るとここに並びます。", btn(scr["primary_action"], "p"))) + '</div>')

def stopped_state(first_html):
    h = re.sub(r"<script>.*?</script>", "", first_html, flags=re.S)   # 静的な写し：JS と id を重複させない
    h = re.sub(r' id="[^"]*"', "", h)
    return STOP_NOTE + h
