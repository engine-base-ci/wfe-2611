// 差し込みの既定（メモリ）。1 プロセスの中でだけ効く。複数プロセスで冪等キーを共有するなら DB の表（ER図に無い＝決定が要る）に置き換える
import { RateLimiter } from "@kaname/actions";
import type { ContractDeps, IdempotencyStore, Limiter } from "./deps.js";

export function memoryLimiters(): (operationId: string, perMinute: number) => Limiter {
  const m = new Map<string, RateLimiter>();
  return (op, perMinute) => {
    const k = `${op}:${perMinute}`;
    let l = m.get(k);
    if (!l) {
      l = new RateLimiter(perMinute);
      m.set(k, l);
    }
    return l;
  };
}
export function memoryIdempotency(max = 10_000): IdempotencyStore {
  const m = new Map<string, { hash: string; status: number; body: unknown }>();
  return {
    get: (k) => m.get(k),
    set: (k, v) => {
      if (m.size >= max) m.delete(m.keys().next().value as string);
      m.set(k, v);
    },
  };
}
export function defaultDeps(o: Partial<ContractDeps> = {}): ContractDeps {
  return { hooks: {}, limiter: memoryLimiters(), idempotency: memoryIdempotency(), ...o };
}
