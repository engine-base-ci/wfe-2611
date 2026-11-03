// 契約どおりの route を組み立てるための差し込み口。個別の振る舞い（関門を通す副作用）は hooks に書く
import type { Context } from "hono";
import type { TenantContext } from "@kaname/db/context";
import type { Repository, Row } from "@kaname/db/repository";
import type { EndpointDef } from "@kaname/contracts";

export interface HookArgs {
  e: EndpointDef;
  ctx: TenantContext;
  repo: Repository;
  input: Row; // 検証・正規化済みの入力（create／update）
  id: string | null; // path の :id
  c: Context;
  /** 条件つきの本人確認（取り消せない承認・管理者として招く など・D-125.139）。直前 15 分以内でなければ 403 の応答を返す */
  requireStepUp?: () => HookReply | void;
}
export type HookReply = { status: number; body: unknown };
export type EffectResult =
  { status: "done"; value?: unknown } | { status: "denied" | "failed"; reason: string; handoff: string };
export interface Hook {
  /** 認可の後・副作用の前：ポリシー判定・承認の確認。応答を返せば処理を止める（403 等） */
  before?: (a: HookArgs) => Promise<HookReply | void>;
  /** 外向きの副作用（関門 C1／C3〜C8 を通す）。記録（DB）の前。失敗なら 502（記録しない＝副作用の順序） */
  effect?: (a: HookArgs) => Promise<EffectResult>;
  /** 記録の後（通知など。失敗しても応答は返す） */
  after?: (a: HookArgs, row: Row | Row[]) => Promise<void>;
}
export interface Limiter {
  take(key: string): boolean;
}
export interface IdempotencyStore {
  get(key: string): { hash: string; status: number; body: unknown } | undefined;
  set(key: string, v: { hash: string; status: number; body: unknown }): void;
}
export interface ContractDeps {
  hooks: Record<string, Hook>;
  /** operationId ごとの上限（既定は契約の rate_limit） */
  limiter: (operationId: string, perMinute: number) => Limiter;
  idempotency: IdempotencyStore;
  /** テストや運用で上限を差し替える（operationId → perMinute） */
  limits?: Record<string, number>;
}
