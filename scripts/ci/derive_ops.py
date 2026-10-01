#!/usr/bin/env python3
"""操作要素の一覧をモックから機械で出す（L1 の分母）。

  python3 scripts/ci/derive_ops.py --screens 07_functional/screens.json --out 07_qa/test-specs/ops [--shell-from <screen id>]

画面ごとに <main> の中のボタン・リンク・入力欄・チェック・タブ・開閉・エラー文言を、状態（statepane）と役割（data-roles）つきで拾う。
共通シェル（<main> の外：サイドバー・AI のパネル・下タブ）は代表 1 画面から 1 回だけ出す（_shell.json）。
出力は build_tasks が「操作 1 つ＝L1 の行 1 つ」に変え、op_gate.py が「その行 ID を持つ実ブラウザのテストが通った」を検査する。
モックの自分の道具（幅の切替・状態のタブ・役割の切替・手順の一覧）は数えない。プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, json, os, re, sys
from html.parser import HTMLParser

KIND_JA = {"button": "ボタン", "link": "リンク", "input": "入力欄", "checkbox": "チェック", "select": "選択", "textarea": "入力欄", "tab": "タブ", "toggle": "開閉", "error": "エラー文言", "radio": "選択肢"}
SKIP_CLASSES = {"mockbar", "states", "purpose", "state-note", "crumb", "wsw", "rolebar", "css-sentinel"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent", "text")

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.children, self.text = tag, dict(attrs), parent, [], ""

    def cls(self):
        return set((self.attrs.get("class") or "").split())

    def ancestors(self):
        n = self.parent
        while n:
            yield n
            n = n.parent

    def inner_text(self):
        out = [self.text]
        for c in self.children:
            if c.tag == "svg" or "badge" in c.cls() or c.attrs.get("aria-hidden") == "true":
                continue
            out.append(c.inner_text())
        return re.sub(r"\s+", " ", "".join(out)).strip()

    def walk(self):
        yield self
        for c in self.children:
            yield from c.walk()


VOID = {"input", "br", "img", "hr", "meta", "link", "i" if False else "wbr"}


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        if self.cur.children and self.cur.children[-1].tag == "#text":
            self.cur.children[-1].text += data
        else:
            t = Node("#text", [], self.cur)
            t.text = data
            self.cur.children.append(t)


def parse(html: str) -> Node:
    t = Tree()
    t.feed(html)
    return t.root


def find(root: Node, pred):
    return [n for n in root.walk() if n.tag != "#text" and pred(n)]


def skipped(n: Node) -> bool:
    for a in [n, *n.ancestors()]:
        if a.cls() & SKIP_CLASSES or a.attrs.get("role") == "tablist" and "states" in a.cls():
            return True
        if a.tag == "button" and ("data-w" in a.attrs or "data-t" in a.attrs or "data-role" in a.attrs):
            return True
    return False


def state_of(n: Node, labels: dict[str, str]) -> str:
    for a in n.ancestors():
        if "statepane" in a.cls():
            code = (a.attrs.get("id") or "").removeprefix("p-")
            return labels.get(code, code) or "通常"
    return "共通"


def roles_of(n: Node) -> list[str]:
    for a in [n, *n.ancestors()]:
        if a.attrs.get("data-roles"):
            return a.attrs["data-roles"].split()
    return []


def ps_of(n: Node) -> list[str]:
    out = []
    for a in [n, *n.ancestors()]:
        for k in ("data-ps", "data-ps-only"):
            if a.attrs.get(k):
                out.append(a.attrs[k])
    return sorted(set(out))


def label_for_input(n: Node) -> str:
    if n.attrs.get("aria-label"):
        return n.attrs["aria-label"]
    if n.attrs.get("type") in ("checkbox", "radio"):
        p = n.parent
        if p is not None and p.tag == "label":
            return p.inner_text()
        for s in (p.children if p else []):
            if s.tag == "span":
                return s.inner_text()
    p = n.parent
    for _ in range(3):
        if p is None:
            break
        labs = [c for c in p.children if c.tag == "label"]
        if labs:
            return labs[0].inner_text()
        p = p.parent
    return n.attrs.get("placeholder") or n.attrs.get("name") or n.attrs.get("type") or "無名"


def screen_of_href(href: str, ids: set[str]) -> str | None:
    m = re.match(r"^(?:.*/)?(?:v\d+-)?([a-z0-9-]+)\.html(?:[#?].*)?$", href or "")
    if m and m.group(1) in ids:
        return m.group(1)
    return None


def collect(scope: Node, labels: dict[str, str], ids: set[str]) -> list[dict]:
    ops: dict[tuple, dict] = {}

    def add(kind, label, n, target=None):
        label = re.sub(r"\s+", " ", label).strip()[:60] or "無名（アイコンだけ。実装では aria-label を付ける）"
        key = (kind, label, target or "")
        st = state_of(n, labels)
        o = ops.setdefault(key, {"key": f"{kind}:{label}" + (f"→{target}" if target else ""), "kind": kind, "label": label, "target": target, "states": [], "roles": [], "ps": []})
        if st not in o["states"]:
            o["states"].append(st)
        for r in roles_of(n):
            if r not in o["roles"]:
                o["roles"].append(r)
        for p in ps_of(n):
            if p not in o["ps"]:
                o["ps"].append(p)

    for n in scope.walk():
        if n.tag == "#text" or skipped(n):
            continue
        if n.tag == "button":
            if n.attrs.get("role") == "tab":
                add("tab", n.inner_text() or n.attrs.get("aria-label") or n.attrs.get("title") or "", n)
            else:
                add("button", n.inner_text() or n.attrs.get("aria-label") or n.attrs.get("title") or "", n)
        elif n.tag == "a" and n.attrs.get("href") is not None:
            add("link", n.inner_text() or n.attrs.get("aria-label") or n.attrs.get("title") or "", n, screen_of_href(n.attrs["href"], ids))
        elif n.tag in ("input", "select", "textarea"):
            t = n.attrs.get("type", "text")
            if t == "hidden":
                continue
            kind = "checkbox" if t == "checkbox" else "radio" if t == "radio" else "select" if n.tag == "select" else "textarea" if n.tag == "textarea" else "input"
            add(kind, label_for_input(n), n)
        elif n.tag == "summary":
            add("toggle", n.inner_text(), n)
        elif "err" in n.cls() and n.tag not in ("input", "select", "textarea") and n.inner_text():
            add("error", n.inner_text(), n)
    return list(ops.values())


def state_labels(main: Node) -> dict[str, str]:
    out = {}
    for b in find(main, lambda x: x.tag == "button" and "data-t" in x.attrs):
        out[b.attrs["data-t"]] = b.inner_text()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--screens", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--shell-from", default="", help="共通シェルの操作を出す代表の画面 ID（既定：needs_login の最初の画面）")
    ap.add_argument("--flow", default="", help="needs_login を引く flow.json（省略可）")
    a = ap.parse_args()
    S = json.load(open(a.screens, encoding="utf-8"))["items"]
    ids = {s["id"] for s in S}
    needs = {}
    if a.flow and os.path.exists(a.flow):
        needs = {x["id"]: x.get("needs_login", True) for x in json.load(open(a.flow, encoding="utf-8"))["screens"]}
    os.makedirs(a.out, exist_ok=True)
    total = 0
    shell_src = a.shell_from or next((s["id"] for s in S if needs.get(s["id"], True) and s.get("mock_path")), "")
    # 画面の上の帯（.shead）：全画面に同じもの（自分の AI・AI の状態）は共通の枠で 1 回だけ、画面ごとに違うもの（その画面の主ボタン）はその画面で数える
    def head_ops(mp):
        if not mp or not os.path.exists(mp):
            return []
        hs = find(parse(open(mp, encoding="utf-8").read()), lambda x: x.tag == "header" and "shead" in x.cls())
        return collect(hs[0], {}, ids) if hs else []
    _heads = [{(o["kind"], o["label"]) for o in head_ops(s.get("mock_path"))} for s in S]
    _heads = [h for h in _heads if h]
    # 共通＝帯を持つ画面の半分以上に出るもの（運営の画面・はじめの設定の枠は帯の中身が少し違うので、全部の積にはしない）
    from collections import Counter
    _freq = Counter(k for h in _heads for k in h)
    head_common = {k for k, n in _freq.items() if n * 2 >= len(_heads)}
    for s in S:
        mp = s.get("mock_path")
        if not mp or not os.path.exists(mp):
            print(f"  - {s['id']}: モックが無い（{mp}）")
            continue
        root = parse(open(mp, encoding="utf-8").read())
        mains = find(root, lambda x: x.tag == "main")
        if not mains:
            print(f"  - {s['id']}: <main> が無い")
            continue
        labels = state_labels(mains[0])
        ops = collect(mains[0], labels, ids)
        _seen = {o["key"] for o in ops}
        ops += [o for o in head_ops(mp) if (o["kind"], o["label"]) not in head_common and o["key"] not in _seen]
        total += len(ops)
        json.dump({"screen": s["id"], "mock": mp, "state_labels": labels, "ops": ops}, open(os.path.join(a.out, f"{s['id']}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if s["id"] == shell_src:
            shell = {}
            for region, sel in (("side", lambda x: x.tag == "aside" and "side" in x.cls()), ("aipanel", lambda x: x.tag == "aside" and "aipanel" in x.cls()), ("tabbar", lambda x: x.tag == "nav" and ("tabbar" in x.cls() or "bottom" in x.cls())),
                                # 画面の上の帯（見出し・AI の状態・自分の AI）は <main> の外の共通の枠（2026-10-01：ヘッダを .shead に出したので画面ごとには数えない）
                                ("head", lambda x: x.tag == "header" and "shead" in x.cls())):
                for reg in find(root, sel)[:1]:   # 代表の役割（最初の aside／nav）だけ。役割ごとの出し分けは「役割の出し分け」の行で見る
                    shell.setdefault(region, [])
                    seen = {o["key"] for o in shell[region]}
                    for o in collect(reg, {}, ids):
                        if region == "head" and (o["kind"], o["label"]) not in head_common:
                            continue   # その画面だけのもの（主ボタン）は画面の側で数える
                        if o["key"] not in seen:
                            shell[region].append(o); seen.add(o["key"])
            json.dump({"screen": "_shell", "from": mp, "regions": shell}, open(os.path.join(a.out, "_shell.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"  共通シェル（{shell_src} から）: " + " / ".join(f"{k} {len(v)}" for k, v in shell.items()))
    print(f"操作要素 {total} 件 → {a.out}（画面 {len(S)}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
