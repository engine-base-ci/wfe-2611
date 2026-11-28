# K-883 検収を作らない（D-155.44）。acceptances は凍結で、どの画面にも出さない。
#   記録した動かし方（learned_procedures・procedure_steps）も db-catalog.json で凍結（後のフェーズ用・D-128.127）。統合の枝で画面の消費が無くなったので、ここで中の表と書く（PM の決め 2026-11-28）
INTERNAL_TABLES = {
    "acceptances": "凍結（K-883・検収を作らない・D-155.44）。口もコードも使わない",
    "learned_procedures": "凍結（後のフェーズ用・D-128.127・db-catalog.json の frozen）。第1フェーズの画面に出さない",
    "procedure_steps": "凍結（後のフェーズ用・D-128.127・db-catalog.json の frozen）。第1フェーズの画面に出さない",
}
