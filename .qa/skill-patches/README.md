# スキルへの差分（組織のスキルに当てるもの）

Kaname で見つけて、どのプロジェクトでも効くようにスキルへ戻すものの控え。値や秘密は入れない。

| 差分 | 何か | 当て方 |
|---|---|---|
| `skills-ai-driven-process.patch` | AI 駆動の開発の進め方の正本（engineering-rules の `rules/common/ai-driven-process.md`）と、15 のスキルがそれを読む節（D-128.125〜D-128.134）。test-verification のテストの型のナレッジ・チケットの見本、ai-team-delivery の汎用化と 4 つの役を含む | `~/.claude/skills` で `patch -p1 < skills-ai-driven-process.patch`、そのあと `bash ~/.claude/skills/engineering-rules/scripts/install.sh` |
| `test-verification-test-patterns.patch` | テストの型のナレッジだけ（上の差分に含まれる。上を当てるならこちらは要らない） | 上と同じ場所で `patch -p2` |
