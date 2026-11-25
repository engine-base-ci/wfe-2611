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
外した対の記録（設定の頭の "removed"・K-377）：入れた組から比べる物を外せる、ただ 1 つの道。黙って減らす道ではない
  "removed": [{"group": 組の id, "pair": 対の name, "ticket": 画面を消したチケット, "decision": 決定の番号, "why": 訳, "gone": 消した画面のファイル}]
  ・通すのは「その組の、その対を、対ごと外す」ことだけ。対を残して値や幅を減らす・セレクタや絵や state を替える・組を消す・enrolled を戻す・
    記録に無い対を外す、は記録が在っても赤
  ・記録の形：removed は並び・要素は上の 6 つの欄だけ（欠ける・知らない欄は赤）・値は空でない文字・why は空白を除いて 10 字以上・
    decision は D-<数> か D-<数>.<数>・同じ（group, pair）は 1 つだけ
  ・この版で新しく足した記録の確かめ（--base-ref の回）：gone は根からの道（.. や絶対の道は赤）で、画面のファイル（apps/web/app/ の下の page.tsx）で、
    --base-ref の版にファイルとして在り、今の木に無い／11_tickets/<ticket>.md が在り、頭の欄 decisions: に decision が、changes: に gone が
    ちょうど同じ字で在る／group は --base-ref の版の設定に在る組で、pair はその組に在った対／pair は今の組に残っていない（書いただけは赤）
  ・記録は消せない・書き替えられない：--base-ref の版に在った記録は、今の版にも 1 字も変えずに在る（無ければ赤）。前に入った記録は残っていること
    だけを見て、もう何も通さない（赤から外す力を持つのは、この版で新しく足して確かめの通った記録だけ）
  ・--no-base の回は記録の形だけを見る（弱めない検査を流さない回なので、記録が何かを通すことも無い）
組ごと外した記録（設定の頭の "removed_groups"・K-1300）：入れた組を、組ごと外せる、ただ 1 つの道（正の絵がキャンバスから別の物に替わったときなど）
  "removed_groups": [{"group": 組の id, "ticket": 外すチケット, "decision": 決定の番号, "why": 訳}]
  ・通すのは「記録に書いた組を、組ごと消す」ことだけ。ほかの組を消す・弱める、記録の組を残したまま値や幅を減らす、は記録が在っても赤
  ・記録の形は removed と同じ決まり（並び・上の 4 つの欄だけ・空でない文字・制御の字なし・why 10 字以上・decision の形）・同じ組は 1 つだけ
  ・この版で新しく足した記録の確かめ（--base-ref の回）：11_tickets/<ticket>.md が在り、頭の欄 decisions: に decision が、changes: に
    04_design/fidelity.json がちょうど同じ字で在る／ticket は今のチケット（md が --base-ref の版に無いか、その版から字が変わっていて、
    stage が確認中・完了でない。前に終わったチケットの名を借りて外せない）／group は --base-ref の版の設定に在る組で、今の設定に無い（書いただけは赤）
  ・記録は消せない・書き替えられない（removed と同じ）。赤から外す力を持つのは、この版で新しく足して確かめの通った記録だけ
  ・記録の在る組は、段 1 の組に挙がっていても設定に無くてよい：--base-ref の回は、この版で確かめの通った記録の組と、分かれ目の設定にも
    無かった記録の組だけ（前に入った記録は、足し直した組をもう一度外さない）。--no-base の回は形の正しい記録の組
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
import re
import subprocess
import sys
import unicodedata
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


def check_shape(root: pathlib.Path, groups: list[Any], required: list[str], gone: frozenset[str] = frozenset()) -> list[str]:
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
        if gid not in seen and gid not in gone:   # gone：組ごと外した記録の組（K-1300）
            errs.append(f"段 1 の組 {gid} が {CONFIG} に無い")
    return errs


def _git(root: pathlib.Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)


