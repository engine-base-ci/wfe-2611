#!/usr/bin/env python3
"""web の組の実ブラウザの試験を流す（K-177）。全部の回は今までの命令、チケットの範囲の回は選んだ試験だけ。

  python3 scripts/ci/web_run.py g48|g59     env：CI_FULL（true/false）・CI_WEB_SPECS（JSON の一覧）・CI_WEB_TASKS（JSON・g48 だけ）

g48：試験を流す → 結果の記録（ci_results.py record）→ 照らす（op_gate.py：全部の回は --all・範囲の回は選んだ試験の持ち主だけ --task）
g59：中間の試験（apps/web/tests/skeleton）。範囲の回は選んだものだけ。どちらも、選んだ物が無ければ何も流さない（0 で終わる）
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

WEB = "apps/web/"


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
            gate = [x for t in tasks for x in ("--task", t)]
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


def env_for(part: str, base: dict) -> dict:
    """報告の置き場（op_gate と ci_results が読む）。組の段の JUnit の置き場（PLAYWRIGHT_JUNIT_OUTPUT_NAME）はそのまま"""
    if part == "g48":
        return {**base, "PW_REPORT": "pw-reports/k.json"}
    return {**base, "PW_REPORT": "pw-reports/skeleton.json", "PLAYWRIGHT_HTML_OUTPUT_DIR": "playwright-report-skeleton"}


def main() -> int:
    part = sys.argv[1] if len(sys.argv) > 1 else ""
    full = os.environ.get("CI_FULL") == "true"
    specs = json.loads(os.environ.get("CI_WEB_SPECS") or "[]")
    tasks = json.loads(os.environ.get("CI_WEB_TASKS") or "[]")
    cmds = commands(part, full, specs, tasks)
    if not cmds:
        print(f"{part}：チケットの範囲に当たる画面の試験が無い（流さない）")
        return 0
    env = env_for(part, dict(os.environ))
    for c in cmds:
        print("$ " + " ".join(c), flush=True)
        r = subprocess.run(c, env=env)
        if r.returncode != 0:
            return r.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
