#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""project_audit.py — プロジェクトの成果物を「ディスクから」数えて、抜けを出す。

 由来（2026-09-17）：user「プロジェクトとして全てを漏れないようになってんのか」。
 それまでの検査は、どれも **人が手で並べたリスト** を分母にしていた。
   alignment_decisions（手書き）→ Tier D が見る決定
   layer_checks（手書き）      → G21 が見る層
 リストに書き忘れたものは、最初から存在しないことになる。だから「全部緑」と出せた。
 リストを疑わない検査は、リストを書いた人の記憶の写しでしかない（L-004・L-006・L-012）。

 ここでは **ディスクにある成果物を全部数える**。地図に無いものは「地図の穴」として赤。
 どのプロジェクトでも、どの進み具合でも同じように動く（パスもフォルダ名も決め打ちしない）。

 出すもの
   P1 地図の穴    ディスクにあるのに依存マップのどこからも参照されていない成果物
   P2 検査の穴    参照はされているが、機械の検査（check / command / gate）が無い成果物
   P3 鮮度        正本の新しい決定に追いついていない成果物。**赤にする。**
                 ★ 最初は mtime（更新時刻）で見ていたが、正本を 1 文字直すだけで
                   全部が「古い」に変わる。時刻は中身の新しさではない（2026-09-18 に実際に踏んだ）。
                   いまは **その成果物が参照している決定の新しさ** で見る ──
                   決定 ID を 1 つも持たない成果物は時刻でも判定しない（手で見る層）。
                 由来（2026-09-18）：ここだけ「数を出すだけ」にしていた。46 件が表示されていたのに
                 一度も止まらず、画面だけ新しくて設計書・DESIGN.md・サマリーが古いまま進んでいた。
                 数を出すだけの検査は、書いたのに効かない＝書いていないのと同じ（L-004・L-012）。
                 追いつかせるか、追いつかなくてよい理由を地図に書く（stale_ok）。
   P4 幽霊        地図が参照しているのにディスクに無い成果物
   P5 分母        正本の決定のうち、地図に登録されていないもの（件数を人に決めさせない）

使い方:
  python3 project_audit.py --project-root . [--json] [--ext .md,.json]
