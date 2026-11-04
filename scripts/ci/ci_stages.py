#!/usr/bin/env python3
"""dagci の段の一覧を、GitHub の v3-gate.yml（05_flow/build_testplan.py が作る）から導く（KN-124）。手で写さない。

  python3 scripts/ci/ci_stages.py        段の一覧を YAML で出す（ci.yaml の include から呼ぶ）
  python3 scripts/ci/ci_stages.py --check v3-gate.yml の検査の手順が、段にどれも 1 対 1 で入っているか（外す job は理由つき）

GitHub の job ごとの違いは、段の services・env・needs に写す:
  static   → 相手なし
  database → postgres（DATABASE_URL は相手の名前 postgres に向ける）
  spec     → postgres（同じ）
  web      → 画面を本番の形で組み立てて立ち上げ、実ブラウザの試験を流す（組み立て・立ち上げ・試験を 1 つの段にまとめる）
外す job（理由）:
  task-gate  task/ の枝の PR のときだけ動く（07_tasks のしまった仕組み）
  e2e        staging の本物の環境が要る（D-128.119 の KN-110 で staging ができてから）
  auto-merge GitHub の取り込みの道具（dagci では pm_merge.sh が CI の緑を確かめて取り込む）
"""
from __future__ import annotations
import json, os, re, sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WF = os.path.join(ROOT, ".github/workflows/v3-gate.yml")
SKIP = {"task-gate": "task/ の枝の PR のときだけ動く（07_tasks のしまった仕組み）",
        "e2e": "staging の本物の環境が要る（KN-110 で staging ができてから）",
        "auto-merge": "GitHub の取り込みの道具（dagci では pm_merge.sh が CI の緑を確かめて取り込む）"}
SETUP = re.compile(r"^(pnpm install|pip install pyyaml$|pnpm --filter @kaname/web exec playwright install|pnpm --filter @kaname/web build:test$)")
DB_URL = "postgres://postgres:postgres@postgres:5432/kaname_test"


def steps() -> list[dict]:
    wf = yaml.safe_load(open(WF, encoding="utf-8"))
    out = []
    for job, j in wf["jobs"].items():
        if job in SKIP:
            continue
        env = {k: str(v) for k, v in (j.get("env") or {}).items()}
        if "DATABASE_URL" in env:
            env["DATABASE_URL"] = DB_URL
        svc = ["postgres"] if j.get("services") else []
        start = None
        for st in j.get("steps") or []:
            run = (st.get("run") or "").strip()
            if not run or SETUP.match(run):
                continue
            name = st.get("name") or run
            if job == "web" and name == "画面を立ち上げる":
                start = run
                continue
            m = re.match(r"G(\d+)\b", name)
            # job の名前を頭に付ける（v3-gate.yml には static と spec で同じ番号 G27・G28 が 2 回ずつある・2026-11-04 に見つけた）
            sid = f"{job}-g{int(m.group(1)):02d}" if m else f"{job}-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
            cmd = run
            if job == "web":
                # 組み立て → 立ち上げ → 試験 を 1 つの段で（GitHub の web job と同じ順）
                cmd = "pnpm --filter @kaname/web build:test && " + (start or "true").replace("exit 0", "true; break") + " && " + run
            out.append({"id": sid, "name": name, "group": job, "run": cmd, "services": svc, "env": env,
                        "timeout": 3600 if job in ("database", "web") else 1800})
    return out


def main() -> int:
    st = steps()
    if "--check" in sys.argv:
        wf = yaml.safe_load(open(WF, encoding="utf-8"))
        names = [s.get("name") for job, j in wf["jobs"].items() if job not in SKIP for s in j.get("steps") or [] if str(s.get("name") or "").startswith("G")]
        got = [s["name"] for s in st]
        miss = [n for n in names if n not in got]
        dup = sorted({s["id"] for s in st if [x["id"] for x in st].count(s["id"]) > 1})
        for n in miss:
            print("  ★ CS1 v3-gate.yml の検査が段に無い:", n)
        for d in dup:
            print("  ★ CS2 段の id が 2 つある:", d)
        jobs = set(wf["jobs"]) - SKIP.keys() - {"static", "database", "spec", "web"}
        for j in sorted(jobs):
            print(f"  ★ CS3 知らない job {j}（段に写すか、外す理由を ci_stages.py の SKIP に書く）")
        ok = not miss and not dup and not jobs
        print(f"段 {len(st)}・GitHub の検査 {len(names)}・外す job {len(SKIP)}")
        print("PASS — GitHub の検査はどれも dagci の段にある" if ok else "FAIL — 段と GitHub の検査が合わない")
        return 0 if ok else 1
    print(yaml.safe_dump({"stages": st}, allow_unicode=True, sort_keys=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
