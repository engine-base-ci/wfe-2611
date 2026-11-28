#!/usr/bin/env python3
"""spec の組の重い段（G57・G65）を別の組にして同時に流す（K-1307・今だけの設定）。

置き場の変数 SPEC_SHARDS（無ければ 1）が 2 以上の回だけ、spec の組の G57 と G65 を流さず、組 spec-parts（matrix）が流す：
  g57        ：G57（チケットの CI の範囲の台本の試験）を今と同じ命令・同じ条件で 1 組
  g65-<i>    ：G65（CI の形の試験）の並びを SPEC_SHARDS の数に分けた i 番目の組

  shards --github-output <道>：static の組で、SPEC_SHARDS_VAR から spec_shards（数）と spec_parts（spec-parts の組の matrix の一覧）を出す。
    1（か空）なら spec_parts は ["off"]＝spec-parts の組は if で飛び、spec の組が今と全く同じに G57・G65 を流す。数でない・範囲の外は赤
  g65：spec-parts の組で、SPEC_PART（g65-<i>）と SPEC_SHARDS を env で受け、自分の組の命令だけを順に流す

止まり方（1 組の G65 の && と同じにする）：
  1 組の G65 は命令を && でつなぐので、1 つが赤ならその後ろは流れず、段は赤。分けた組も、自分の組の命令を元の並びの順に流し、
  1 つが赤ならその組の残りは流さず赤で終わる。G65 が緑になるのは、どちらの形でも「並びの命令が全部 0 で終わった」ときだけで、
  分けた形が赤を緑にすることは無い（赤の回に、ほかの組の命令が多く流れて赤を多く見せることはある）。
  並びは作り手と同じ部品（gate_cmds.commands・最後は G65_LAST）から作り、分けた組の和は並びとちょうど同じ（足し引き・重なりなし）。
  G65_LAST（k248 の試験・決まり K248-G57-016）は最後の組の最後に置く。
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gate_cmds  # noqa: E402

G65_DIR = Path("scripts/ci/g65.d")
G65_LAST = "python3 scripts/ci/k248_scope_reach_test.py"   # 作り手（05_flow/build_testplan.py）の G65_LAST と同じ（K1307-CI-009 が見る）
MAX_SHARDS = 20   # G65 の命令は 70 本ほど。変数の打ち間違いで台を食いつぶさない上限
OFF = "off"       # SPEC_SHARDS が 1 の回の matrix の印（spec-parts の組は if で飛ぶ。空の matrix は GitHub が赤にするので置く）
# 組を均す重さ（秒）：段の全部の CI（engine-base-ci/wfe-2611 の回 45816366366・2026-11-26）の G65 の中の実測。載っていない命令は DEFAULT_SEC
SECONDS = {
    "python3 scripts/ci/k248_scope_reach_test.py": 370,
    "python3 scripts/ci/k625_layer_ledgers_test.py": 165,
    "python3 scripts/ci/k1121_build_api_d_test.py": 44,
    "python3 scripts/ci/k622_spec_sync_tools_test.py": 33,
    "python3 scripts/ci/k172_ci_shape_test.py": 20,
    "python3 scripts/ci/k626_p_audit_closed_test.py": 18,
    "python3 scripts/ci/k624_d6_mock_only_test.py": 16,
    "python3 scripts/ci/k623_decisions_registered_test.py": 15,
    "python3 scripts/ci/k1304_web_shards_test.py": 13,
    "python3 scripts/ci/k200_staging_health_test.py": 12,
    "python3 scripts/ci/k212_function_region_test.py": 8,
    "python3 scripts/ci/k196_results_on_mainline_test.py": 8,
    "python3 scripts/ci/k237_staging_perf_test.py": 8,
    "python3 scripts/ci/k246_function_config_test.py": 7,
}
DEFAULT_SEC = 2
JUNIT_DIR = "junit"   # G65 の中で JUnit を書く命令の置き場（作業場所からの道）


def shard_count(raw: str) -> int:
    """変数 SPEC_SHARDS の値 → 分ける数。空（変数が無い）は 1。整数で 1〜MAX_SHARDS の外は ValueError（黙って 1 にしない）"""
    raw = (raw or "").strip()
    if not raw:
        return 1
    if not re.fullmatch(r"[0-9]+", raw) or not 1 <= int(raw) <= MAX_SHARDS:   # 全角の数字（１）は通さない
        raise ValueError(f"SPEC_SHARDS は 1〜{MAX_SHARDS} の整数（今の値 {raw!r}）")
    return int(raw)


def parts(n: int) -> list[str]:
    """spec-parts の組の matrix の一覧。1 なら ["off"]（組は飛ぶ）。2 以上なら G57 の 1 組と G65 を n 組"""
    if n == 1:
        return [OFF]
    return ["g57"] + [f"g65-{i}" for i in range(1, n + 1)]


def weight(cmd: str) -> int:
    return SECONDS.get(cmd, DEFAULT_SEC)


def split(cmds: list[str], n: int, last: str = G65_LAST) -> list[list[str]]:
    """並びを n 組に分ける。重い順に、いちばん軽い組へ入れる（同じ重さは前の組）。last は最後の組に置く。
    どの組も元の並びの順を保つ（last は並びの最後なので、その組の最後になる）"""
    if n < 1:
        raise ValueError(f"分ける数 {n} が 1 より小さい")
    if last in cmds and cmds[-1] != last:
        raise ValueError(f"最後に置く命令 {last} が並びの最後に無い")
    loads = [0] * n
    home: dict[int, int] = {}
    order = list(range(len(cmds)))
    if last in cmds:
        home[len(cmds) - 1] = n - 1
        loads[n - 1] += weight(last)
        order = order[:-1]
    for i in sorted(order, key=lambda i: (-weight(cmds[i]), i)):
        k = min(range(n), key=lambda k: (loads[k], k))
        home[i] = k
        loads[k] += weight(cmds[i])
    return [[cmds[i] for i in range(len(cmds)) if home[i] == k] for k in range(n)]


def write_outputs(path: str, n: int) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"spec_shards={n}\nspec_parts={json.dumps(parts(n))}\n")


def part_index(part: str, n: int) -> int:
    """SPEC_PART（g65-<i>）→ i。組の一覧に無ければ ValueError"""
    if part not in parts(n) or not part.startswith("g65-"):
        raise ValueError(f"組 {part!r} は分ける数 {n} の G65 の組（{'・'.join(p for p in parts(n) if p.startswith('g65-')) or 'なし'}）に無い")
    return int(part.split("-", 1)[1])


def run_part(part: str, n: int, directory: Path = G65_DIR, last: str = G65_LAST) -> int:
    """G65 の分けた 1 組：自分の組の命令を元の並びの順に流す。1 つが赤ならその組の残りは流さずその番号で終わる（&& と同じ）"""
    i = part_index(part, n)
    mine = split(gate_cmds.commands(directory, last=last), n, last)[i - 1]
    print(f"G65 の組 {part}（{n} 組のうち {i} 番目）：{len(mine)} 本", flush=True)
    os.makedirs(JUNIT_DIR, exist_ok=True)   # spec の組では前の段「チケットの Python の試験」が作る置き場（k216 の node の試験がここに書く）
    for k, cmd in enumerate(mine):
        print("$ " + cmd, flush=True)
        rc = subprocess.run(shlex.split(cmd)).returncode
        if rc != 0:
            print(f"★ FAIL G65 の組 {part} の命令が赤（終わりの番号 {rc}）：{cmd}。この組の残り {len(mine) - k - 1} 本は流さない"
                  "（1 組の G65 の && と同じ）", flush=True)
            return rc
    return 0


def main() -> int:
    args = sys.argv[1:]
    if args[:1] == ["shards"] and len(args) == 3 and args[1] == "--github-output":
        try:
            n = shard_count(os.environ.get("SPEC_SHARDS_VAR", ""))
        except ValueError as e:
            print(f"★ {e}", flush=True)
            return 1
        write_outputs(args[2], n)
        print(f"spec の重い段の組：{n}（{'・'.join(parts(n))}）", flush=True)
        return 0
    if args == ["g65"]:
        try:
            n = shard_count(os.environ.get("SPEC_SHARDS", ""))
            return run_part(os.environ.get("SPEC_PART", ""), n)
        except (ValueError, gate_cmds.GateListError) as e:
            print(f"★ {e}", flush=True)
            return 1
    print("使い方：spec_run.py shards --github-output <道> ｜ spec_run.py g65（env SPEC_PART・SPEC_SHARDS）", flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main())