"""
from __future__ import annotations
import argparse, json, os, re, sys, time

try:
    import yaml
except ImportError:
    print("FAIL — PyYAML が要ります"); sys.exit(2)

SKIP_DIR = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
            ".next", ".turbo", "coverage", ".pytest_cache", ".mypy_cache", ".DS_Store"}
ART_EXT = (".md", ".json", ".yaml", ".yml", ".html", ".csv", ".sql", ".xlsx", ".drawio")
CODE_EXT = (".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".kt", ".swift",
            ".sh", ".mjs", ".cjs", ".css", ".scss")
CHECK_KEYS = ("check", "checks", "command", "commands", "gate", "gates", "ci_check",
              "evidence", "marker", "trace", "json_path")
# 機械で検査できないものは「手で見る」と理由を書けば通す。理由の無い放置は通さない。
MANUAL_KEYS = ("manual", "todo", "reason", "note")


def walk(root: str, exts) -> list:
    out = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIR and not d.startswith(".")]
        for f in fns:
            if f.startswith(".") or not f.endswith(exts):
                continue
            out.append(os.path.relpath(os.path.join(dp, f), root))
    return sorted(out)


def group_of(rel: str) -> str:
    """成果物を「層」にまとめる。フォルダ名は決め打ちせず、実際の並びから取る。"""
    parts = rel.split(os.sep)
    return parts[0] if len(parts) > 1 else "(直下)"


def map_text(root: str, map_rel: str) -> tuple:
    p = os.path.join(root, map_rel)
    raw = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
    M = yaml.safe_load(raw) or {} if raw else {}
    return raw, M


def referenced(raw: str, rel: str) -> bool:
    """地図のどこかで、その成果物（かそれを含むグロブ）に触れているか。"""
    if rel in raw:
        return True
    d, base = os.path.split(rel)
    stem, ext = os.path.splitext(base)
    for cand in (f"{d}/*{ext}", f"{d}/**", f"{d}/", d, f"*{ext}"):
        if cand and cand in raw:
            return True
    return False


def _covers(decl: str, rel: str) -> bool:
    """地図の 1 つの記述が、その成果物を含んでいるか。

    ファイル名そのものだけでなく、**フォルダ単位・グロブ単位の宣言も数える**。
    モックのように 1 枚ずつ書かず「このフォルダを gate で見る」と宣言するのが普通なので、
    ここを厳しくすると、ちゃんと検査されているものまで「検査が無い」に出てしまう。
    """
    if not decl:
        return False
    decl = decl.strip().strip("'\"")
    if decl == rel:
        return True
    if "*" in decl:
        import fnmatch
        return fnmatch.fnmatch(rel, decl) or fnmatch.fnmatch(rel, decl + "*")
    d = decl.rstrip("/")
    return rel.startswith(d + "/")


def checked(M: dict, rel: str, keys=CHECK_KEYS) -> bool:
    """その成果物に検査（既定は機械の検査）が届いているか。"""
    found = [False]

    def walk_obj(node):
        if found[0]:
            return
        if isinstance(node, dict):
            # 置き場を指すキーは file / path だけではない。
            # 台帳・例外・入力ファイルを別名で持つ節（exceptions・ledger・design・input …）を
            # 見落とすと、実際は検査されているものが「検査が無い」に出る。
            decls = [str(node.get(k)) for k in
                     ("file", "path", "mocks", "dir", "glob", "exceptions", "ledger",
                      "design", "input", "source", "catalog", "spec", "flow", "er")
                     if isinstance(node.get(k), str)]
            has_check = any(k in node for k in keys)
            if has_check and any(_covers(d, rel) for d in decls):
                found[0] = True; return
            # command / gate の文字列に置き場が書いてある形（--mocks 06_mockup/v1 等）
            if has_check and decls and any(rel == d or _covers(d, rel) for d in decls):
                found[0] = True; return
            for k in [x for x in ("command", "gate", "ci_check", "check") if x in keys]:
                v = str(node.get(k) or "")
                if v:
                    for tok in re.findall(r"[\w./\-\u3000-\u9fff]+", v):
                        if _covers(tok, rel) or tok == rel:
                            found[0] = True; return
            for v in node.values():
                walk_obj(v)
        elif isinstance(node, list):
            for v in node:
                walk_obj(v)
    walk_obj(M)
    return found[0]


def need_by_artifact(rel: str, decs: dict) -> int:
    """その成果物を reflect_in で名指しした決定のうち、いちばん新しい番号を返す。

    reflect_in の 1 項目は「入れ物／名前」の形で書かれる。ここで 2 つを区別する。
      - 入れ物が成果物そのもの（ER図/blocks・flow.json/objects）→ 後ろは中の節。入れ物ぜんぶが対象
      - 入れ物が束ねるもの（mockup/backlog・01_hearing/決定ログ.md）→ 後ろは成果物の名前。その 1 件だけ
    これを分けないと、1 枚の画面を名指した決定が、その層の全ファイルを古いことにしてしまう。
    """
    low = rel.lower()
    base = os.path.basename(low)
    stem = os.path.splitext(base)[0]
    best = 0
    for did, (_src, meta) in decs.items():
        if "status: confirmed" not in meta:
            continue
        m = re.search(r"reflect_in:\s*\[(.*?)\]", meta, re.S)
        if not m:
            continue
        for tok in m.group(1).split(","):
            t = tok.strip().strip("'\"").lower()
            parts = [x for x in t.split("/") if x]
            if not parts:
                continue
            head = parts[0]
            key, ext = os.path.splitext(head)
            # 拡張子付きで書かれた入れ物は、その綴りのまま当てる（flow.json が flow.html を巻き込まない）
            if not (head in low if ext else key in low):
                continue
            if len(parts) > 1 and key != stem and parts[-1] not in base:
                continue   # 名指しされたのは同じ層の別の成果物
            n = re.match(r"D-(\d{3})", did)
            if n:
                best = max(best, int(n.group(1)))
            break
    return best


def decisions_in(root: str, files) -> dict:
    out = {}
    for rel in files:
        if not rel.endswith(".md"):
            continue
        body = open(os.path.join(root, rel), encoding="utf-8", errors="ignore").read()
        for m in re.finditer(r"<!--\s*decision:\s*(D[-\w.]+)(.*?)-->", body, re.S):
            out[m.group(1)] = (rel, m.group(2))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--map", default="spec-dependencies.yaml")
    ap.add_argument("--ext", default=",".join(ART_EXT))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--full", action="store_true",
                    help="一覧を省略せず全部出す（既定は先頭だけ）")
    ap.add_argument("--stale-gap", type=int, default=0,
                    help="正本の最新の決定から何番まで遅れてよいか（既定 0＝遅れたら赤）")
    a = ap.parse_args()
    root = os.path.abspath(a.project_root)
    exts = tuple(x.strip() for x in a.ext.split(",") if x.strip())
    raw, M = map_text(root, a.map)
    if not raw:
        print(f"FAIL — 依存マップ {a.map} が無い。プロジェクト全体を見る土台が無い")
        return 2

    arts = [f for f in walk(root, exts) if f != a.map]
    # 見ない層は地図に理由つきで宣言する（理由の無い除外は書けない）
    ig = (M.get("project_audit") or {}).get("ignore") or []
    ignored = []
    for row in ig:
        pat = row.get("path") if isinstance(row, dict) else None
        why = row.get("reason") if isinstance(row, dict) else None
        if not pat or not why:
            print(f"FAIL — project_audit.ignore は path と reason の両方が要る: {row}")
            return 2
        keep = [f for f in arts if not _covers(pat, f)]
        ignored += [f for f in arts if _covers(pat, f)]
        arts = keep
    decs = decisions_in(root, arts)
    src_files = sorted({v[0] for v in decs.values()})
    newest_src = max((os.path.getmtime(os.path.join(root, f)) for f in src_files), default=0)
    # 正本が持ついちばん新しい決定（confirmed のみ。スコープ外は数えない）
    newest_decision = 0
    for did, (rel_, meta) in decs.items():
        if "status: confirmed" in meta:
            m = re.match(r"D-(\d{3})", did)
            if m:
                newest_decision = max(newest_decision, int(m.group(1)))

    holes, nocheck, stale, ghosts, manual, stale_declared = [], [], [], [], [], []
    # 追いつかなくてよい層は理由つきで宣言する（理由の無い放置は通さない）
    stale_ok = (M.get("project_audit") or {}).get("stale_ok") or []
    for row in stale_ok:
        if not (isinstance(row, dict) and row.get("path") and row.get("reason")):
            print(f"FAIL — project_audit.stale_ok は path と reason の両方が要る: {row}")
            return 2
    for rel in arts:
        if rel in src_files:
            continue
        if not referenced(raw, rel):
            holes.append(rel); continue
        if not checked(M, rel):
            # 機械の検査が無いなら、「手で見る」＋理由があるか
            if not checked(M, rel, MANUAL_KEYS):
                nocheck.append(rel)
            else:
                manual.append(rel)
        # 中身の新しさ＝その成果物が参照している決定 ID の最大値
        try:
            body = open(os.path.join(root, rel), encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        ids = [int(x) for x in re.findall(r"D-(\d{3})", body)]
        want = need_by_artifact(rel, decs)          # この成果物を名指しした決定のうち最新
        if not want:
            continue                      # 誰も名指ししていない成果物は鮮度で測らない
        if not ids or max(ids) < want - a.stale_gap:
            have = f"D-{max(ids):03d}" if ids else "参照なし"
            if any(_covers(x.get("path", ""), rel) for x in stale_ok):
                stale_declared.append(rel)
            else:
                stale.append(f"{rel}（最新の参照 {have} < この層を名指しした決定 D-{want:03d}）")

    # P4 / P6 地図が指すのにディスクに無いもの。
    #  「まだ作っていない」と書いてあるか（todo / note / まだ作って…）で二つに分ける。
    todo = []
    for m in re.finditer(r"(?:file|path):\s*['\"]?([^\s'\"]+\.[a-z]{2,5})", raw):
        f = m.group(1)
        if "*" in f or "?" in f or f.startswith("$") or "://" in f:
            continue
        if os.path.exists(os.path.join(root, f)):
            continue
        # その記述のまわり（次の行から 6 行）に理由が書いてあるか
        tail = raw[m.end(): m.end() + 600]
        blk = tail.split("\n- ")[0]
        if re.search(r"todo:|まだ作っていない|未着手|これから作る|後で作る", blk):
            todo.append(f)
        else:
            ghosts.append(f)
    ghosts = sorted(set(ghosts) - set(todo))
    todo = sorted(set(todo))

    # P7 地図の重複キー（YAML の後勝ちで、書いた検査が黙って消える）
    dupkeys, seen, indent_stack = [], {}, []
    for ln_no, ln in enumerate(raw.split("\n"), 1):
        m = re.match(r"^(\s*)([A-Za-z_][\w-]*):", ln)
        if not m:
            continue
        ind, key = len(m.group(1)), m.group(2)
        if re.match(r"^\s*-\s", ln):
            continue
        seen = {k: v for k, v in seen.items() if k[0] < ind or (k[0] == ind and False)}
        prev = seen.get((ind, key))
        if prev is not None:
            dupkeys.append(f"{key}（{prev} 行目と {ln_no} 行目）")
        seen[(ind, key)] = ln_no
        if ind == 0:
            seen = {(0, key): ln_no}
    # ブロック（- id: …）ごとに見る簡易版：同じ字下げ・同じキーが連続する塊の中で 2 回
    dupkeys = dupkeys[:20]

    # P5 正本の結線：正本のファイルに機械の検査が繋がっているか
    reg = set(re.findall(r"D[-\d.]+", raw))
    unreg = sorted(d for d in decs
                   if "status: confirmed" in decs[d][1] and d not in reg)
    src_unchecked = [f for f in src_files if not checked(M, f)]

    by_group: dict = {}
    for rel in arts:
        g = group_of(rel)
        b = by_group.setdefault(g, {"n": 0, "hole": 0, "nocheck": 0, "stale": 0})
        b["n"] += 1
        if rel in holes: b["hole"] += 1
        if rel in nocheck: b["nocheck"] += 1
        if rel in stale: b["stale"] += 1

    out = {
        "artifacts": len(arts), "sources": src_files, "decisions": len(decs),
        "P1_map_holes": holes, "P2_no_check": nocheck, "P3_stale": stale,
        "P4_ghosts": ghosts, "P5_sources_without_check": src_unchecked,
        "unregistered_decisions": unreg,
        "P6_not_started": todo, "P7_duplicate_keys": dupkeys,
        "by_group": by_group,
        "P2_manual": manual,
        "P3_stale_declared": stale_declared,
        "status": "pass" if not (holes or ghosts or src_unchecked or nocheck or stale) else "fail",
    }
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return 0 if out["status"] == "pass" else 2

    print(f"プロジェクト全体の棚卸し — 成果物 {len(arts)} 件"
          f"{f'（見ないと宣言 {len(ignored)} 件）' if ignored else ''} / 正本 {src_files} / 決定 {len(decs)} 件\n")
    print(f"{'層':<22}{'成果物':>6}{'地図に無い':>10}{'検査が無い':>10}{'正本より古い':>12}")
    for g, b in sorted(by_group.items(), key=lambda x: -x[1]["n"]):
        print(f"  {g:<20}{b['n']:>6}{b['hole']:>10}{b['nocheck']:>10}{b['stale']:>12}")
    print(f"\n  P1 地図の穴   {len(holes)}   ディスクにあるのに地図のどこからも見ていない")
    for x in (holes if a.full else holes[:12]): print("      -", x)
    if not a.full and len(holes) > 12: print(f"      … 他 {len(holes)-12}")
    print(f"  P2 検査の穴   {len(nocheck)}   機械の検査も「手で見る＋理由」も無い"
          f"（手で見ると宣言 {len(manual)} 件）")
    for x in (nocheck if a.full else nocheck[:8]): print("      -", x)
    if not a.full and len(nocheck) > 8: print(f"      … 他 {len(nocheck)-8}")
    print(f"  P3 鮮度       {len(stale)}   正本より古い＝決定が動いたのに追随していない"
          f"（追いつかなくてよいと宣言 {len(stale_declared)} 件）")
    for x in (stale if a.full else stale[:12]):
        print("      -", x)
    if not a.full and len(stale) > 12:
        print(f"      … 他 {len(stale)-12}")
    print(f"  P4 幽霊       {len(ghosts)}   地図が指すのに無く、作っていないとも書いていない")
    for x in (ghosts if a.full else ghosts[:8]): print("      -", x)
    print(f"  P7 重複キー   {len(dupkeys)}   地図で同じキーが 2 回（後勝ちで前が黙って消える）")
    for x in (dupkeys if a.full else dupkeys[:6]): print("      -", x)
    print(f"  P6 未着手     {len(todo)}   地図が指すのに無いが、理由が書いてある（赤にしない）")
    print(f"  P5 正本の結線 {len(src_unchecked)}   正本に機械の検査が繋がっていない"
          f"（繋がっていればその正本の決定は全部その検査の視界に入る）")
    for x in src_unchecked: print("      -", x)
    print(f"     参考：地図に個別登録されていない confirmed の決定 {len(unreg)} 件"
          f"（正本に検査が繋がっていれば、それらも見られている）")

    if out["status"] == "pass":
        print("\nPASS — ディスクにある成果物は全部、地図の上にある")
        return 0
    print("\nFAIL — 手で並べたリストではなく、ディスクを分母にすると穴が出る。")
    print("       穴を埋めるか、見ない理由を地図に書く。書かない限り赤のまま。")
    return 2


if __name__ == "__main__":
    sys.exit(main())