def _base_text(root: pathlib.Path, ref: str) -> tuple[bool, str | None, list[str]]:
    """分かれ目の版の設定。(版に設定が在るか, 設定の字, 赤) を返す。版や設定が読めなければ字は None で赤。
    版に設定がまだ無ければ (False, None, [])。在る・無いは字の中身で見分けない（中身が空の設定は「在る」）"""
    if _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return False, None, [f"分かれ目の版 {ref} が読めない"]
    if _git(root, "cat-file", "-e", f"{ref}:{CONFIG}").returncode != 0:
        return False, None, []
    r = _git(root, "show", f"{ref}:{CONFIG}")
    if r.returncode != 0:
        return True, None, [f"{ref}:{CONFIG} が読めない：{r.stderr.strip()}"]
    return True, r.stdout, []


def base_groups(root: pathlib.Path, ref: str) -> tuple[list[dict] | None, list[str]]:
    """分かれ目の版の組。版が読めなければ赤。版に設定がまだ無ければ空（前の組が無い）"""
    exists, text, errs = _base_text(root, ref)
    if errs:
        return None, errs
    if not exists or text is None:
        return [], []
    return load_groups(text, f"{ref}:{CONFIG}")


def base_removed(root: pathlib.Path, ref: str, key: str = "removed") -> list[Any]:
    """分かれ目の版の設定に在った記録の並び key（版や設定が読めない・並びが無いなら空。読めない赤は base_groups が出す）"""
    _, text, _ = _base_text(root, ref)
    if text is None:
        return []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    removed = data.get(key) if isinstance(data, dict) else None
    return removed if isinstance(removed, list) else []


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


def _head_list(md: pathlib.Path, key: str) -> list[str]:
    """チケットの頭の、並びの欄（decisions: [a, b] の形）の要素。行が無ければ空"""
    raw = (_head(md, key) or "").strip()
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    return [x for x in (part.strip().strip("'\"") for part in raw.split(",")) if x]


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


REMOVED_KEYS = ("group", "pair", "ticket", "decision", "why", "gone")
REMOVED_GROUP_KEYS = ("group", "ticket", "decision", "why")
# 記録の並びごとの (欄, 重なりの鍵, 名前, 重なりの赤の文)。形の決まりは 1 つ（load_removed）を共に使う
RECORDS: dict[str, tuple[tuple[str, ...], tuple[str, ...], str, str]] = {
    "removed": (REMOVED_KEYS, ("group", "pair"), "外した対の記録", "同じ組と対の記録が 2 つ在る（1 つの対に書ける記録は 1 つ）"),
    "removed_groups": (REMOVED_GROUP_KEYS, ("group",), "組ごと外した記録", "同じ組の記録が 2 つ在る（1 つの組に書ける記録は 1 つ）"),
}
WHY_MIN = 10
DECISION_RE = re.compile(r"D-\d+(\.\d+)?")
SCREEN_DIR = "apps/web/app/"
SCREEN_FILE = "/page.tsx"


def _plain(v: Any) -> bool:
    """空でない文字で、制御の字（改行・NUL など）も壊れた字（片割れのサロゲート）も無い。git に渡せて、そのまま出せる字"""
    return _str(v) and not any(unicodedata.category(ch) in ("Cc", "Cs") for ch in v)


def _removed_where(i: int, e: Any, key: str = "removed") -> str:
    ident = RECORDS[key][1]
    if isinstance(e, dict) and all(_plain(e.get(k)) for k in ident):
        return f"{key}[{i}]（{'・'.join(e[k] for k in ident)}）"
    return f"{key}[{i}]"


