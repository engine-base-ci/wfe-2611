# 閉じる道の断片（K-326）

部品（Better Auth）の道を閉じるチケットは、`packages/auth/src/index.ts` の `DISABLED_PATHS` を直さず、ここに自分の番号のファイルを 1 つ置く。

- 名前は `K-<番号>.ts` だけ（ほかの名前は作り手が止める）
- 中身は次の形。なぜ閉じるかを註に 1 行書く

```ts
// <なぜ閉じるか（例：口 POST /api/… が代わりに持つ・K-<番号>）>
export const PATHS = ["/…"] as const;
```

- 置いたら `python3 scripts/ci/gen_ts_registries.py` で `packages/auth/src/disabled-paths.generated.ts` を作り直す
- ほかの断片や `DISABLED_PATHS` の文字の道と同じ道を書くと、作り手が止める（重なりの最後の砦は試験 K326-BIND-008 の「同じ道が 2 つない」）
