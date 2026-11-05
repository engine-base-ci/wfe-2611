#!/usr/bin/env python3
"""dagci の段の一覧を、GitHub の v3-gate.yml（05_flow/build_testplan.py が作る）から導く（K-47）。手で写さない。

  python3 scripts/ci/ci_stages.py        段の一覧を YAML で出す（ci.yaml の include から呼ぶ）
  python3 scripts/ci/ci_stages.py --check v3-gate.yml の検査の手順が、段にどれも 1 対 1 で入っているか（外す job は理由つき）

GitHub の job ごとの違いは、段の services・env・needs に写す:
  static   → 相手なし
  database → postgres（DATABASE_URL は相手の名前 postgres に向ける）
  spec     → postgres（同じ）
  web      → 画面を本番の形で組み立てて立ち上げ、実ブラウザの試験を流す（組み立て・立ち上げ・試験を 1 つの段にまとめる）
  unit-<i> → 単体の試験の i 番目の分け（自分の Postgres＝pg-unit-<i>）。結果（actions/upload-artifact の置き場）を段の export で下流へ渡す。
             分けたものは同時に流すためのものなので、重い段（同時に 1 本だけ）にしない（heavy: false・D-128.140）
  unit     → 分けた結果を合わせる（actions/download-artifact）。needs に分けた job の最後の段を持ち、その export を受け取る
外す job（理由）:
  task-gate  task/ の枝の PR のときだけ動く（07_tasks のしまった仕組み）
  e2e        staging の本物の環境が要る（D-128.119 の K-37 で staging ができてから）
  auto-merge GitHub の取り込みの道具（dagci では pm_merge.sh が CI の緑を確かめて取り込む）
"""
from __future__ import annotations
import json, os, re, sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WF = os.path.join(ROOT, ".github/workflows/v3-gate.yml")
SKIP = {"task-gate": "task/ の枝の PR のときだけ動く（07_tasks のしまった仕組み）",
        "e2e": "staging の本物の環境が要る（K-37 で staging ができてから）",
        "auto-merge": "GitHub の取り込みの道具（dagci では pm_merge.sh が CI の緑を確かめて取り込む）"}
SETUP = re.compile(r"^(pnpm install|pip install pyyaml$|pnpm --filter @kaname/web exec playwright install|pnpm --filter @kaname/web build:test$)")
DB_URL = "postgres://postgres:postgres@{svc}:5432/kaname_test"
# 画面を本番の形で立ち上げて待つ（GitHub の「画面を立ち上げる」と同じ。立ち上がらなければ記録を出して赤）
WEB_START = ("(pnpm --filter @kaname/web start:test > /tmp/web.log 2>&1 &); ok=0; "
             "for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3124/dev/k/showcase && { ok=1; break; }; sleep 2; done; "
             "[ $ok = 1 ] || { cat /tmp/web.log; exit 1; }")


WORKDIR = "/src"   # ci.yaml の workdir（段の容れ物の中の作業場）
SHARD_JOB = re.compile(r"unit-\d+")
KNOWN_JOBS = re.compile(r"static|database|spec|web|unit(-\d+)?")


def uses(j: dict, action: str) -> list[dict]:
    return [st for st in j.get("steps") or [] if str(st.get("uses") or "").startswith(action + "@")]


def steps() -> list[dict]:
    wf = yaml.safe_load(open(WF, encoding="utf-8"))
    out = []
    last: dict[str, str] = {}   # job → その job の最後の段
    for job, j in wf["jobs"].items():
        if job in SKIP:
            continue
        # 別の job の置き場（artifact）を受け取る job は、その job の最後の段を needs に持ち、export を受け取る
        gather = [last[n] for n in (j.get("needs") or []) if n in last] if uses(j, "actions/download-artifact") else []
        first = len(out)
        env = {k: str(v) for k, v in (j.get("env") or {}).items()}
        # GitHub は job ごとに Postgres を 1 つ持ち、job の中の検査は順に流れる。dagci も job ごとに Postgres を分け（pg-<job>）、
        #   その job の中は前の段を needs にして順に流す（同時に流すと、同じ DB を同時に作り直して偽の赤になる・2026-11-04）
        svc = [f"pg-{job}"] if j.get("services") else []
        if "DATABASE_URL" in env and svc:
            env["DATABASE_URL"] = DB_URL.format(svc=svc[0])
        prev = None
        start = None
        for st in j.get("steps") or []:
            run = (st.get("run") or "").strip()
            if not run or SETUP.match(run):
                continue
            name = st.get("name") or run
            if job == "web" and name == "画面を立ち上げる":
                start = WEB_START
                continue
            m = re.match(r"G(\d+)\b", name)
            # job の名前を頭に付ける（v3-gate.yml には static と spec で同じ番号 G27・G28 が 2 回ずつある・2026-11-04 に見つけた）
            sid = f"{job}-g{int(m.group(1)):02d}" if m else f"{job}-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
            cmd = run
            if job == "web":
                # 組み立て → 立ち上げ → 試験 を 1 つの段で（GitHub の web job と同じ順）
                cmd = "pnpm --filter @kaname/web build:test && " + (start or "true") + " && " + run
            st_ = {"id": sid, "name": name, "group": job, "run": cmd, "services": svc, "env": env,
                   "needs": [prev] if (svc and prev) else ([] if prev else gather),
                   "timeout": 3600 if job in ("database", "web") or job.startswith("unit") else 1800}
            if SHARD_JOB.fullmatch(job):
                st_["heavy"] = False
            out.append(st_)
            prev = sid
        up = uses(j, "actions/upload-artifact")
        if up and len(out) > first:
            out[-1]["export"] = [f"{WORKDIR}/{str(u['with']['path']).strip('/')}" for u in up]
        if len(out) > first:
            last[job] = out[-1]["id"]
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
        jobs = {j for j in set(wf["jobs"]) - SKIP.keys() if not KNOWN_JOBS.fullmatch(j)}
        # 段が使う相手（pg-<job>）が ci.yaml の services にあるか（無ければ dagci が設定の誤りで止まる。ここで先に出す）
        have = set((yaml.safe_load(open(os.path.join(ROOT, "ci.yaml"), encoding="utf-8")) or {}).get("services") or {})
        for sv in sorted({x for s_ in st for x in s_["services"]} - have):
            print(f"  ★ CS4 段の相手 {sv} が ci.yaml の services に無い（job ごとに Postgres を 1 つ足す）")
            jobs.add(sv)
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