def load_removed(text: str, key: str = "removed") -> tuple[list[tuple[int, dict]], list[str]]:
    """設定の頭の記録の並び（removed：外した対の記録・removed_groups：組ごと外した記録）。無ければ空。
    (形の正しい記録と並びの中の番号, 形の赤) を返す"""
    keys, ident, label, dup = RECORDS[key]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return [], []   # 読めない赤は load_groups が出す
    if not isinstance(data, dict) or key not in data:
        return [], []
    removed = data[key]
    if not isinstance(removed, list):
        return [], [f"{CONFIG} の {key}（{label}）が並びでない"]
    good: list[tuple[int, dict]] = []
    errs: list[str] = []
    seen: set[tuple[str, ...]] = set()
    for i, e in enumerate(removed):
        where = _removed_where(i, e, key)
        if not isinstance(e, dict):
            errs.append(f"{where}：記録が表でない")
            continue
        bad = [f"{where}：欄 {k} が無い" for k in keys if k not in e]
        bad += [f"{where}：知らない欄 {k!r}（書けるのは {'・'.join(keys)}）" for k in e if k not in keys]
        bad += [f"{where}：欄 {k} が空でない文字でない" for k in keys if k in e and not _str(e[k])]
        bad += [f"{where}：欄 {k} に制御の字（改行・NUL など）か壊れた字が在る" for k in keys if _str(e.get(k)) and not _plain(e[k])]
        if _plain(e.get("why")) and len("".join(e["why"].split())) < WHY_MIN:
            bad.append(f"{where}：why（訳）が {WHY_MIN} 字に足りない")
        if _plain(e.get("decision")) and not DECISION_RE.fullmatch(e["decision"]):
            bad.append(f"{where}：decision {e['decision']!r} が決定の番号の形（D-<数> か D-<数>.<数>）でない")
        if not bad:
            ikey = tuple(e[k] for k in ident)
            if ikey in seen:
                bad.append(f"{where}：{dup}")
            seen.add(ikey)
        if bad:
            errs += bad
        else:
            good.append((i, e))
    return good, errs


def _gone_errors(root: pathlib.Path, ref: str, gone: str) -> list[str]:
    """消した画面のファイル（gone）：根からの道・画面のファイルの形・分かれ目の版にファイルとして在る・今の木に無い"""
    parts = gone.split("/")
    if gone.startswith("/") or "\\" in gone or any(x in ("", ".", "..") for x in parts):
        return [f"gone {gone!r} が根からの道でない（絶対の道・.. は書けない）"]
    if not (gone.startswith(SCREEN_DIR) and gone.endswith(SCREEN_FILE)):
        return [f"gone {gone!r} が画面のファイル（{SCREEN_DIR} の下の page.tsx）でない"]
    errs: list[str] = []
    if _git(root, "cat-file", "-t", f"{ref}:{gone}").stdout.strip() != "blob":
        errs.append(f"gone {gone} が分かれ目の版 {ref} にファイルとして無い（消した画面ではない）")
    if (root / gone).exists() or (root / gone).is_symlink():
        errs.append(f"gone {gone} が今の木にまだ在る（画面を消していない）")
    return errs


def _ticket_errors(root: pathlib.Path, e: dict) -> list[str]:
    """画面を消したチケットの md：在る・頭の欄 decisions: に decision・changes: に gone（どちらも要素がちょうど同じ字）"""
    tid = e["ticket"]
    md = root / "11_tickets" / f"{tid}.md"
    if "/" in tid or "\\" in tid or not md.is_file():
        return [f"チケット 11_tickets/{tid}.md が無い"]
    errs: list[str] = []
    if e["decision"] not in _head_list(md, "decisions"):
        errs.append(f"チケット {tid} の頭の欄 decisions: に {e['decision']} が無い")
    if e["gone"] not in _head_list(md, "changes"):
        errs.append(f"チケット {tid} の頭の欄 changes: に {e['gone']} が無い（その画面を消すチケットではない）")
    return errs


def _pair_names(g: Any) -> set[str]:
    """組の対の name の集まり（組が無い・表でないなら空）"""
    if not isinstance(g, dict):
        return set()
    return {str(p.get("name")) for p in g.get("pairs") or [] if isinstance(p, dict)}


