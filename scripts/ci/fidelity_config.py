#!/usr/bin/env python3
"""キャンバスとの見た目の突き合わせの設定（04_design/fidelity.json）の検査（K-216）。

  python3 scripts/ci/fidelity_config.py [--root <根>] [--required <組の id,…>] (--base-ref <版> | --no-base)
  python3 scripts/ci/fidelity_config.py --print-required     既定の段 1 の組の id（空白区切り）
  python3 scripts/ci/fidelity_config.py --print-rules        種類と役の表（JSON）
  python3 scripts/ci/fidelity_config.py --selftest

赤（1 で終わる）にするもの：
  ・組の欄：id・知っている kind・絵が在る（04_design/canvas/<絵>.dc.html）・kind の幅を含む・持ち主が在る（11_tickets/<持ち主>.md）・app・state・enrolled
  ・kind に要る役が欠ける／役に要る値が欠ける（組と役と値の名前を出す）。散文の「最低いくつ」にせず、下の ROLES・KINDS で決める
  ・段 1 の組（--required・既定は REQUIRED）が無い
  ・enrolled の組の state の鍵が画面を整える道具（apps/web/tests/_lib/fidelity-states.ts）に無い（"<鍵>": の字で探す）
  ・本線との分かれ目（--base-ref）で enrolled だった組が、消えた・false になった・(値の name, 値, 幅) の集まりが前の版を含まない・
    前の版に在った値（name）のセレクタが変わった・絵や画面の道や state（画面を整える鍵）が変わった。版が読めなければ赤（版はあるが設定がまだ無い版は、前の組が無いとして扱う）
  ・比べ方の指定（--base-ref か --no-base）が無い
入っていない組の見張り（--owners-done --base-ref <版>・K-238）：
  ・enrolled でない組の数を「入っていない組 N / M」で出す
  ・持ち主が取り込み済みなのに enrolled でない組があれば赤（組の id と持ち主を同じ行に出す）。
    取り込み済み＝<版> の履歴に件名が「<持ち主> 」で始まるコミットが在る（本線は早送りでだけ進む）か、持ち主の md の stage が確認中か完了か、
    --ticket <番号> で渡した今のチケット（持ち主が入れ忘れたら持ち主自身の CI で赤）。持ち主が子を持つ親なら、子（parent: <持ち主>）が全部取り込み済みのとき
  ・持ち主の md が無い・stage の行が無いか知らない値・<版> が読めない は赤。保留は取り込み前として数える
CI につなぐときは --no-base と --required の上書きを使わない（使うと入れた組を弱めても緑になる）。
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CONFIG = "04_design/fidelity.json"
STATES = "apps/web/tests/_lib/fidelity-states.ts"

# 役ごとに要る値（11_tickets/K-216.md の「役と要る値」と同じ）
ROLES: dict[str, list[str]] = {
    "h1": ["font-size", "font-weight", "line-height", "color", "x", "y"],
    "head": ["background-color", "border-bottom-color", "border-bottom-width", "padding-top", "padding-left", "height", "width", "x", "y"],
    "body": ["padding-top", "padding-left", "width", "x", "y"],
    "primary": ["height", "background-color", "color", "font-size", "font-weight", "border-radius", "x", "y"],
    "input": ["width", "height", "background-color", "border-top-color", "border-radius", "font-size"],
    "card": ["background-color", "border-top-color", "border-radius", "padding-top", "padding-left", "width", "x"],
    "band": ["background-color", "border-top-color", "border-radius", "padding-top", "width", "x", "y"],
    "band-title": ["font-size", "font-weight"],
    "dialog": ["width", "border-radius", "background-color", "x", "y"],
    "dialog-title": ["font-size", "font-weight"],
    "nav": ["width", "background-color", "x"],
    "nav-items": ["texts", "height", "font-size"],
    "subnav": ["texts", "width", "x"],
    "bar": ["height", "background-color", "texts"],
    "tabs": ["texts", "height"],
}
# 組の種類ごとに要る役と幅（11_tickets/K-216.md の「組の種類と要る役・幅」と同じ）
KINDS: dict[str, dict[str, list[Any]]] = {
    "page": {"roles": ["h1", "head", "body"], "widths": [1440, 375]},
    "form": {"roles": ["h1", "head", "body", "input", "primary"], "widths": [1440, 375]},
    "auth": {"roles": ["card", "h1", "input", "primary"], "widths": [1440, 375]},
    "auth-msg": {"roles": ["card", "h1", "primary"], "widths": [1440, 375]},
    "doc": {"roles": ["card", "h1"], "widths": [1440, 375]},
    "band": {"roles": ["band", "band-title"], "widths": [1440, 375]},
    "dialog": {"roles": ["dialog", "dialog-title", "primary"], "widths": [1440, 375]},
    "shell-nav": {"roles": ["nav", "nav-items", "bar"], "widths": [1440]},
    "shell-sub": {"roles": ["nav", "subnav"], "widths": [1440]},
    "shell-tabs": {"roles": ["tabs"], "widths": [375]},
}
# 種類ごとに、役に要る値のうち外してよい物（K-232）。長い文面（doc）の見出しは、キャンバスでは短い文面を縦の真ん中に置き、
#   本物の文面は上から始まるので、縦の位置 y は比べられない。外せるのは doc の h1 の y だけで、ほかの値（x・字の大きさ・太さ など）と
#   ほかの種類の y は今までどおり要る
KIND_OPTIONAL: dict[str, dict[str, list[str]]] = {
    "doc": {"h1": ["y"]},
}
# 段 1 の組（11_tickets/K-216.md の「段 1 の組」と同じ 21 組）
REQUIRED: list[str] = [
    "signup", "signup-waiting", "login", "login-2fa", "legal",
    "tickets-first", "tickets-main", "tickets-list", "tickets-new", "tickets-new-sections",
    "ticket-detail", "band-approval", "band-running", "band-failed", "approve-modal", "approvals",
    "bridge-code", "bridge-connected", "bridge-shell", "shell-nav", "shell-tabs",
]


def _str(v: Any) -> bool:
    return isinstance(v, str) and v.strip() != ""


# 見出しの帯の余白（K-231）：絵が帯の余白を帯の中の div で持つとき、役 head の組の padding は帯では比べられない。
#   組に「キャンバスが <その head のキャンバス> > div・画面がその head の画面と同じ」で padding を比べる役 body の組（帯の余白の組）が
#   あるときだけ、その head の padding-top・padding-left を外せる。帯の余白の組は種類に要る役 body の数に入れない（本文の箱の組は今までどおり要る）
HEAD_PAD = ["padding-top", "padding-left"]


def _head_keys(pairs: list[Any]) -> set[tuple[str, str]]:
    """帯の余白の組になれる（キャンバス・画面）の組：役 head の組ごとに（<キャンバス> > div・<画面>）"""
    return {
        (f"{p.get('canvas')} > div", str(p.get("app")))
        for p in pairs
        if isinstance(p, dict) and p.get("role") == "head"
    }


def _is_head_pad(p: dict[str, Any], heads: set[tuple[str, str]]) -> bool:
    return p.get("role") == "body" and (str(p.get("canvas")), str(p.get("app"))) in heads


def _optional(kind: str, p: dict[str, Any], pads: set[tuple[str, str]]) -> list[str]:
    role = p.get("role")
    extra = HEAD_PAD if role == "head" and (f"{p.get('canvas')} > div", str(p.get("app"))) in pads else []
    return KIND_OPTIONAL.get(kind, {}).get(role, []) + extra


def check_pairs(gid: str, kind: str, pairs: Any) -> list[str]:
    """組の値（pairs）の形と、種類に要る役・役に要る値"""
    errs: list[str] = []
    if not isinstance(pairs, list) or not pairs:
        return [f"{gid}：pairs（組の値）が無い"]
    heads = _head_keys(pairs)
    pads = {
        (str(p.get("canvas")), str(p.get("app")))
        for p in pairs
        if isinstance(p, dict) and _is_head_pad(p, heads) and all(x in (p.get("props") or []) for x in HEAD_PAD)
    }
    names: set[str] = set()
    roles: set[str] = set()
    for i, p in enumerate(pairs):
        if not isinstance(p, dict):
            errs.append(f"{gid}：pairs[{i}] が表でない")
            continue
        name, role = p.get("name"), p.get("role")
        where = f"{gid}・{name if _str(name) else f'pairs[{i}]'}"
        if not _str(name):
            errs.append(f"{where}：name が無い")
        elif name in names:
            errs.append(f"{where}：name が重なる")
        else:
            names.add(name)
        for side in ("canvas", "app"):
            if not _str(p.get(side)):
                errs.append(f"{where}：{side} のセレクタが無い")
        props = p.get("props")
        if not isinstance(props, list) or not all(_str(x) for x in props):
            errs.append(f"{where}：props（比べる値）が字の一覧でない")
            props = []
        if role not in ROLES:
            errs.append(f"{where}：知らない役 {role!r}（{'・'.join(ROLES)}）")
            continue
        if not _is_head_pad(p, heads):
            roles.add(role)  # 帯の余白の組は本文の箱の代わりにならない
        optional = _optional(kind, p, pads)
        for need in ROLES[role]:
            if need not in props and need not in optional:
                errs.append(f"{where}：役 {role} に要る値 {need} が無い")
    for need in KINDS.get(kind, {}).get("roles", []):
        if need not in roles:
            errs.append(f"{gid}：種類 {kind} に要る役 {need} が無い")
    return errs


def check_group(root: pathlib.Path, g: Any, states: str) -> list[str]:
    if not isinstance(g, dict):
        return ["groups の中に表でない物がある"]
    gid = g.get("id") if _str(g.get("id")) else "（id の無い組）"
    errs: list[str] = []
    if not _str(g.get("id")):
        errs.append(f"{gid}：id が無い")
    kind = g.get("kind")
    if kind not in KINDS:
        errs.append(f"{gid}：知らない種類 {kind!r}（{'・'.join(KINDS)}）")
    canvas = g.get("canvas")
    if not _str(canvas) or not (root / "04_design" / "canvas" / f"{canvas}.dc.html").is_file():
        errs.append(f"{gid}：絵 04_design/canvas/{canvas}.dc.html が無い")
    app = g.get("app")
    if not _str(app) or not str(app).startswith("/"):
        errs.append(f"{gid}：app（画面の道）が / で始まらない")
    if not _str(g.get("state")):
        errs.append(f"{gid}：state（画面を整える道具の鍵）が無い")
    widths = g.get("widths")
    if not isinstance(widths, list) or not all(isinstance(w, int) and not isinstance(w, bool) for w in widths):
        errs.append(f"{gid}：widths が数の一覧でない")
        widths = []
    for w in KINDS.get(kind, {}).get("widths", []):
        if w not in widths:
            errs.append(f"{gid}：種類 {kind} に要る幅 {w} が無い")
    owner = g.get("owner")
    if not _str(owner) or not (root / "11_tickets" / f"{owner}.md").is_file():
        errs.append(f"{gid}：持ち主 11_tickets/{owner}.md が無い")
    if not isinstance(g.get("enrolled"), bool):
        errs.append(f"{gid}：enrolled が真偽でない")
    elif g["enrolled"] and _str(g.get("state")) and f'"{g["state"]}":' not in states:
        errs.append(f"{gid}：入れた組の鍵 \"{g['state']}\" が {STATES} に無い")
    if kind in KINDS:
        errs += check_pairs(gid, kind, g.get("pairs"))
    return errs


def load_groups(text: str, where: str) -> tuple[list[dict], list[str]]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return [], [f"{where} が JSON として読めない：{e}"]
    groups = data.get("groups") if isinstance(data, dict) else None
    if not isinstance(groups, list):
        return [], [f"{where} に groups の一覧が無い"]
    return groups, []


def check_shape(root: pathlib.Path, groups: list[Any], required: list[str]) -> list[str]:
    states_path = root / STATES
    states = states_path.read_text(encoding="utf-8") if states_path.is_file() else ""
    errs: list[str] = []
    seen: set[str] = set()
    for g in groups:
        errs += check_group(root, g, states)
        gid = g.get("id") if isinstance(g, dict) else None
        if _str(gid):
            if gid in seen:
                errs.append(f"{gid}：id が重なる")
            seen.add(gid)
    for gid in required:
        if gid not in seen:
            errs.append(f"段 1 の組 {gid} が {CONFIG} に無い")
    return errs


def _git(root: pathlib.Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)


def base_groups(root: pathlib.Path, ref: str) -> tuple[list[dict] | None, list[str]]:
    """分かれ目の版の組。版が読めなければ赤。版に設定がまだ無ければ空（前の組が無い）"""
    if _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return None, [f"分かれ目の版 {ref} が読めない"]
    if _git(root, "cat-file", "-e", f"{ref}:{CONFIG}").returncode != 0:
        return [], []
    r = _git(root, "show", f"{ref}:{CONFIG}")
    if r.returncode != 0:
        return None, [f"{ref}:{CONFIG} が読めない：{r.stderr.strip()}"]
    return load_groups(r.stdout, f"{ref}:{CONFIG}")


STAGES = {"未着手", "作業中", "確認中", "完了", "保留"}
DONE_STAGES = {"確認中", "完了"}


def _head(md: pathlib.Path, key: str) -> str | None:
    """チケットの頭（--- の間）の 1 つの欄。行が無ければ None"""
    lines = md.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            return None
        if line.startswith(f"{key}:"):
            return line.split(":", 1)[1].strip()
    return None


def _stage(md: pathlib.Path) -> str | None:
    return _head(md, "stage")


def ticket_tree(root: pathlib.Path) -> tuple[dict[str, list[str]], dict[str, str | None]]:
    """全部のチケットの子（頭の parent）と stage"""
    kids: dict[str, list[str]] = {}
    stages: dict[str, str | None] = {}
    for md in sorted((root / "11_tickets").glob("K-*.md")):
        stages[md.stem] = _stage(md)
        parent = _head(md, "parent")
        if parent:
            kids.setdefault(parent, []).append(md.stem)
    return kids, stages


def history_subjects(root: pathlib.Path, ref: str) -> tuple[list[str] | None, list[str]]:
    """<版> の履歴の件名。版が読めなければ赤"""
    if _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return None, [f"分かれ目の版 {ref} が読めない（取り込み済みの持ち主を数えられない）"]
    r = _git(root, "log", "--format=%s", ref)
    if r.returncode != 0:
        return None, [f"{ref} の履歴が読めない：{r.stderr.strip()}"]
    return r.stdout.splitlines(), []


def merged_reason(tid: str, kids: dict[str, list[str]], stages: dict[str, str | None], subjects: list[str],
                  ticket: str, seen: frozenset[str] = frozenset()) -> str:
    """取り込み済みなら訳、まだなら空。子を持つ親は子だけで決め（親自身の履歴・stage は見ない）、子にも同じ決め方をたどって当てる"""
    if tid in seen:
        return ""   # parent の輪（形の誤り）は取り込み前として扱う
    children = kids.get(tid) or []
    if children:
        done = all(merged_reason(k, kids, stages, subjects, ticket, seen | {tid}) for k in children)
        return f"子 {'・'.join(children)} が全部取り込み済み" if done else ""
    if tid == ticket:
        return "今のチケット"
    if any(sub.startswith(f"{tid} ") for sub in subjects):
        return "版の履歴に取り込みのコミットが在る"
    if stages.get(tid) in DONE_STAGES:
        return f"stage が {stages[tid]}"
    return ""


def owners_done(root: pathlib.Path, ref: str, ticket: str = "") -> tuple[list[str], list[str]]:
    """入っていない組の見張り。(知らせる行, 赤) を返す"""
    path = root / CONFIG
    if not path.is_file():
        return [], [f"{CONFIG} が無い"]
    groups, errs = load_groups(path.read_text(encoding="utf-8"), CONFIG)
    if errs:
        return [], errs
    waiting = [g for g in groups if isinstance(g, dict) and g.get("enrolled") is not True]
    subjects, errs = history_subjects(root, ref)
    kids, stages = ticket_tree(root)
    owners = sorted({str(g.get("owner")) for g in waiting})
    for o in owners:
        if o not in stages:
            errs.append(f"持ち主 {o} のチケット（11_tickets/{o}.md）が無い")
        elif stages[o] not in STAGES:
            errs.append(f"持ち主 {o} の stage が読めない（{stages[o] or '行が無い'}）")
    if subjects is not None:
        for g in waiting:
            o = str(g.get("owner"))
            why = merged_reason(o, kids, stages, subjects, ticket) if o in stages else ""
            if why:
                errs.append(f"組 {g.get('id')} の持ち主 {o} は取り込み済み（{why}）なのに突き合わせに入っていない（enrolled: false）")
    return [f"入っていない組 {len(waiting)} / {len(groups)}"], errs


def _measures(g: dict) -> set[tuple[str, str, int]]:
    out: set[tuple[str, str, int]] = set()
    for p in g.get("pairs") or []:
        if isinstance(p, dict):
            for prop in p.get("props") or []:
                for w in g.get("widths") or []:
                    out.add((str(p.get("name")), str(prop), w))
    return out


def check_ratchet(base: list[dict], cur: list[Any]) -> list[str]:
    """分かれ目で enrolled だった組は、消せない・戻せない・比べるもの（値の name×値×幅）を減らせない・セレクタを替えられない"""
    now = {g.get("id"): g for g in cur if isinstance(g, dict)}
    errs: list[str] = []
    for b in base:
        if not isinstance(b, dict) or b.get("enrolled") is not True:
            continue
        gid = b.get("id")
        g = now.get(gid)
        if g is None:
            errs.append(f"{gid}：分かれ目で入っていた組が消えた")
            continue
        if g.get("enrolled") is not True:
            errs.append(f"{gid}：分かれ目で入っていた組を enrolled: false に戻した")
        for key in ("canvas", "app", "state"):
            if g.get(key) != b.get(key):
                errs.append(f"{gid}：分かれ目で入っていた組の {key} を {b.get(key)!r} から {g.get(key)!r} に替えた")
        lost = _measures(b) - _measures(g)
        for name, prop, w in sorted(lost):
            errs.append(f"{gid}・{name}：分かれ目で比べていた {prop}（幅 {w}）を外した")
        cur_pairs = {p.get("name"): p for p in g.get("pairs") or [] if isinstance(p, dict)}
        for p in b.get("pairs") or []:
            if not isinstance(p, dict) or p.get("name") not in cur_pairs:
                continue
            for side in ("canvas", "app"):
                if cur_pairs[p["name"]].get(side) != p.get(side):
                    errs.append(f"{gid}・{p['name']}：分かれ目で入っていた {side} のセレクタ {p.get(side)!r} を替えた")
    return errs


def run(root: pathlib.Path, required: list[str], base_ref: str | None, no_base: bool) -> list[str]:
    path = root / CONFIG
    if not path.is_file():
        return [f"{CONFIG} が無い"]
    groups, errs = load_groups(path.read_text(encoding="utf-8"), CONFIG)
    if errs:
        return errs
    errs = check_shape(root, groups, required)
    if base_ref:
        base, berrs = base_groups(root, base_ref)
        errs += berrs
        if base is not None:
            errs += check_ratchet(base, groups)
    elif not no_base:
        errs.append("比べ方の指定が無い（--base-ref <版> か --no-base）")
    return errs


def selftest() -> int:
    good = {"name": "見出し", "role": "h1", "canvas": "h1", "app": "h1", "props": list(ROLES["h1"])}
    assert check_pairs("g", "doc", [good]) == ["g：種類 doc に要る役 card が無い"], check_pairs("g", "doc", [good])
    weak = dict(good, props=["font-size"])
    assert any("x" in e for e in check_pairs("g", "doc", [weak]))
    # K-232：doc の見出しだけ y を外せる。doc でも x は要る・doc 以外の見出しは y が要る
    card = {"name": "箱", "role": "card", "canvas": "c", "app": "a", "props": list(ROLES["card"])}
    no_y = dict(good, props=[x for x in ROLES["h1"] if x != "y"])
    assert check_pairs("g", "doc", [card, no_y]) == [], check_pairs("g", "doc", [card, no_y])
    assert any("値 y" in e for e in check_pairs("g", "auth-msg", [card, no_y]))
    assert any("値 x" in e for e in check_pairs("g", "doc", [card, dict(good, props=[x for x in ROLES["h1"] if x != "x"])]))
    # K-231：帯の余白を中の div で持つ絵だけ、head の padding を外せる（帯の余白の組のキャンバスと画面が合うときだけ）
    head = {"name": "帯", "role": "head", "canvas": "main header", "app": ".h", "props": list(ROLES["head"])}
    head_np = dict(head, props=[x for x in ROLES["head"] if x not in HEAD_PAD])
    pad = {"name": "帯の余白", "role": "body", "canvas": "main header > div", "app": ".h", "props": list(ROLES["body"])}
    body = {"name": "本文", "role": "body", "canvas": "b", "app": "b", "props": list(ROLES["body"])}
    assert check_pairs("g", "page", [good, head_np, pad, body]) == [], check_pairs("g", "page", [good, head_np, pad, body])
    assert any("padding-top" in e for e in check_pairs("g", "page", [good, head_np, body]))  # 帯の余白の組が無い
    assert any("padding-top" in e for e in check_pairs("g", "page", [good, head_np, dict(pad, app=".x"), body]))  # 画面が違う
    assert any("padding-top" in e for e in check_pairs("g", "page", [good, head_np, dict(pad, canvas="main div"), body]))  # キャンバスが違う
    assert any("役 body が無い" in e for e in check_pairs("g", "page", [good, head_np, pad]))  # 帯の余白の組は本文の箱の代わりにならない
    assert check_pairs("g", "page", [good, head, body]) == []  # 今までの形はそのまま
    base = [{"id": "g", "enrolled": True, "canvas": "C", "app": "/", "widths": [1440], "pairs": [good]}]
    assert check_ratchet(base, base) == []
    assert check_ratchet(base, [dict(base[0], enrolled=False)])
    assert check_ratchet(base, [dict(base[0], widths=[])])
    assert check_ratchet(base, [dict(base[0], pairs=[dict(good, app="body")])])
    assert check_ratchet(base, [])
    assert check_ratchet([dict(base[0], state="s1")], [dict(base[0], state="s2")])
    assert sorted(set(REQUIRED)) == sorted(REQUIRED) and len(REQUIRED) == 21
    print("fidelity_config：自己試験 OK")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--required", default=",".join(REQUIRED), help="段 1 の組の id（カンマ区切り）")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--base-ref", help="本線との分かれ目の版（入れた組を弱めていないかを比べる）")
    g.add_argument("--no-base", action="store_true", help="分かれ目と比べない（形だけを見る）")
    ap.add_argument("--print-required", action="store_true")
    ap.add_argument("--print-rules", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--owners-done", action="store_true", help="入っていない組の見張り（--base-ref が要る）")
    ap.add_argument("--ticket", default="", help="今のチケット（見張りで取り込み済みとして数える）")
    a = ap.parse_args(argv)
    if a.owners_done:
        if not a.base_ref:
            ap.error("--owners-done には --base-ref <版> が要る")
        info, errs = owners_done(pathlib.Path(a.root).resolve(), a.base_ref, a.ticket.strip())
        for line in info:
            print(line)
        for e in errs:
            print(f"赤 {e}")
        if errs:
            print(f"fidelity_config --owners-done：赤 {len(errs)} 件")
            return 1
        print("fidelity_config --owners-done：OK")
        return 0
    if a.print_required:
        print(" ".join(REQUIRED))
        return 0
    if a.print_rules:
        print(json.dumps({"roles": ROLES, "kinds": KINDS}, ensure_ascii=False))
        return 0
    if a.selftest:
        return selftest()
    required = [x.strip() for x in a.required.split(",") if x.strip()]
    errs = run(pathlib.Path(a.root).resolve(), required, a.base_ref, a.no_base)
    for e in errs:
        print(f"赤 {e}")
    if errs:
        print(f"fidelity_config：赤 {len(errs)} 件")
        return 1
    print(f"fidelity_config：OK（{CONFIG}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
