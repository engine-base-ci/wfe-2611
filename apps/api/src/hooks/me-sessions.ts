// 入っている端末の口（K-836）の契約の口：listMySessions・revokeMySession・revokeOtherSessions（D-128.156・D-154.79）。
//   振る舞いの本体は apps/api/src/features/F10/me/sessions.ts。材料の auth は口を呼んだときに初めて触る（make では触らない：
//   k144 の準備が auth なしで make を呼ぶため）
import type { Hook } from "../contract/deps.js";
import {
  createListMySessions,
  createRevokeMySession,
  createRevokeOtherSessions,
  type SessionsDeps,
} from "../features/F10/me/sessions.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function meSessionsHooks(d: HookDeps): Record<string, Hook> {
  const deps: SessionsDeps = {
    appPool: d.appPool,
    get auth() {
      return d.auth;
    },
  };
  return {
    listMySessions: { before: createListMySessions(deps) },
    revokeMySession: { before: createRevokeMySession(deps) },
    revokeOtherSessions: { before: createRevokeOtherSessions(deps) },
  };
}

export const register = defineHooks({
  name: "meSessionsHooks",
  make: (d) => meSessionsHooks(d),
  fuzz: "same",
});
