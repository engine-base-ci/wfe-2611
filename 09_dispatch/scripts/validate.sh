#!/usr/bin/env bash
# tickets.json の完全性（JIT ポリシー）＋ テスト・ラダーの両方向整合。CI gate。
set -e; cd "$(dirname "$0")/../.."
P=${PYTHON:-python3}
$P scripts/ci/td_gate.py --flow 05_flow/flow.json --tickets 07_tasks/tickets.json
$P scripts/ci/qa-ladder.py validate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json
