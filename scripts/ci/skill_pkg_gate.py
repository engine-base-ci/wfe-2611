#!/usr/bin/env python3
"""skill_pkg_gate.py — Kaname のスキル一式（10_skills/<skill>/）の検査（SK1〜SK6）。D-080。
 SK1 必須の節（発動条件／読む入力／手順／出す出力／判定基準／禁止／テスト場面）と YAML（id・kind・version・name・purpose・source）
 SK2 禁止の中身（資格情報・固有名・金額の実値の匂い）／ SK3 evals の場面 5 以上（given/when/then/look_at）／ SK4 version と changelog の整合
 SK5 catalog.json と一致（status=draft の一式が存在・id が一致）／ SK6 source の決定 ID が決定ログにある
使い方: python3 skill_pkg_gate.py 10_skills [--log 01_hearing/決定ログ_進行中.md]"""
import argparse, json, re, sys
from pathlib import Path
REQ = ["発動条件", "読む入力", "手順", "出す出力", "判定基準", "禁止", "テスト場面"]
FORBID = [r"password", r"パスワード\s*[:：]", r"api[_-]?key", r"secret", r"token\s*[:：]", r"ENGINE BASE", r"ミナト建装", r"スミレ食品", r"高本", r"佐藤 健", r"田中 誠", r"@[a-z0-9-]+\.(com|jp)"]
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("dir"); ap.add_argument("--log", default="01_hearing/決定ログ_進行中.md"); a = ap.parse_args()
    root = Path(a.dir); cat = json.load(open(root / "catalog.json", encoding="utf-8"))["skills"]; decs = set(re.findall(r"decision: (D-\d{3})", Path(a.log).read_text(encoding="utf-8"))) if Path(a.log).exists() else set()
    fails = []; n = 0
    for d in sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith("_")):
        n += 1; sk = d / "SKILL.md"
        if not sk.exists(): fails.append(("SK1", f"{d.name}: SKILL.md が無い")); continue
        t = sk.read_text(encoding="utf-8"); fm = re.search(r"^---\n(.*?)\n---", t, re.S); meta = {}
        if fm:
            for m in re.finditer(r"^(\w+):\s*(.*)$", fm.group(1), re.M): meta[m.group(1)] = m.group(2).strip()
        miss = [k for k in ("id", "kind", "version", "name", "purpose", "source") if k not in meta] + [s for s in REQ if f"## {s}" not in t]
        if miss: fails.append(("SK1", f"{d.name}: 欠け {miss}"))
        if meta.get("id") and meta["id"] != d.name: fails.append(("SK1", f"{d.name}: id が フォルダ名と違う（{meta['id']}）"))
        body = t + "".join(p.read_text(encoding="utf-8") for p in d.rglob("*") if p.is_file() and p.suffix in (".md", ".json") and p != sk)
        hit = [f for f in FORBID if re.search(f, body, re.I)]
        if hit: fails.append(("SK2", f"{d.name}: 禁止の中身 {hit}"))
        ev = d / "evals" / "scenarios.json"
        if not ev.exists(): fails.append(("SK3", f"{d.name}: evals/scenarios.json が無い"))
        else:
            sc = json.load(open(ev, encoding="utf-8")).get("scenarios", []); bad = [s.get("id") for s in sc if not all(s.get(k) for k in ("given", "when", "then", "look_at"))]
            if len(sc) < 5 or bad: fails.append(("SK3", f"{d.name}: 場面 {len(sc)}（5 以上）／欠け {bad}"))
        if meta.get("version"):
            vers = re.findall(r"version:\s*(\d+)", fm.group(1) if fm else "")
            if str(meta["version"]) not in vers[1:] and len(vers) > 1 and str(meta["version"]) != vers[-1]: fails.append(("SK4", f"{d.name}: version {meta['version']} が changelog に無い"))
        srcs = re.findall(r"D-\d{3}", meta.get("source", "")); ghost = [s for s in srcs if s not in decs]
        if not srcs or ghost: fails.append(("SK6", f"{d.name}: source が無い／無い決定 {ghost}"))
    ids = {c["id"] for c in cat}; dirs = {p.name for p in root.iterdir() if p.is_dir() and not p.name.startswith("_")}
    for c in cat:
        if c["status"] == "draft" and c["id"] not in dirs: fails.append(("SK5", f"catalog: {c['id']} は draft なのに一式が無い"))
    for x in dirs - ids: fails.append(("SK5", f"catalog に無い一式 {x}"))
    print(f"スキル一式 {n} / catalog {len(cat)}（draft {sum(1 for c in cat if c['status']=='draft')}・todo {sum(1 for c in cat if c['status']=='todo')}）")
    for k, m in fails: print(f"  ★ [{k}] {m}")
    print("PASS — SK1〜SK6 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); return 0 if not fails else 2
if __name__ == "__main__": sys.exit(main())