def check_removed(root: pathlib.Path, ref: str, removed: list[tuple[int, dict]], before: list[Any],
                  base: list[dict], cur: list[Any]) -> tuple[frozenset[tuple[str, str]], list[str]]:
    """外した対の記録の確かめ。(赤から外してよい（組, 対）, 赤) を返す。
    前に入った記録（分かれ目の版に同じ記録が在る）は、残っていることだけを見て、何も通さない。
    通す力を持つのは、この版で新しく足して、確かめが全部通った記録だけ"""
    errs: list[str] = []
    records = [e for _, e in removed]
    for i, b in enumerate(before):
        if b not in records:
            errs.append(f"分かれ目の版に在った記録 {_removed_where(i, b)} が、今の版に同じ字で残っていない（記録は消せない・書き替えられない）")
    base_by = {g["id"]: g for g in base if isinstance(g, dict) and _str(g.get("id"))}
    cur_by = {g["id"]: g for g in cur if isinstance(g, dict) and _str(g.get("id"))}
    passed: set[tuple[str, str]] = set()
    for i, e in removed:
        if e in before:
            continue
        where = _removed_where(i, e)
        bad = _gone_errors(root, ref, e["gone"]) + _ticket_errors(root, e)
        if e["group"] not in base_by:
            bad.append(f"組 {e['group']} が分かれ目の版の設定に無い")
        elif e["pair"] not in _pair_names(base_by[e["group"]]):
            bad.append(f"対 {e['pair']} が分かれ目の版の組 {e['group']} に無い（外した対ではない）")
        if e["pair"] in _pair_names(cur_by.get(e["group"])):
            bad.append(f"対 {e['pair']} が今の組 {e['group']} にまだ在る（記録を書いただけで外していない）")
        if bad:
            errs += [f"{where}：{x}" for x in bad]
        else:
            passed.add((e["group"], e["pair"]))
    return frozenset(passed), errs


def _md_is_current(root: pathlib.Path, ref: str, rel: str, md: pathlib.Path) -> bool:
    """チケットの md が分かれ目の版に無いか、その版から字が変わっている（今のチケットが書いた md）"""
    if _git(root, "cat-file", "-e", f"{ref}:{rel}").returncode != 0:
        return True
    r = _git(root, "show", f"{ref}:{rel}")
    return r.returncode != 0 or r.stdout != md.read_text(encoding="utf-8")


def _group_ticket_errors(root: pathlib.Path, ref: str, e: dict) -> list[str]:
    """組を外すチケットの md：在る・decisions: に decision・changes: に設定（ちょうど同じ字）・今のチケット（分かれ目から変わった md・stage が済みでない）"""
    tid = e["ticket"]
    rel = f"11_tickets/{tid}.md"
    md = root / rel
    if "/" in tid or "\\" in tid or not md.is_file():
        return [f"チケット {rel} が無い"]
    errs: list[str] = []
    if e["decision"] not in _head_list(md, "decisions"):
        errs.append(f"チケット {tid} の頭の欄 decisions: に {e['decision']} が無い")
    if CONFIG not in _head_list(md, "changes"):
        errs.append(f"チケット {tid} の頭の欄 changes: に {CONFIG} が無い（設定を直すチケットではない）")
    if not _md_is_current(root, ref, rel, md):
        errs.append(f"チケット {tid} の md が分かれ目の版 {ref} から変わっていない（今のチケットではない）")
    stage = _stage(md)
    if stage in DONE_STAGES:
        errs.append(f"チケット {tid} の stage が {stage}（済んだチケットの名では外せない）")
    return errs


def check_removed_groups(root: pathlib.Path, ref: str, records: list[tuple[int, dict]], before: list[Any],
                         base: list[dict], cur: list[Any]) -> tuple[frozenset[str], list[str]]:
    """組ごと外した記録の確かめ（K-1300）。(赤から外してよい組の id, 赤) を返す。
    前に入った記録は、残っていることだけを見て何も通さない。通す力を持つのは、この版で新しく足して確かめが全部通った記録だけ"""
    errs: list[str] = []
    entries = [e for _, e in records]
    for i, b in enumerate(before):
        if b not in entries:
            errs.append(f"分かれ目の版に在った記録 {_removed_where(i, b, 'removed_groups')} が、今の版に同じ字で残っていない（記録は消せない・書き替えられない）")
    base_ids = {g["id"] for g in base if isinstance(g, dict) and _str(g.get("id"))}
    cur_ids = {g["id"] for g in cur if isinstance(g, dict) and _str(g.get("id"))}
    passed: set[str] = set()
    for i, e in records:
        if e in before:
            continue
        bad = _group_ticket_errors(root, ref, e)
        if e["group"] not in base_ids:
            bad.append(f"組 {e['group']} が分かれ目の版の設定に無い")
        if e["group"] in cur_ids:
            bad.append(f"組 {e['group']} が今の設定にまだ在る（記録を書いただけで外していない）")
        if bad:
            where = _removed_where(i, e, "removed_groups")
            errs += [f"{where}：{x}" for x in bad]
        else:
            passed.add(e["group"])
    return frozenset(passed), errs


