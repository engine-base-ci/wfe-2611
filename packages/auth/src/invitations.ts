// 招待：作る（権限のある人）→ 受ける（新しい利用者）→ 取り消す（即無効・G-14）。トークンは平文を渡し、DB には sha256 だけ。
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createInvitation(
  repo: Repository,
  ctx: TenantContext,
  input: {
    email: string;
    scopeId?: string | null;
    roleId?: string | null;
    preset?: Record<string, unknown>;
    days?: number;
  },
): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const row = await repo.table("invitations").create(ctx, {
    email: input.email.trim().toLowerCase(),
    scope_id: input.scopeId ?? null,
    role_id: input.roleId ?? null,
    permission_preset: JSON.stringify(input.preset ?? {}),
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + (input.days ?? 7) * 86400e3),
  });
  return { id: String(row["id"]), token };
}

export async function acceptInvitation(
  appPool: pg.Pool,
  token: string,
  authUserId: string,
  displayName: string,
): Promise<string> {
  const r = await appPool.query<{ member_id: string }>("select app.accept_invitation($1, $2, $3) as member_id", [
    hashToken(token),
    authUserId,
    displayName,
  ]);
  return r.rows[0]!.member_id;
}

export async function revokeInvitation(repo: Repository, ctx: TenantContext, id: string): Promise<boolean> {
  const row = await repo.table("invitations").update(ctx, id, { revoked_at: new Date() });
  return row !== null;
}
