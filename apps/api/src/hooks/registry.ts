// 口の登録の型と束ね（K-326）。hooks の各ファイルが `export const register = defineHooks({…})` を持ち、
//   作り手（scripts/ci/gen_ts_registries.py）が一覧 all.generated.ts を作る。本物のサーバーと fuzz の的は、その一覧を buildHooks で束ねて差す。
//   口を足すチケットは自分の hooks のファイルだけを触る（server.ts・fuzz の的に 1 行ずつ足してぶつかるのをやめる）
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import type { Config } from "@kaname/config";
import type { Repository } from "@kaname/db/repository";
import type { ActionGateway } from "@kaname/actions";
import type { ObjectStore } from "@kaname/storage";
import type { Hook } from "../contract/deps.js";

/** メールの送出（関門 C6 の 1 か所・server.ts が署名と返信先を付けて作る） */
export type HookMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;

/** 工場に渡す材料。本物のサーバーと fuzz の的がそれぞれ作る */
export interface HookDeps {
  auth: Auth;
  appPool: pg.Pool;
  authPool: pg.Pool;
  repo: Repository;
  actions: ActionGateway;
  mailer?: HookMailer;
  objects: ObjectStore;
  config: Config;
}

/** fuzz の的での差し方："same"＝本物と同じ make／{ skip: 理由 }＝的から外す／関数＝的だけ違う引数で作る */
export type FuzzPlan = "same" | { skip: string } | ((d: HookDeps) => Record<string, Hook>);

export interface HookModule {
  /** 工場の名前（例 ticketHooks）。重なりの知らせに出す */
  name: string;
  make: (d: HookDeps) => Record<string, Hook>;
  fuzz: FuzzPlan;
  /** ほかの module も持つ口を、わざとこちらで差し替える（並びに頼らない） */
  replaces?: readonly string[];
}

export function defineHooks(m: HookModule): HookModule {
  return m;
}

function produce(m: HookModule, d: HookDeps, mode: "server" | "fuzz"): Record<string, Hook> | null {
  if (mode === "server" || m.fuzz === "same") return m.make(d);
  if (typeof m.fuzz === "function") return m.fuzz(d);
  return null; // { skip }：的から外す（make も呼ばない）
}

/** 一覧の口を 1 つに束ねる。同じ口を 2 つが持てば止める（ちょうど片方が replaces に書いていれば、その側が持つ） */
export function buildHooks(mods: readonly HookModule[], d: HookDeps, mode: "server" | "fuzz"): Record<string, Hook> {
  const owner = new Map<string, { mod: HookModule; hook: Hook }>();
  const replaced = new Set<string>();
  for (const mod of mods) {
    const made = produce(mod, d, mode);
    if (!made) continue;
    for (const [key, hook] of Object.entries(made)) {
      const prev = owner.get(key);
      if (!prev) {
        owner.set(key, { mod, hook });
        continue;
      }
      const mine = (mod.replaces ?? []).includes(key);
      const theirs = (prev.mod.replaces ?? []).includes(key);
      if (mine === theirs) throw new Error(`${key} を ${prev.mod.name} と ${mod.name} の両方が持つ`);
      replaced.add(key);
      if (mine) owner.set(key, { mod, hook });
    }
  }
  for (const mod of mods) {
    for (const key of mod.replaces ?? []) {
      if (!replaced.has(key) && owner.get(key)?.mod === mod)
        throw new Error(`replaces の ${key} に差し替える相手が無い（${mod.name}）`);
    }
  }
  return Object.fromEntries([...owner].map(([k, v]) => [k, v.hook]));
}
