# spec-sync の検査（Kaname 用に直した版・K-34）

組織のスキル `spec-sync-orchestrator`（assets/scripts）の検査のうち、Kaname の書き方を読めずに走らなかった 4 つを直した写し。
直した版が組織のスキルに入るまで、spec-sync はこのフォルダの版を使う（2026-11-04 高本さん：リポジトリに置き、組織へも）。

| ファイル | 直したこと |
|---|---|
| `tier_d.py` | 決定の追跡の行が、しまった画面の見本（.html）を指すとき、画面の導出物（flow.json）を読む |
| `spec-validator.py`（F） | 地図の下流の検査が `command` で書いてあれば、走らせて終わりのコードで判定する（古い `id_source` の形だけを読んで落ちていた） |
| `tier_g.py` | 境界の検査の `command` を走らせて判定する（「検査が用意されていない」と判定していた） |
| `tier_h.py` | 例外台帳の表の行は、迂回箇所の欄のパス（`packages/auth/` のようなフォルダも）と期限の欄の日付だけを読む。`ファイル#定数` はファイル全体を許さない（理由の欄の経緯の日付を期限と読み違えていた） |

- 組織のスキルへの差分：`.qa/spec-sync/K-34/spec-sync-orchestrator.patch`（スキルの `assets/scripts` で `patch -p1` を当てる）
- `audit-manifest.yaml` は組織のスキルのものをそのまま写した（spec-validator が同じフォルダから読む）

回し方：

```bash
python3 scripts/spec-sync/spec-validator.py --project-root . --tier g   # 境界
python3 scripts/spec-sync/spec-validator.py --project-root . --tier h   # 関門
python3 scripts/spec-sync/spec-validator.py --project-root . --tier d   # 振る舞いの波及（地図の古い所は K-45）
python3 scripts/spec-sync/spec-validator.py --project-root . --tier f   # 下流の分解（地図の古い所は K-45）
```
