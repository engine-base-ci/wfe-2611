#!/usr/bin/env python3
"""web の組の実ブラウザの試験を流す（K-177）。全部の回は今までの命令、チケットの範囲の回は選んだ試験だけ。

  python3 scripts/ci/web_run.py g48|g59     env：CI_FULL（true/false）・CI_WEB_SPECS（JSON の一覧）・CI_WEB_TASKS（JSON・g48 だけ）

g48：試験を流す → 結果の記録（ci_results.py record）→ 照らす（op_gate.py：全部の回は --all・範囲の回は選んだ試験の持ち主だけ --task）
g59：中間の試験（apps/web/tests/skeleton）。範囲の回は選んだものだけ。どちらも、選んだ物が無ければ何も流さない（0 で終わる）
gate <段>：専用の段の画面の試験（ci_scope.json の web_select.gates・K-238）。全部の回は設定の一覧、範囲の回は CI_WEB_GATES の選んだ試験だけ。
  選ばれていなければ何も流さない（0 で終わる）。g48・g59 は、CI_WEB_GATES に流す物があれば「両方の段が空＝壊れている」にしない

分けて流す（K-1304・今だけの設定）：置き場の変数 WEB_SHARDS（無ければ 1）の数に G48 を分け、G59・専用の段も別の組にして同時に流す。
  shards --github-output <道>：static の組で、WEB_SHARDS_VAR から web_shards（数）と web_parts（web の組の matrix の一覧）を出す。
    1（か空）なら ["all"]＝今と同じ 1 組。2 以上なら ["g48-1"…"g48-N", "g59", "g<専用の段>"…]。数でない・範囲の外は赤
  web の組は WEB_PART（matrix の 1 つ）と WEB_SHARDS を env で受け、自分の組の段だけを流す（ほかの段は 0 で終わる）。
    g48-<i> は G48 の試験を --shard=<i>/<N> で流して blob の報告と終わりの番号を web-part/ に残す（記録と照らしは g48-report が 1 回）
  g48-report：web-report の組で、分けた blob を merge-reports で 1 つの JSON（pw-reports/k.json）と JUnit（junit/web.xml）にまとめ、
    今と同じ ci_results.py record と op_gate.py を 1 回流す。分けた結果が N つそろわない・どれかが赤なら記録せずに赤
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

WEB = "apps/web/"
MAX_SHARDS = 40            # 変数の誤り（桁の打ち間違い）で台を食いつぶさない上限
PART_DIR = "web-part"      # 分けた組が残す物（blob の報告・終わりの番号）。報告の置き場（playwright-report・pw-reports）とは別の名前


def commands(part: str, full: bool, specs: list[str], tasks: list[str]) -> list[list[str]]:
    rel = [s[len(WEB):] if s.startswith(WEB) else s for s in specs]
    if part == "g48":
        if full:
            run = ["pnpm", "--filter", "@kaname/web", "e2e:k"]
            gate = ["--all"]
        else:
            if not rel:
                return []
            run = ["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test", *rel]
            gate = [x for sp in specs for x in ("--rows-in", sp)]   # 流した試験に書かれた行だけを照らす（持ち主で決めない・K-177）
        return [run,
                ["python3", "scripts/ci/ci_results.py", "record", "--report", "apps/web/pw-reports/k.json",
                 "--sha", os.environ.get("GITHUB_SHA", ""), "--records", "07_qa/ci-results"],
                ["python3", "scripts/ci/op_gate.py", "--spec", "07_qa/test-specs/k", "--tickets", "11_tickets/tickets.json",
                 *gate, "--pending-from-report"]]
    if part == "g59":
        if not full and not rel:
            return []
        return [["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test", *(["tests/skeleton"] if full else rel)]]
    raise SystemExit(f"知らない段 {part}（g48・g59）")


def gate_commands(gid: str, full: bool, selected: dict, cfg_tests: list[str]) -> list[list[str]]:
    """専用の段の命令：全部の回は設定の一覧、範囲の回は選んだ試験だけ。無ければ命令 0"""
    specs = cfg_tests if full else list(selected.get(gid) or [])
    rel = [s[len(WEB):] if s.startswith(WEB) else s for s in specs]
    return [["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test", *rel]] if rel else []


def gate_tests(gid: str) -> list[str]:
    cfg = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ci_scope.json"), encoding="utf-8"))
    return list((((cfg.get("web_select") or {}).get("gates") or {}).get(gid) or {}).get("tests") or [])


def gate_selection(gid: str) -> list[str] | None:
    """範囲の回の専用の段の一覧。渡っていない（無い・空・JSON でない・鍵が無い）なら None"""
    raw = os.environ.get("CI_WEB_GATES") or ""
    try:
        got = json.loads(raw) if raw.strip() else None
    except json.JSONDecodeError:
        return None
    if not isinstance(got, dict) or gid not in got:
        return None
    return list(got[gid] or [])


def shard_count(raw: str) -> int:
    """変数 WEB_SHARDS の値 → 分ける数。空（変数が無い）は 1。整数で 1〜MAX_SHARDS の外は ValueError（黙って 1 にしない）"""
    raw = (raw or "").strip()
    if not raw:
        return 1
    if not re.fullmatch(r"[0-9]+", raw) or not 1 <= int(raw) <= MAX_SHARDS:   # 全角の数字（１）は通さない
        raise ValueError(f"WEB_SHARDS は 1〜{MAX_SHARDS} の整数（今の値 {raw!r}）")
    return int(raw)


def parts(n: int, gate_ids: list[str]) -> list[str]:
    """web の組の matrix の一覧。1 なら今と同じ 1 組（all）。2 以上なら G48 を n 組・G59 を 1 組・専用の段を 1 つずつ"""
    if n == 1:
        return ["all"]
    return [f"g48-{i}" for i in range(1, n + 1)] + ["g59"] + [f"g{g}" for g in sorted(gate_ids, key=int)]


def part_runs(step: str, part: str) -> bool:
    """段（g48・g59・g<専用の段>）をこの組（WEB_PART）で流すか。all は全部"""
    return part == "all" or part == step or (step == "g48" and part.startswith("g48-"))


def shard_args(part: str, n: int) -> list[str]:
    """G48 の分けた 1 組の playwright の引数（blob の報告だけを出す・選んだ試験が少なくて空の組になっても赤にしない）"""
    i = int(part.split("-", 1)[1])
    if not 1 <= i <= n:
        raise ValueError(f"組 {part} が分ける数 {n} の外")
    return [f"--shard={i}/{n}", "--reporter=list,blob", "--pass-with-no-tests"]


def gate_ids() -> list[str]:
    cfg = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ci_scope.json"), encoding="utf-8"))
    return list((((cfg.get("web_select") or {}).get("gates")) or {}).keys())


def write_outputs(path: str, n: int, gate_ids: list[str]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"web_shards={n}\nweb_parts={json.dumps(parts(n, gate_ids))}\n")


def run_all(cmds: list[list[str]], env: dict) -> int:
    for c in cmds:
        print("$ " + " ".join(c), flush=True)
        r = subprocess.run(c, env=env)
        if r.returncode != 0:
            return r.returncode
    return 0


def env_for(part: str, base: dict) -> dict:
    """報告の置き場（op_gate と ci_results が読む）。組の段の JUnit の置き場（PLAYWRIGHT_JUNIT_OUTPUT_NAME）はそのまま"""
    if part == "g48":
        return {**base, "PW_REPORT": "pw-reports/k.json"}
    return {**base, "PW_REPORT": "pw-reports/skeleton.json", "PLAYWRIGHT_HTML_OUTPUT_DIR": "playwright-report-skeleton"}


def run_shard(part: str, n: int, cmds: list[list[str]], env: dict) -> int:
    """G48 の分けた 1 組：試験だけを流し（記録と照らしは g48-report）、blob の報告を web-part/blob に残す（終わりの番号は main が印に書く）"""
    run = cmds[0] + shard_args(part, n)
    env = {**env_for("g48", env), "PLAYWRIGHT_BLOB_OUTPUT_DIR": os.path.abspath(os.path.join(PART_DIR, "blob"))}
    print("$ " + " ".join(run), flush=True)
    return subprocess.run(run, env=env).returncode


NONE = -999   # 段の中の印：この回は流す物が無かった（選ばれなかった）


def mark(part: str, code: int) -> None:
    """all でない組の終わりの印 web-part/<組>.rc（終わりの番号か none）。上げる物を空にしない・g48-report が数える"""
    os.makedirs(PART_DIR, exist_ok=True)
    with open(os.path.join(PART_DIR, f"{part}.rc"), "w", encoding="utf-8") as f:
        f.write(("none" if code == NONE else str(code)) + "\n")


def report_commands(full: bool, specs: list[str], tasks: list[str]) -> list[list[str]]:
    """g48-report の命令：分けた blob を 1 つにまとめる命令 → 今と同じ記録と照らし（g48 の 2 つ目から）。流す物が無ければ命令 0"""
    base = commands("g48", full, specs, tasks)
    if not base:
        return []
    merge = ["pnpm", "--filter", "@kaname/web", "exec", "playwright", "merge-reports", "--reporter=json,junit",
             os.path.abspath(os.path.join(PART_DIR, "blob"))]
    return [merge, *base[1:]]


def shard_results(n: int) -> tuple[list[str], dict[str, int]]:
    """web-part/ にそろった blob の報告と、組ごとの終わりの番号"""
    blob = os.path.join(PART_DIR, "blob")
    zips = sorted(f for f in (os.listdir(blob) if os.path.isdir(blob) else []) if f.endswith(".zip"))
    rcs: dict[str, int] = {}
    for i in range(1, n + 1):
        f = os.path.join(PART_DIR, f"g48-{i}.rc")
        if os.path.exists(f):
            with open(f, encoding="utf-8") as fh:
                raw = fh.read().strip()
            rcs[f"g48-{i}"] = int(raw) if re.fullmatch(r"-?[0-9]+", raw) else 1   # 読めない番号は赤の組として数える
    return zips, rcs


def report(n: int, full: bool, specs: list[str], tasks: list[str], empty_ok: bool) -> int:
    cmds = report_commands(full, specs, tasks)
    if not cmds:
        if empty_ok:
            print("g48-report：この回は G48 に当たる画面の試験が無い（ほかの段だけ流す）")
            return 0
        print("★ g48-report：web の組が動いているのに、流す画面の試験の一覧が両方の段で空（範囲の台本の出力 web_g48・web_g59 が渡っていない）")
        return 1
    zips, rcs = shard_results(n)
    if len(zips) != n or len(rcs) != n:
        # 途中で落ちた組がある：今の 1 組が途中で落ちた回と同じく、まとめ（web.xml）も記録も作らない
        print(f"★ FAIL 分けた G48 の結果が {n} 組のうち blob {len(zips)} つ・終わりの番号 {len(rcs)} つしか無い（落ちた組がある）")
        return 1
    env = {**env_for("g48", dict(os.environ)), "PLAYWRIGHT_JSON_OUTPUT_NAME": os.path.abspath("apps/web/pw-reports/k.json")}
    rc = run_all(cmds[:1], env)   # 赤の組があっても JUnit（junit/web.xml）はまとめる（ticket-flow が行ごとに照らす）
    if rc != 0:
        return rc
    red = sorted(k for k, v in rcs.items() if v != 0)
    if red:
        print(f"★ FAIL 分けた G48 の組 {'・'.join(red)} の試験が赤（今までの 1 組と同じく、記録と照らしは流さない）")
        return 1
    return run_all(cmds[1:], env)


def other_has_work(gates: dict) -> bool:
    return bool(json.loads(os.environ.get("CI_WEB_OTHER") or "[]")) or any(gates.values())


def main() -> int:
    part = sys.argv[1] if len(sys.argv) > 1 else ""
    if part == "shards":
        out = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == "--github-output" else ""
        try:
            n = shard_count(os.environ.get("WEB_SHARDS_VAR", ""))
        except ValueError as e:
            print(f"★ shards：{e}")
            return 1
        gids = gate_ids()
        print(f"web の組：{n} つに分ける → {json.dumps(parts(n, gids))}")
        if out:
            write_outputs(out, n, gids)
        return 0
    web_part = os.environ.get("WEB_PART") or "all"
    try:
        n = shard_count(os.environ.get("WEB_SHARDS", ""))
    except ValueError as e:
        print(f"★ {part}：{e}")
        return 1
    if part != "g48-report" and web_part not in parts(n, gate_ids()):
        print(f"★ {part}：組 WEB_PART={web_part!r} は分ける数 {n} の組の一覧 {parts(n, gate_ids())} に無い（黙って何も流さずに緑にしない）")
        return 1
    full = os.environ.get("CI_FULL") == "true"
    try:
        gates = json.loads(os.environ.get("CI_WEB_GATES") or "{}")
    except json.JSONDecodeError:
        gates = {}
    gates = gates if isinstance(gates, dict) else {}
    if part == "g48-report":
        if n < 2:
            print("★ g48-report：分ける数が 1（今の 1 組は web の組が記録と照らしまで流す）")
            return 1
        return report(n, full, json.loads(os.environ.get("CI_WEB_SPECS") or "[]"),
                      json.loads(os.environ.get("CI_WEB_TASKS") or "[]"), other_has_work(gates))
    step = f"g{sys.argv[2] if len(sys.argv) > 2 else ''}" if part == "gate" else part
    if not part_runs(step, web_part):
        print(f"{step}：この組（{web_part}）では流さない（ほかの組が流す・K-1304）")
        return 0
    code = run_step(part, web_part, n, full, gates)
    if web_part != "all":
        mark(web_part, code)
    return 0 if code == NONE else code


def run_step(part: str, web_part: str, n: int, full: bool, gates: dict) -> int:
    """この組で流す段を流す。流す物が無かった（選ばれなかった）なら NONE"""
    if part == "gate":
        gid = sys.argv[2] if len(sys.argv) > 2 else ""
        cfg_tests = gate_tests(gid)
        if not cfg_tests:
            print(f"★ gate：専用の段 {gid} が ci_scope.json の web_select.gates に無い")
            return 1
        if not full:
            sel = gate_selection(gid)
            if sel is None:
                print(f"★ gate {gid}：範囲の台本の一覧 CI_WEB_GATES が渡っていない（無い・空・JSON でない・段 {gid} の鍵が無い）")
                return 1
            if not sel:
                rest = json.loads(os.environ.get("CI_WEB_SPECS") or "[]") + json.loads(os.environ.get("CI_WEB_OTHER") or "[]")
                # 専用の段が 2 つ以上あるので、ほかの専用の段に流す物が在れば、この段は選ばれなかっただけ（K-379）
                if rest or any(v for k, v in gates.items() if k != gid):
                    print(f"gate {gid}：この回は専用の段 {gid} の画面の試験が選ばれていない（ほかの段だけ流す）")
                    return NONE
                print(f"★ gate {gid}：web の組が動いているのに、どの段にも流す画面の試験が無い（範囲の台本の出力が渡っていない）")
                return 1
            gates = {gid: sel}
        return run_all(gate_commands(gid, full, gates, cfg_tests), dict(os.environ))
    specs = json.loads(os.environ.get("CI_WEB_SPECS") or "[]")
    tasks = json.loads(os.environ.get("CI_WEB_TASKS") or "[]")
    cmds = commands(part, full, specs, tasks)
    if not cmds:
        if other_has_work(gates):   # もう片方の段（G48／G59）には流す物がある。この段は選ばれなかっただけ
            print(f"{part}：この段に当たる画面の試験は無い（もう片方の段だけ流す）")
            return NONE
        # web の組が動いているのに両方の段の一覧が空＝範囲の台本の出力が渡っていない（壊れている）。黙って緑にしない
        print(f"★ {part}：web の組が動いているのに、流す画面の試験の一覧が両方の段で空（範囲の台本の出力 web_g48・web_g59 が渡っていない）")
        return 1
    if web_part.startswith("g48-"):
        return run_shard(web_part, n, cmds, dict(os.environ))
    return run_all(cmds, env_for(part, dict(os.environ)))


if __name__ == "__main__":
    sys.exit(main())
