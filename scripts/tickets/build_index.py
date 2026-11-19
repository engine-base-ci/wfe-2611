#!/usr/bin/env python3
"""build_index.py — Kaname を作るためのチケット（11_tickets/K-*.md）から、一覧・親子の木・機械用の写しを作り、形を検査する。

チケット 1 枚 = 1 ファイル。上の --- で囲んだ所が属性（Kaname のチケットの属性と同じ）、下が本文の区画（Kaname の種別「タスク」の区画）。
  出力: 11_tickets/README.md（親子の木と数）・11_tickets/tickets.json（機械用）・11_tickets/tickets.csv（Kaname の汎用 CSV の取り込みに渡す形・D-128.85）
  検査（赤なら止める）:
    K1 番号が重ならない・ファイル名と番号が同じ
    K2 親があれば実在し、親子は 3 段まで（D-128.25 系：チケットの親子は 3 段まで）
    K3 区画「目的」「完了の条件」が空でない。子の無いチケットは「実施事項」「テスト仕様と確認の結果」も空でない（まだ切っていないまとまり split: これから は除く）
    K4 決定 ID（decisions）が決定ログにある
    K5 作業の段は決まった値（未着手・作業中・保留・確認中・承認待ち・実行中・完了）
    K6 先に終わっている必要があるもの（depends_on）が実在し、輪になっていない
    K7 担当（assignee）は役（作る・精査・実装・テスター）か人の名前。AI のセッションの名前は書かない（D-128.145）
    K8 影響の範囲（K-107・D-128.169）：affects の値はワークスペースのパッケージの名前（apps/*・packages/* の package.json の name。
       [] は「パッケージに触らない」）、ci_wide の値は db・shared・ci・lockfile のどれか（古いチケットでも書いたなら見る）。
       番号を数で比べ、K-108 から後の子の無いチケット（まだ切っていないまとまり split: これから は除く）は affects が要る。
       チケットの CI（scripts/ci/ci_scope.py）が、書いた範囲と機械で出した範囲を突き合わせる
  属性 tests:（そのチケットが持つ試験のファイル・glob 可）は、どの試験もちょうど 1 つのチケットに属するかを
    scripts/ci/test_owner_gate.py（G53）が見る
使い方: python3 scripts/tickets/build_index.py [--check]
        python3 scripts/tickets/build_index.py --selftest   検査（K8）が作りもののチケットで赤を起こすか
"""
from __future__ import annotations
import csv, glob, io, json, os, re, sys
from collections.abc import Mapping

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "11_tickets")
LOG = os.path.join(ROOT, "01_hearing", "決定ログ_進行中.md")
STAGES = ["未着手", "作業中", "保留", "確認中", "承認待ち", "実行中", "完了"]
SECTIONS = ["目的", "完了の条件", "前提と制約", "実施事項", "テスト仕様と確認の結果", "成果物", "決定ログ", "リスクと懸念", "申し送り"]


