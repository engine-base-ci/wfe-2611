#!/usr/bin/env python3
"""画面の試験を「取りに行く形」で流す（K-1304）。web_run.py の pull-<i> の組と g48-report が使う。

並び（queue）：段（g48・g59）ごとの playwright の引数を `playwright test <引数> --list --reporter=json` でファイルに開き、
  試験の数の多い順（同じならファイル名）に並べる。どの台も同じ版から同じ並びを作る。並びの印（hash）は段・ファイル・試験の題から作る。
取り台：CI の置き場の git の印 refs/tf-claim/<回>-<試み>-<並びの印>/<番号> を「無いときだけ作る」push（--force-with-lease=<印>:）で取る。
  サーバーが印の鍵を取ってから作るので、同じ番号を 2 つの台が取ることは無い（取れなかった台には reference already exists が返る）。
  押し込む物は台ごとに別のコミット（同じ物だと「もう同じ」で緑に見え、取れたか分からない）。
結果：web-part/blob-<段>/<番号>-<組>.zip（blob の報告）と web-part/items/<番号>-<組>.json（段・ファイル・終わりの番号・並びの印）。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import tempfile
import time

WEB = "apps/web/"
PART_DIR = "web-part"
PW = ["pnpm", "--filter", "@kaname/web", "exec", "playwright"]
CLAIM_NS = "refs/tf-claim"
TRIES = 3   # 押し込みが網の誤りで落ちたときの試し直し（取られた・取れたの答えは試し直さない）


# ---------------------------------------------------------------- 並び
def e2e_k_args() -> list[str]:
    """package.json の e2e:k（G48 の全部の回の命令）の playwright test の後ろの引数"""
    pkg = json.load(open(os.path.join(WEB, "package.json"), encoding="utf-8"))
    script = pkg["scripts"]["e2e:k"]
    head, sep, rest = script.partition("playwright test")
    if not sep:
        raise SystemExit("★ apps/web/package.json の e2e:k に playwright test が無い")
    return rest.split()


def step_args(kind: str, full: bool, specs: list[str]) -> list[str]:
    rel = [s[len(WEB):] if s.startswith(WEB) else s for s in specs]
    if full:
        return e2e_k_args() if kind == "g48" else ["tests/skeleton"]
    return rel


def list_tests(args: list[str], env: dict) -> list[tuple[str, str]]:
    """playwright --list で (ファイル, 題の道) の一覧。ファイルは testDir からの道（JSON の file）"""
    with tempfile.TemporaryDirectory() as t:
        out = os.path.join(t, "list.json")
        r = subprocess.run([*PW, "test", *args, "--list", "--reporter=json"], env={**env, "PLAYWRIGHT_JSON_OUTPUT_NAME": out},
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(out):
            raise SystemExit(f"★ 並びを作れない（playwright --list が {r.returncode}）\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}")
        return report_tests(json.load(open(out, encoding="utf-8")))


def report_tests(rep: dict) -> list[tuple[str, str]]:
    """JSON の報告（--list でも結果でも同じ形）から (試験のファイル, 親の suite の題 ＋ spec の題 ＋ [project]) の一覧"""
    out: list[tuple[str, str]] = []

    def walk(s: dict, path: list[str], file: str) -> None:
        # ファイルは一番上の suite（試験のファイル）。試験を作る関数が別のファイル（tests/_lib/…）に在ると spec の file はそちらを指すので使わない
        for sp in s.get("specs", []):
            for t in sp.get("tests", []) or [{}]:
                out.append((file, " ".join([*path, sp.get("title", ""), f"[{t.get('projectName', '')}]"]).strip()))
        for c in s.get("suites", []):
            walk(c, [*path, s.get("title", "")], file)
    for s in rep.get("suites", []):
        walk(s, [], s.get("file") or s.get("title", ""))
    return sorted(out)


def build_queue(kinds: dict[str, list[tuple[str, str]]]) -> tuple[list[dict], str]:
    """段ごとの試験の一覧 → 並び（{i, kind, file, tests}）と並びの印"""
    items = []
    for kind, tests in kinds.items():
        per: dict[str, int] = {}
        for f, _ in tests:
            per[f] = per.get(f, 0) + 1
        items += [{"kind": kind, "file": f, "tests": n} for f, n in per.items()]
    items.sort(key=lambda x: (-x["tests"], x["kind"], x["file"]))
    for i, it in enumerate(items):
        it["i"] = i
    h = hashlib.sha256(json.dumps({k: v for k, v in sorted(kinds.items())}, ensure_ascii=False).encode()).hexdigest()[:12]
    return items, h


def make_queue(full: bool, g48: list[str], g59: list[str], env: dict) -> tuple[list[dict], str, dict]:
    kinds: dict[str, list[tuple[str, str]]] = {}
    for kind, specs in (("g48", g48), ("g59", g59)):
        args = step_args(kind, full, specs)
        if args:
            kinds[kind] = list_tests(args, env)
    items, h = build_queue(kinds)
    return items, h, kinds


def file_filter(file: str) -> str:
    """そのファイルだけに当たる playwright の引数（/…/ の形の正規表現・末尾で止める・ほかのファイルに当たらない）"""
    return "/" + re.escape("/tests/" + file) + "$/"


# ---------------------------------------------------------------- 取り台
def namespace(h: str) -> str:
    return f"{CLAIM_NS}/{os.environ.get('GITHUB_RUN_ID', 'local')}-{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}-{h}"


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} → {r.returncode}: {r.stderr.strip()[-500:]}")
    return r


def claimed(ns: str) -> set[int]:
    r = git("ls-remote", "origin", f"{ns}/*")
    return {int(ln.rsplit("/", 1)[1]) for ln in r.stdout.splitlines() if re.search(r"/\d+$", ln)}


def claim(ns: str, i: int, part: str) -> bool:
    """番号 i を取る。取れたら True・ほかの台が先に取っていたら False。網の誤りが続けば RuntimeError"""
    ref = f"{ns}/{i}"
    tree = git("rev-parse", "HEAD^{tree}").stdout.strip()
    idt = {"GIT_AUTHOR_NAME": "tf-claim", "GIT_AUTHOR_EMAIL": "tf-claim@invalid", "GIT_COMMITTER_NAME": "tf-claim", "GIT_COMMITTER_EMAIL": "tf-claim@invalid"}
    sha = subprocess.run(["git", "commit-tree", tree, "-m", f"tf-claim {part} {i} {time.time_ns()}"], capture_output=True, text=True,
                         env={**os.environ, **idt}, check=True).stdout.strip()
    last = ""
    for k in range(TRIES):
        r = git("push", "--porcelain", "origin", f"--force-with-lease={ref}:", f"{sha}:{ref}", check=False)
        last = (r.stdout + r.stderr).strip()[-400:]
        # 取れたかは push の答えの文で決めない（作れたのに誤りが返る・答えの形が違う、で 1 本が誰にも流されずに落ちた）。
        #   置き場の印が今どのコミットを指すかを見て決める：自分のコミットなら取れた・ほかのコミットならほかの台が先・無ければ試し直す
        now = git("ls-remote", "origin", ref, check=False)
        if now.returncode == 0:
            got = now.stdout.split("\t", 1)[0].strip()
            if got:
                return got == sha
        time.sleep(2 * (k + 1))
    raise RuntimeError(f"取り台に押し込めない（{ref}）：{last}")


def release(ns_prefix: str) -> int:
    """この回の取り台の印を 1 回の push でまとめて消す。消した数"""
    refs = [ln.split("\t", 1)[1] for ln in git("ls-remote", "origin", f"{ns_prefix}*").stdout.splitlines() if "\t" in ln]
    for k in range(0, len(refs), 500):
        git("push", "origin", "--delete", *refs[k:k + 500], check=False)
    return len(refs)


# ---------------------------------------------------------------- 流す
def env_kind(kind: str, base: dict) -> dict:
    if kind == "g48":
        return {**base, "PW_REPORT": "pw-reports/k.json"}
    return {**base, "PW_REPORT": "pw-reports/skeleton.json", "PLAYWRIGHT_HTML_OUTPUT_DIR": "playwright-report-skeleton"}


def run_item(it: dict, part: str, h: str, env: dict) -> int:
    blob = os.path.abspath(os.path.join(PART_DIR, f"blob-{it['kind']}", f"{it['i']}-{part}.zip"))
    os.makedirs(os.path.dirname(blob), exist_ok=True)
    cmd = [*PW, "test", file_filter(it["file"]), "--reporter=list,blob"]
    print(f"$ [{it['i']}] {it['kind']} {it['file']}（試験 {it['tests']}）: {' '.join(cmd)}", flush=True)
    t0 = time.time()
    rc = subprocess.run(cmd, env={**env_kind(it["kind"], env), "PLAYWRIGHT_BLOB_OUTPUT_FILE": blob}).returncode
    os.makedirs(os.path.join(PART_DIR, "items"), exist_ok=True)
    with open(os.path.join(PART_DIR, "items", f"{it['i']}-{part}.json"), "w", encoding="utf-8") as f:
        json.dump({**it, "rc": rc, "part": part, "hash": h, "sec": round(time.time() - t0, 1), "blob": os.path.exists(blob)}, f, ensure_ascii=False)
    return rc


def rank(part: str) -> int:
    """pull-<i> → i-1（数でなければ 0）"""
    m = re.search(r"(\d+)$", part)
    return int(m.group(1)) - 1 if m else 0


def pull(part: str, items: list[dict], h: str, env: dict) -> int:
    """取り台から 1 本ずつ取って流す。どれかが赤なら 1・取り台に届かなければ 2（取っていない番号はほかの台が流す）"""
    ns = namespace(h)
    known: set[int] = set()
    red = ran = 0
    print(f"{part}：並び {len(items)} 本（印 {h}）を取りに行く", flush=True)
    while True:
        try:
            known |= claimed(ns)
            todo = [it for it in items if it["i"] not in known]
            if not todo:
                break
            it = todo[rank(part) % len(todo)]   # 台ごとに残りの前のほうの別の 1 本を狙う（全部の台が同じ 1 本を取り合わない・重い物から）
            got = claim(ns, it["i"], part)
        except RuntimeError as e:
            print(f"★ {part}：{e}（この台は止める。取っていない番号はほかの台が流す・取った番号の結果が無ければ g48-report が赤にする）")
            return 2
        known.add(it["i"])
        if got:
            ran += 1
            red += run_item(it, part, h, env) != 0
    print(f"{part}：{ran} 本を流した（赤 {red}）")
    return 1 if red else 0


# ---------------------------------------------------------------- 合わせる（g48-report）
def check_items(items: list[dict], h: str) -> tuple[list[str], dict[int, dict]]:
    """どの番号にも結果がちょうど 1 つ・段とファイルと並びの印が同じか。問題の一覧と番号 → 結果"""
    got: dict[int, list[dict]] = {}
    d = os.path.join(PART_DIR, "items")
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if f.endswith(".json"):
            r = json.load(open(os.path.join(d, f), encoding="utf-8"))
            got.setdefault(int(r["i"]), []).append(r)
    bad: list[str] = []
    for it in items:
        rs = got.get(it["i"], [])
        if not rs:
            bad.append(f"[{it['i']}] {it['kind']} {it['file']} の結果が無い（落ちた）")
        elif len(rs) > 1:
            bad.append(f"[{it['i']}] {it['kind']} {it['file']} を {len(rs)} 回流した（{'・'.join(r['part'] for r in rs)}）")
        elif (rs[0]["kind"], rs[0]["file"], rs[0]["hash"]) != (it["kind"], it["file"], h):
            bad.append(f"[{it['i']}] 並びが違う：台は {rs[0]['kind']} {rs[0]['file']}（印 {rs[0]['hash']}）・ここは {it['kind']} {it['file']}（印 {h}）")
        elif not rs[0].get("blob"):
            bad.append(f"[{it['i']}] {it['kind']} {it['file']} の blob が無い（終わりの番号 {rs[0]['rc']}）")
    extra = sorted(set(got) - {it["i"] for it in items})
    bad += [f"[{i}] 並びに無い番号の結果がある" for i in extra]
    return bad, {i: rs[0] for i, rs in got.items() if len(rs) == 1}


def merge(kind: str, json_out: str, junit_out: str, env: dict) -> int:
    d = os.path.abspath(os.path.join(PART_DIR, f"blob-{kind}"))
    cmd = [*PW, "merge-reports", "--reporter=json,junit", d]
    print("$ " + " ".join(cmd), flush=True)
    return subprocess.run(cmd, env={**env_kind(kind, env), "PLAYWRIGHT_JSON_OUTPUT_NAME": os.path.abspath(json_out),
                                    "PLAYWRIGHT_JUNIT_OUTPUT_NAME": junit_out}).returncode


def same_tests(want: list[tuple[str, str]], json_path: str) -> list[str]:
    """まとめた報告の試験の集合が、並びの試験の集合と同じか（落ちも二重も無い）"""
    got = report_tests(json.load(open(json_path, encoding="utf-8")))
    if got == want:
        return []
    from collections import Counter
    a, b = Counter(want), Counter(got)
    miss = sorted((a - b).elements())
    more = sorted((b - a).elements())
    return [f"流れていない試験 {len(miss)}（例 {miss[:3]}）"] * bool(miss) + [f"並びに無い・二重の試験 {len(more)}（例 {more[:3]}）"] * bool(more)
