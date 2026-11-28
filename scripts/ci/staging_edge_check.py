#!/usr/bin/env python3
"""K-262：画面と口を同じ住所にまとめる前の staging の確かめ（読むだけ・入れる前のゲート）。
口の確かめの口 GET /api/edge/echo（KANAME_EDGE_ECHO=1 の間だけ開く）を、直の道（STAGING_API_BASE）と画面を通した中継の道（STAGING_BASE_URL）で
2 回ずつ呼ぶ（ふつう・秘密を付けずに x-kaname-client-country: US と x-kaname-client-ip を付けた偽り）。
直と中継で IP・国が同じで、偽った頭がどちらの道でも無視されれば 0。違えば 1。住所が無い・形が違えば何も送らずに 2。
住所と秘密・頭の値・例外の写しは出さない。住所の読み方と当て方は staging_health.py をそのまま使う"""
from __future__ import annotations

import json
import re
import sys

import staging_health as sh

ECHO = "/api/edge/echo"
TIMEOUT = 20.0
FORGED = {"x-kaname-client-country": "US", "x-kaname-client-ip": "198.51.100.7"}
COUNTRY = re.compile(r"^[A-Z]{2}$")
LEAK_PREFIXES = ("x-middleware-",)
LEAK_NAMES = ("x-kaname-edge-secret",)


class Bad(Exception):
    """確かめが赤（決まった文だけを持つ）"""


def ask(side: str, base: str, forged: bool) -> dict[str, object]:
    """1 回当てて {ip, country} を返す。待っていない答えは Bad"""
    try:
        status, body, headers = sh.fetch(base + ECHO, TIMEOUT, headers=dict(FORGED) if forged else None)
    except Exception as e:  # noqa: BLE001 届かない：例外の名前だけを出す（写しは出さない）
        raise Bad(f"{side}の道に届かない（{type(e).__name__}）") from None
    if status == 404:
        raise Bad("確かめの口が閉じている（KANAME_EDGE_ECHO=1 を口の staging に入れてから流す）")
    names = [k.lower() for k in (headers.keys() if headers is not None else [])]
    if any(n in LEAK_NAMES or n.startswith(LEAK_PREFIXES) for n in names):
        raise Bad(f"中継の頭が漏れている（{side}の道の答えの頭）")
    if status != 200:
        raise Bad(f"{side}の道が {status} を返した")
    try:
        data = json.loads(body)
    except ValueError:
        raise Bad(f"{side}の道の答えが JSON でない") from None
    if not isinstance(data, dict):
        raise Bad(f"{side}の道の答えが JSON の組でない")
    return data


def readable(side: str, a: dict[str, object]) -> None:
    ip, country = a.get("ip"), a.get("country")
    if not isinstance(ip, str) or not ip or not isinstance(country, str) or not COUNTRY.match(country):
        raise Bad(f"{side}の道で IP か国が読めない")


def run(web: str, api: str) -> list[str]:
    lines: list[str] = []
    answers: dict[tuple[str, bool], dict[str, object]] = {}
    for side, base in (("直", api), ("中継", web)):
        for forged in (False, True):
            answers[(side, forged)] = ask(side, base, forged)
    for side in ("直", "中継"):
        readable(side, answers[(side, False)])
    d, p = answers[("直", False)], answers[("中継", False)]
    if d.get("country") != p.get("country"):
        raise Bad(f"国が直と中継で違う：直 {sh._short(d.get('country'))}・中継 {sh._short(p.get('country'))}")
    if d.get("ip") != p.get("ip"):
        raise Bad(f"IP が直と中継で違う：直 {sh._short(d.get('ip'))}・中継 {sh._short(p.get('ip'))}")
    lines.append("IP・国：直と中継で同じ")
    for side in ("直", "中継"):
        if answers[(side, True)] != answers[(side, False)]:
            raise Bad(f"偽った頭を信じた（{side}の道）")
    lines.append("偽った頭は無視された（直・中継）")
    return lines


def main() -> int:
    addresses = sh.read_addresses([])
    if addresses is None:
        print("確かめていない（住所の環境の値を入れてから流す）")
        return 2
    web, api = addresses
    try:
        lines = run(web, api)
    except Bad as e:
        print(f"★ {e}")
        return 1
    for ln in lines:
        print(f"OK {ln}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