def check_ratchet(base: list[dict], cur: list[Any], waived: frozenset[tuple[str, str]] = frozenset(),
                  gone: frozenset[str] = frozenset()) -> list[str]:
    """分かれ目で enrolled だった組は、消せない・戻せない・比べるもの（値の name×値×幅）を減らせない・セレクタを替えられない。
    waived（確かめの通った、外した対の記録の（組, 対））の対を対ごと外した分だけは赤にしない。
    gone（確かめの通った、組ごと外した記録の組）を組ごと消したときだけは赤にしない（組が残っていれば今までどおり見る）"""
    now = {g.get("id"): g for g in cur if isinstance(g, dict)}
    errs: list[str] = []
    for b in base:
        if not isinstance(b, dict) or b.get("enrolled") is not True:
            continue
        gid = b.get("id")
        g = now.get(gid)
        if g is None:
            if gid not in gone:   # 記録つきで組ごと外した（K-1300）
                errs.append(f"{gid}：分かれ目で入っていた組が消えた")
            continue
        if g.get("enrolled") is not True:
            errs.append(f"{gid}：分かれ目で入っていた組を enrolled: false に戻した")
        for key in ("canvas", "app", "state"):
            if g.get(key) != b.get(key):
                errs.append(f"{gid}：分かれ目で入っていた組の {key} を {b.get(key)!r} から {g.get(key)!r} に替えた")
        lost = _measures(b) - _measures(g)
        kept = _pair_names(g)
        for name, prop, w in sorted(lost):
            if (gid, name) in waived and name not in kept:
                continue   # 記録つきで対ごと外した（K-377）
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
    text = path.read_text(encoding="utf-8")
    groups, errs = load_groups(text, CONFIG)
    if errs:
        return errs
    removed, rerrs = load_removed(text)
    rgroups, gerrs = load_removed(text, "removed_groups")
    errs: list[str] = []
    gone: frozenset[str] = frozenset()
    later: list[str] = []
    if base_ref:
        base, berrs = base_groups(root, base_ref)
        later += berrs
        if base is not None:
            waived, werrs = check_removed(root, base_ref, removed, base_removed(root, base_ref), base, groups)
            before_g = base_removed(root, base_ref, "removed_groups")
            gone, gwerrs = check_removed_groups(root, base_ref, rgroups, before_g, base, groups)
            base_ids = {g.get("id") for g in base if isinstance(g, dict)}
            # 前に入った記録の組は、分かれ目の設定にも無かった（外れたまま）ときだけ段 1 の「無い」から外す
            kept_off = frozenset(e["group"] for _, e in rgroups if e in before_g and e["group"] not in base_ids)
            later += werrs + gwerrs + check_ratchet(base, groups, waived, gone)
            gone = gone | kept_off
    elif no_base:
        gone = frozenset(e["group"] for _, e in rgroups)   # 形だけを見る回：形の正しい記録の組
    else:
        later.append("比べ方の指定が無い（--base-ref <版> か --no-base）")
    errs = check_shape(root, groups, required, gone) + rerrs + gerrs + later
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
    # K-1300：記録の確かめの通った組だけ、組ごと消しても赤にしない（組が残れば今までどおり）・段 1 の組の「無い」も外れる
    assert check_ratchet(base, [], gone=frozenset({"g"})) == []
    assert check_ratchet(base, [dict(base[0], widths=[])], gone=frozenset({"g"}))
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
