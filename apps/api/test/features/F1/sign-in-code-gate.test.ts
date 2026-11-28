// K-305 が受ける「6 けたの口 × 止め（K-303）」の単体の試験（口・本物の DB・本物のログインの部品）。
// 待ちを減らすために K-302 から移した（元 K302-API-023 → K305-API-022・元 K302-API-024 → K305-API-023・2026-11-17）。
// 6 けたの契約の口 verifySignInCode（K-302）と止めの 1 か所 app.login_gate（K-303）の両方が入った後の葉（K-305）で確かめる。
// 名前の頭の行 ID は 11_tickets/K-305.md の表のマスに 1 対 1 で結ぶ。土台・口の形・決めた文は login.harness.ts（K-301 が持ち込む）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { UA_MAC, msg, pendingOf, setupLogin, totp, type User } from "./login.harness.js";

const h = setupLogin("k305g");

const codeOk = async (u: User, pending: string, step = 0, ua = UA_MAC) => {
  const r = await h.verifyCode({ pending, code: totp(u.secret!, step) }, { ua });
  return r;
};
const failures = async (userId: string) =>
  (
    await h.admin.query<{ n: number; until: Date | null }>(
      'select "failedVerificationCount" as n, "lockedUntil" as until from kaname_auth."twoFactor" where "userId" = $1',
      [userId],
    )
  ).rows[0]!;

describe("K-305 が受ける：6 けたの口（K-302）× 止め（K-303）", () => {
  it("K305-API-022 パスワードを通った後・6 けたの前に止められた × 正しい 6 けた：人が止められた（members.suspended_at）は 403・E-AUTH-011、会社が止められた（subscriptions.suspended_at）は 403・E-AUTH-012（文は errors.json）。セッションは増えない（K-303 の止めは 6 けたの後のセッションを作る所でも効く）", async () => {
    const m = await h.makeUser("suspended-member", { twoFactor: true });
    const pm = await pendingOf(h, m);
    const mBefore = await h.liveSessions(m.memberId);
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [m.memberId]);
    const rm = await codeOk(m, pm);
    expect(rm.status, await rm.clone().text()).toBe(403);
    const jm = await h.json(rm);
    expect(jm["code"]).toBe("E-AUTH-011");
    expect(jm["message"]).toBe(msg("E-AUTH-011"));
    expect(jm["data"], "ログインの印を渡さない").toBeUndefined();
    expect(await h.liveSessions(m.memberId)).toBe(mBefore);

    const w = await h.makeUser("suspended-workspace", { twoFactor: true });
    const pw = await pendingOf(h, w);
    const wBefore = await h.liveSessions(w.memberId);
    await h.admin.query(
      "insert into subscriptions (tenant_id, status_id, started_at, suspended_at) values ($1, 'active', now(), now())",
      [w.tenantId],
    );
    const rw = await codeOk(w, pw);
    expect(rw.status, await rw.clone().text()).toBe(403);
    const jw = await h.json(rw);
    expect(jw["code"]).toBe("E-AUTH-012");
    expect(jw["message"]).toBe(msg("E-AUTH-012"));
    expect(await h.liveSessions(w.memberId)).toBe(wBefore);
  });

  it("K305-API-023 止めの確かめが落ちた（app.login_gate の実行の権限を一時的に外す）× 正しい 6 けた：止める側に倒して 503・E-PAGE-003。セッションは増えず、6 けたの失敗の数にも入れない", async () => {
    const u = await h.makeUser("gate-down", { twoFactor: true });
    const p = await pendingOf(h, u);
    const before = await h.liveSessions(u.memberId);
    await h.admin.query("revoke execute on function app.login_gate(text) from kaname_app");
    let r: Response | undefined;
    try {
      await h.captureLogs(async () => {
        r = await codeOk(u, p);
      });
    } finally {
      await h.admin.query("grant execute on function app.login_gate(text) to kaname_app");
    }
    expect(r!.status).toBe(503);
    expect((await h.json(r!))["code"]).toBe("E-PAGE-003");
    expect(await h.liveSessions(u.memberId)).toBe(before);
    expect((await failures(u.userId)).n).toBe(0);
  });
});
