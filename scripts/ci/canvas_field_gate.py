#!/usr/bin/env python3
"""画面を作る・変えるチケットに「正のモック（突き合わせの組の id）」の欄 canvas が在り、組の持ち主と両向きで合うか（K-215・D-143.5）。

  python3 scripts/ci/canvas_field_gate.py --ledger-base-ref <本線との分かれ目>   台帳は分かれ目の台帳より増やせない
  python3 scripts/ci/canvas_field_gate.py --no-base                              分かれ目と比べない（手元で流すとき。明示しないと赤）
  そのほか：--root <根>（既定はこの台本の置き場の 2 つ上）

当てるチケット（11_tickets/K-*.md の直下。_old は見ない）：stage が「確認中」「完了」（取り込み済み）でなく、子を持たず、次のどれかに当たるもの
  ・頭の screens が空でない ・頭の area が「画面」 ・頭の changes に apps/web/(app|features|components/k|styles)/ の道がある
当てたチケットの頭：
  ・canvas: [<組の id>, …]。組は 04_design/fidelity.json に在り、組の owner がこのチケット（状態は組が持つ）
  ・全部の画面に効くチケットは canvas: [全部の組]（ほかの id と混ぜない）
  ・見た目を変えないチケットは canvas: [] と canvas_none: <訳>（changes に画面のコードがあれば使えない・組と混ぜない）
逆向き：組の owner は 11_tickets に在り、取り込み済みでなければ canvas を持ち、そこに組の id が在る（取り込み済みの持ち主は見ない）
台帳 scripts/ci/canvas_field_ledger.json（{"_doc", "entries": [{ticket, reason}]}）：今ある canvas の無いチケットを載せて通す。減らすだけ。
  赤：canvas を書いた・ファイルが無いのに残る行（台帳から消す）／分かれ目の台帳に無い行／入れた時点の行の数を超えた／同じ行が 2 つ・理由が空。
  取り込み済みで当たらなくなった行は「台帳から消してよい」と出すだけ（取り込みの台本が stage を書いた回を赤にしない）。
  分かれ目に台帳のファイルが無い回（台帳を入れる回）は知らせて比べない（行の数の上限は効く）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_ROOT = HERE.parent.parent
TICKETS_REL = "11_tickets"
FIDELITY_REL = "04_design/fidelity.json"
LEDGER_REL = "scripts/ci/canvas_field_ledger.json"
LEDGER_CAP = 27                       # 台帳を入れた時点の行の数（K-215）。減らすだけなので超えたら赤
ALL_GROUPS = "全部の組"
MERGED = {"確認中", "完了"}
SCREEN_CODE = re.compile(r"^apps/web/(app|features|components/k|styles)/")
HEAD = re.compile(r"^---\n(.*?)\n---\n", re.S)
TICKET_FILE = re.compile(r"^K-\d+\.md$")


class Unreadable(Exception):
    """読む物が無い・読めない・形が違う（赤にして名前を出す）"""


# ---------------------------------------------------------------- 読む
def parse_head(text: str) -> dict:
    """チケットの頭（--- で囲む）。[a, b] は一覧にする（scripts/tickets/build_index.py の parse と同じ読み方）"""
    m = HEAD.match(text)
    if not m:
        raise ValueError("頭（--- で囲む）が無い")
    head: dict = {}
    for line in m.group(1).split("\n"):
        if not line.strip() or line.startswith("#"):
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        head[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()] if v.startswith("[") and v.endswith("]") else v
    return head


def as_list(v) -> list[str]:
    if isinstance(v, list):
        return v
    return [v] if v else []


def load_tickets(root: Path) -> dict[str, dict]:
    d = root / TICKETS_REL
    if not d.is_dir():
        raise Unreadable(f"{TICKETS_REL} が無い（{d}）")
    out: dict[str, dict] = {}
    for p in sorted(d.iterdir()):
        if not (p.is_file() and TICKET_FILE.match(p.name)):
            continue
        try:
            out[p.stem] = parse_head(p.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as e:
            raise Unreadable(f"{TICKETS_REL}/{p.name} が読めない（{e}）") from e
    if not out:
        raise Unreadable(f"{TICKETS_REL} に K-*.md が 1 枚も無い（{d}）")
    return out


def load_json(path: Path, rel: str, key: str) -> list:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        raise Unreadable(f"{rel} が無い（{path}）") from e
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
        raise Unreadable(f"{rel} が読めない（{e}）") from e
    if not isinstance(data, dict) or not isinstance(data.get(key), list):
        raise Unreadable(f"{rel} の形が違う（\"{key}\" が並びでない）")
    return data[key]


def load_groups(root: Path) -> dict[str, str]:
    """組の id → 持ち主"""
    groups: dict[str, str] = {}
    for g in load_json(root / FIDELITY_REL, FIDELITY_REL, "groups"):
        if not (isinstance(g, dict) and isinstance(g.get("id"), str) and isinstance(g.get("owner"), str)):
            raise Unreadable(f"{FIDELITY_REL} の形が違う（id と owner の字を持たない組がある：{g!r:.80}）")
        groups[g["id"]] = g["owner"]
    return groups


def load_ledger(path: Path, rel: str) -> list[dict]:
    entries = load_json(path, rel, "entries")
    for e in entries:
        if not (isinstance(e, dict) and isinstance(e.get("ticket"), str) and isinstance(e.get("reason"), str)):
            raise Unreadable(f"{rel} の形が違う（ticket と reason の字を持たない行がある：{e!r:.80}）")
    return entries


# ---------------------------------------------------------------- 判定
def parents_of(tickets: dict[str, dict]) -> set[str]:
    return {h["parent"] for h in tickets.values() if isinstance(h.get("parent"), str) and h.get("parent")}


def is_merged(head: dict) -> bool:
    return head.get("stage") in MERGED


def touches_screen_code(head: dict) -> bool:
    return any(SCREEN_CODE.match(c) for c in as_list(head.get("changes")))


def applies(tid: str, head: dict, parents: set[str]) -> bool:
    if is_merged(head) or tid in parents:
        return False
    return bool(as_list(head.get("screens"))) or head.get("area") == "画面" or touches_screen_code(head)


def canvas_problems(tid: str, head: dict, groups: dict[str, str]) -> list[str]:
    """canvas を持つチケットの中身（無い組・別の持ち主・全部の組や canvas_none との混ぜ方）"""
    cv = head["canvas"]
    if not isinstance(cv, list):
        return [f"{tid}：canvas は [<組の id>, …] の形で書く（今は {cv!r}）"]
    bad: list[str] = []
    has_none = "canvas_none" in head
    if not cv:
        reason = head.get("canvas_none")
        if not (isinstance(reason, str) and reason.strip()):
            bad.append(f"{tid}：canvas が空。正の組の id を書く（見た目を変えないチケットなら canvas_none: <訳> を書く）")
        elif touches_screen_code(head):
            bad.append(f"{tid}：canvas_none なのに changes に画面のコード（apps/web/app|features|components/k|styles）がある。正の組の id を書く")
        return bad
    if has_none:
        bad.append(f"{tid}：組を書いた canvas に canvas_none を混ぜている（どちらか 1 つ）")
    if ALL_GROUPS in cv and len(cv) > 1:
        bad.append(f"{tid}：canvas の {ALL_GROUPS} をほかの id と混ぜている（{', '.join(cv)}）")
    for gid in cv:
        if gid == ALL_GROUPS:
            continue
        if gid not in groups:
            bad.append(f"{tid}：canvas の組 {gid} が {FIDELITY_REL} に無い")
        elif groups[gid] != tid:
            bad.append(f"{tid}：canvas の組 {gid} の持ち主は {groups[gid]}（このチケットではない）")
    return bad


def owner_problems(tickets: dict[str, dict], groups: dict[str, str]) -> list[str]:
    """逆向き：組の持ち主が在り、取り込み済みでなければ canvas に組の id を書いている"""
    bad: list[str] = []
    for gid, owner in groups.items():
        head = tickets.get(owner)
        if head is None:
            bad.append(f"組 {gid} の持ち主 {owner} が {TICKETS_REL} に無い")
        elif is_merged(head):
            continue
        elif "canvas" not in head:
            bad.append(f"組 {gid} の持ち主 {owner} に canvas が無い（台帳に載っていれば台帳から外して canvas: [{gid}, …] を書く）")
        elif gid not in as_list(head["canvas"]):
            bad.append(f"組 {gid} の持ち主 {owner} の canvas に {gid} が無い")
    return bad


def ticket_problems(tickets: dict[str, dict], groups: dict[str, str], ledgered: set[str]) -> list[str]:
    parents = parents_of(tickets)
    bad: list[str] = []
    for tid, head in tickets.items():
        if is_merged(head):
            continue
        if "canvas" in head:
            bad += canvas_problems(tid, head, groups)
        elif applies(tid, head, parents) and tid not in ledgered:
            bad.append(f"{tid}：画面を作る・変えるチケットなのに canvas（正の組の id）が無い")
    return bad + owner_problems(tickets, groups)


def ledger_problems(entries: list[dict], tickets: dict[str, dict]) -> tuple[list[str], list[str]]:
    parents = parents_of(tickets)
    bad: list[str] = []
    notes: list[str] = []
    seen: set[str] = set()
    if len(entries) > LEDGER_CAP:
        bad.append(f"台帳が {len(entries)} 行。入れた時点の {LEDGER_CAP} 行を超えた（台帳は減らすだけ）")
    for e in entries:
        tid = e["ticket"]
        if tid in seen:
            bad.append(f"台帳の {tid} が 2 行ある")
        seen.add(tid)
        if not e["reason"].strip():
            bad.append(f"台帳の {tid} の理由が空")
        head = tickets.get(tid)
        if head is None:
            bad.append(f"台帳の {tid} のファイルが {TICKETS_REL} に無い：台帳から消す")
        elif "canvas" in head:
            bad.append(f"台帳の {tid} は canvas を書いた：台帳から消す")
        elif not applies(tid, head, parents):
            notes.append(f"台帳の {tid} はもう当たらない（取り込み済み・子を持つ・画面に触らない）：台帳から消してよい")
    return bad, notes


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, env=env)


def base_problems(root: Path, ref: str, entries: list[dict]) -> tuple[list[str], list[str]]:
    if _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return [f"比べる版 {ref} が読めない（分かれ目の台帳と比べられない）"], []
    if _git(root, "cat-file", "-e", f"{ref}:./{LEDGER_REL}").returncode != 0:
        return [], [f"版 {ref} に {LEDGER_REL} が無い：台帳を入れる回（比べない。{LEDGER_CAP} 行の上限は効く）"]
    r = _git(root, "show", f"{ref}:./{LEDGER_REL}")
    try:
        data = json.loads(r.stdout) if r.returncode == 0 else None
        base = {e["ticket"] for e in data["entries"]}
    except (TypeError, KeyError, json.JSONDecodeError) as e:
        return [f"版 {ref} の {LEDGER_REL} が読めない（{r.stderr.strip() or e}）"], []
    return [f"台帳の {t} は分かれ目（{ref}）の台帳に無い（台帳は増やせない）" for t in sorted({e["ticket"] for e in entries} - base)], []


def run(root: Path, base_ref: str | None, no_base: bool) -> int:
    if not no_base and base_ref is None:
        print("canvas_field_gate：--ledger-base-ref <版> か --no-base が要る（黙って比べずに緑にしない）")
        return 1
    try:
        tickets = load_tickets(root)
        groups = load_groups(root)
        entries = load_ledger(root / LEDGER_REL, LEDGER_REL)
    except Unreadable as e:
        print(f"canvas_field_gate：赤 — {e}")
        return 1
    bad, notes = ledger_problems(entries, tickets)
    bad += ticket_problems(tickets, groups, {e["ticket"] for e in entries})
    if not no_base:
        more, more_notes = base_problems(root, base_ref or "", entries)
        bad, notes = bad + more, notes + more_notes
    for n in notes:
        print(f"  知らせ：{n}")
    if bad:
        print(f"canvas_field_gate：赤 {len(bad)} 件（D-143.5・画面のチケットは正の組を書く）")
        for b in bad:
            print(f"  - {b}")
        return 1
    print(f"canvas_field_gate：OK（チケット {len(tickets)} 枚・組 {len(groups)}・台帳 {len(entries)} 行）")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--ledger-base-ref", default=None)
    g.add_argument("--no-base", action="store_true")
    a = ap.parse_args(argv)
    return run(a.root.resolve(), a.ledger_base_ref, a.no_base)


if __name__ == "__main__":
    sys.exit(main())
