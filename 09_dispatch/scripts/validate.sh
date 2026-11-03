#!/usr/bin/env bash
# tickets.json の完全性（JIT ポリシー）＋ テスト・ラダーの両方向整合。CI gate。
set -e; cd "$(dirname "$0")/../.."
P=${PYTHON:-python3}
# 作るもの（画面・API・行為・後回し）が 11_tickets のどれかにある（D-128.117：しまった 07_tasks の td_gate から替えた）
$P scripts/tickets/coverage_gate.py
$P scripts/ci/qa-ladder.py validate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json
