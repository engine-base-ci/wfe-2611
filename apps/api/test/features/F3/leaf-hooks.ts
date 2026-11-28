// 段 4 の PC の口の試験（K-362・K-364・K-365・K-366）が使う手助け（K-364 が持ち込む）。
//   口の登録は葉ごとの hooks のファイル（apps/api/src/hooks/<名>.ts の register・K-326）。共通の土台 fixture.ts は bridgeHooks しか差さないので、
//   試験が要る葉の hooks のファイルを、最初の要求のときに 1 回だけ読んで f.hooks に足す。
//   準備（beforeAll）で読まないのは、実装の前（切る段の smoke）に、まだ無いファイルを準備で読んで準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Fixture } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

/** files（拡張子なしのファイル名・例 "device-browser"）の register を最初の要求の前に f.hooks に足す。f.req も読み終えてから叩く形に包む */
export function leafHooks(f: Fixture, files: readonly string[]): () => Promise<void> {
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of files) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      // PC の口が使う材料は appPool だけ（ほかの欄は使わない）
      Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
    }
  };
  const ready = (): Promise<void> => (loading ??= load());
  const base = f.req;
  f.req = async (method, path, o) => {
    await ready();
    return base(method, path, o);
  };
  return ready;
}