def parse(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        s = f.read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", s, flags=re.S)
    if not m:
        raise SystemExit(f"{path}: 上の属性（--- で囲む）が無い")
    attrs: dict = {}
    for line in m.group(1).split("\n"):
        if not line.strip() or line.startswith("#"):
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            attrs[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        else:
            attrs[k.strip()] = v
    body = m.group(2)
    secs: dict = {}
    cur = None
    for line in body.split("\n"):
        h = re.match(r"^## (.+)$", line)
        if h:
            cur = h.group(1).strip()
            secs[cur] = []
        elif cur:
            secs[cur].append(line)
    attrs["sections"] = {k: "\n".join(v).strip() for k, v in secs.items()}
    attrs["file"] = os.path.relpath(path, ROOT)
    return attrs


def load() -> list[dict]:
    return sorted((parse(p) for p in glob.glob(os.path.join(DIR, "K-*.md"))), key=lambda t: int(t["id"].split("-")[1]))


def parent_map(ts: list[dict]) -> dict[str, str | None]:
    """チケットの番号 → 親の番号（親が無ければ None）"""
    return {t["id"]: (t.get("parent") or None) for t in ts}


def prefer_descendants(ids: list[str], parent_of: Mapping[str, str | None]) -> list[str]:
    """同じ口・試験を親と子（孫まで）が持つときは、いちばん下の子を持ち主と数える（K-328）。
    ids のうち、ほかの id の先祖である物を外す。順は保つ。親子でない物（兄弟など）はそのまま残す"""
    ancestors: set[str] = set()
    for i in ids:
        seen: set[str] = set()
        cur = parent_of.get(i)
        while cur and cur not in seen:   # 輪になっていても止まる（輪は K6 ではなく K2 が見る）
            seen.add(cur)
            ancestors.add(cur)
            cur = parent_of.get(cur)
    return [i for i in ids if i not in ancestors]


AI_SESSION = re.compile(r"claude|セッション|session|\bAI\b|gpt|codex|copilot", re.I)
AFFECTS_FROM = 108   # この番号から affects が要る（K-107 までは仕組みの前・scripts/ci/ci_scope.json の affects_required_from と同じ）
CI_WIDE = {"db", "shared", "ci", "lockfile"}


def packages() -> set[str]:
    out = set()
    for pj in glob.glob(os.path.join(ROOT, "apps", "*", "package.json")) + glob.glob(os.path.join(ROOT, "packages", "*", "package.json")):
        with open(pj, encoding="utf-8") as f:
            out.add(json.load(f)["name"])
    return out


def num(tid: str) -> int:
    m = re.fullmatch(r"K-(\d+)", tid or "")
    return int(m.group(1)) if m else -1


def as_list(v) -> list:
    return v if isinstance(v, list) else ([v] if v else [])


def check_k8(ts: list[dict], kids: dict) -> list[str]:
    bad = []
    names = None
    for t in ts:
        if "affects" in t:
            names = packages() if names is None else names
            for n in as_list(t["affects"]):
                if n not in names:
                    bad.append(f"[K8] {t['id']} の affects {n!r} はワークスペースのパッケージの名前でない")
        elif num(t["id"]) >= AFFECTS_FROM and t["id"] not in kids and t.get("split") != "これから":
            bad.append(f"[K8] {t['id']} に影響の範囲（affects）が無い（K-{AFFECTS_FROM} から子の無いチケットに要る。パッケージに触らないなら affects: []）")
        for c in as_list(t.get("ci_wide")):
            if c not in CI_WIDE:
                bad.append(f"[K8] {t['id']} の ci_wide {c!r} は決まった値（db・shared・ci・lockfile）でない")
    return bad


def check(ts: list[dict]) -> list[str]:
    bad = []
    ids = {}
    for t in ts:
        if t["id"] in ids:
            bad.append(f"[K1] {t['id']} が重なっている（{ids[t['id']]} と {t['file']}）")
        ids[t["id"]] = t["file"]
        if os.path.basename(t["file"]) != f"{t['id']}.md":
            bad.append(f"[K1] {t['file']} の番号が {t['id']}")
    by = {t["id"]: t for t in ts}
    kids = {}
    for t in ts:
        p = t.get("parent") or ""
        if p:
            kids.setdefault(p, []).append(t["id"])
            if p not in by:
                bad.append(f"[K2] {t['id']} の親 {p} が無い")
    def depth(t, seen=()):
        p = t.get("parent") or ""
        if not p or p not in by:
            return 1
        if t["id"] in seen:
            return 99
        return 1 + depth(by[p], seen + (t["id"],))
    for t in ts:
        if depth(t) > 3:
            bad.append(f"[K2] {t['id']} は親子が 3 段を超える")
    log = open(LOG, encoding="utf-8").read() if os.path.exists(LOG) else ""
    for t in ts:
        sec = t["sections"]
        for s in ("目的", "完了の条件"):
            if not sec.get(s):
                bad.append(f"[K3] {t['id']} の「{s}」が空")
        if t["id"] not in kids and t.get("split") != "これから":
            for s in ("実施事項", "テスト仕様と確認の結果"):
                if not sec.get(s):
                    bad.append(f"[K3] {t['id']}（子の無いチケット）の「{s}」が空")
        for d in t.get("decisions", []):
            # D-069.8 のように、決定の節（decision: D-069）の「決めたこと」の何行目かで指すものもある
            if f"| {d} |" not in log and f"decision: {d}" not in log and not (re.fullmatch(r"D-\d{3}\.\d+", d) and f"decision: {d.split('.')[0]}\n" in log.replace(" -->", "")):
                bad.append(f"[K4] {t['id']} の決定 {d} が決定ログに無い")
        if t.get("stage") not in STAGES:
            bad.append(f"[K5] {t['id']} の作業の段 {t.get('stage')!r} は決まった値でない")
        for d in t.get("depends_on", []):
            if d not in by:
                bad.append(f"[K6] {t['id']} の先に要るもの {d} が無い")
        if AI_SESSION.search(t.get("assignee") or ""):
            bad.append(f"[K7] {t['id']} の担当 {t.get('assignee')!r} が AI のセッションの名前。役（作る・精査・実装・テスター）か人の名前にする")
    # 輪
    def cyc(a, path):
        for d in by[a].get("depends_on", []):
            if d in path:
                return path + [d]
            if d in by:
                r = cyc(d, path + [d])
                if r:
                    return r
        return None
    for t in ts:
        r = cyc(t["id"], [t["id"]])
        if r:
            bad.append(f"[K6] 先に要るものが輪になっている：{' → '.join(r)}")
            break
    bad += check_k8(ts, kids)
    return bad


def selftest() -> int:
    """K8 の赤を作りもののチケットで起こす（新しいチケットに affects が無い・無いパッケージ・決まった値でない ci_wide）"""
    secs = {"目的": "試し", "完了の条件": "試し", "実施事項": "試し", "テスト仕様と確認の結果": "試し"}
    def t(tid, **kw):
        return {"id": tid, "title": "試し", "stage": "未着手", "parent": "", "assignee": "作る", "decisions": [], "depends_on": [],
                "split": "", "sections": dict(secs), "file": f"11_tickets/{tid}.md", **kw}
    cases = [([t("K-108")], 1), ([t("K-107")], 0), ([t("K-108", affects=[])], 0), ([t("K-1070", affects=["@kaname/nai"])], 1),
             ([t("K-50", ci_wide=["zenbu"])], 1), ([t("K-108"), t("K-109", parent="K-108", affects=[])], 0)]
    ng = 0
    for ts, want in cases:
        got = [m for m in check(ts) if m.startswith("[K8]")]
        ok = len(got) == want
        ng += not ok
        print(f"  {'ok' if ok else 'NG'} K8 {[x['id'] for x in ts]} → 赤 {len(got)}（期待 {want}）" + "".join(f"\n      {m}" for m in got))
    print(f"自己試験 K8：{'緑' if not ng else f'赤 {ng}'}")
    return 1 if ng else 0


def tree(ts: list[dict]) -> str:
    by = {t["id"]: t for t in ts}
    kids: dict = {}
    for t in ts:
        kids.setdefault(t.get("parent") or "", []).append(t["id"])
    out = []
    def walk(i, depth):
        t = by[i]
        n = len(kids.get(i, []))
        mark = "✓" if t.get("stage") == "完了" else ("…" if t.get("split") == "これから" else "・")
        out.append(f"{'  ' * depth}- {mark} [{i}]({os.path.basename(t['file'])}) {t['title']}（{t.get('stage')}" + (f"・子 {n}" if n else "") + ("・まだ切っていない" if t.get("split") == "これから" else "") + "）")
        for k in kids.get(i, []):
            walk(k, depth + 1)
    for r in kids.get("", []):
        walk(r, 0)
    return "\n".join(out)


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    ts = load()
    bad = check(ts)
    leaves = [t for t in ts if t.get("split") != "これから" and not any((x.get("parent") or "") == t["id"] for x in ts)]
    pending = [t for t in ts if t.get("split") == "これから"]
    done = sum(1 for t in leaves if t.get("stage") == "完了")
    if "--check" not in sys.argv:
        md = ["# Kaname を作るためのチケット（11_tickets）", "",
              "Kaname のチケットと同じ形（属性と区画）で、Kaname 自体を作る仕事を切ったもの。親子は 3 段まで（節目 → まとまり → 1 作業）。",
              "1 枚 = 1 ファイル（`K-番号.md`（番号は D-128.139 で振り直した。古い KN- との対応は renumber-map.json））。この一覧・`tickets.json`・`tickets.csv` は `python3 scripts/tickets/build_index.py` が作る（手で直さない）。", "",
              f"チケット {len(ts)} 枚（1 作業 {len(leaves)}・完了 {done}・まだ切っていないまとまり {len(pending)}）", "",
              "印：✓ 完了 ／ ・ これから ／ … まだ 1 作業に切っていないまとまり", "", tree(ts), ""]
        open(os.path.join(DIR, "README.md"), "w", encoding="utf-8").write("\n".join(md))
        json.dump({"tickets": [{k: v for k, v in t.items()} for t in ts]}, open(os.path.join(DIR, "tickets.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["番号", "題名", "種別", "親", "作業の段", "担当", "期限", "分類", "目的", "完了の条件"])
        for t in ts:
            w.writerow([t["id"], t["title"], t.get("kind", "タスク"), t.get("parent", ""), t.get("stage", ""), t.get("assignee", ""), t.get("due", ""),
                        "・".join(x for x in [t.get("milestone", ""), t.get("area", "")] if x), t["sections"].get("目的", ""), t["sections"].get("完了の条件", "")])
        open(os.path.join(DIR, "tickets.csv"), "w", encoding="utf-8").write(buf.getvalue())
    print(f"チケット {len(ts)} 枚（1 作業 {len(leaves)}・完了 {done}・まだ切っていないまとまり {len(pending)}）／ 形の赤 {len(bad)}")
    for b in bad:
        print("  ★ " + b)
    return 2 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
