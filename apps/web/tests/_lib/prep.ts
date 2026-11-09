// 中間テストの準備の道具（口の道・K-64 で 1 つにした・K-128 → K-64 の受け持ち）：画面を通さずに、人のログインの印で契約の口を呼んで「PC をつなぐ」「チケットを 1 枚作る」
//   「同じ会社のもう 1 人」を用意する。人そのものは newcomer.ts（画面とメールを通す）、PC そのものは test-pc.ts（本物の Bridge の引き取り）。
//   画面でつなぐ道（K-58 の openConnect・connectByCode）と画面で作る道（K-58 の createTicket）はその試験の筋なので、ここには寄せない。
//   口は網の手前で差し替えない。中間テスト 3（K-64）と統合テスト（K-65）がここを使う。
//   探したが無かった：目録（03_architecture/catalog.json）の共通の処理・apps/web/tests/_lib に、人の印で契約の口を呼んで PC とチケットを用意する道具は無い。
//   似たもの：api.ts の claimBridge（前の道すじの口を直に叩くだけで Bridge の名乗りも通らない）・viewerViaApi（招待で入る人を作るが役は viewer・会社も新しく作る）
import { randomBytes } from "node:crypto";
import { API, PW, admin, agreeCurrentTerms, sha256, uniqEmail } from "./api";
import type { Newcomer } from "./newcomer";
import { testPc, type TestPc } from "./test-pc";

type Body = Record<string, unknown>;

/** 人のログインの印で契約の口を呼ぶ（準備と、画面の外から口を叩く筋だけ）。POST には冪等キーを付ける（契約の入口が求める） */
export async function asPerson(token: string, method: "GET" | "POST", path: string, body?: Body) {
  const r = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "idempotency-key": `prep-${randomBytes(8).toString("hex")}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = (await r.json().catch(() => ({}))) as { data?: Body; code?: string };
  return { status: r.status, data: j.data ?? null, code: j.code ?? null };
}

/** PC をつなぐ（接続コードは口 createPairingCode で出し、引き取りは本物の Bridge の claimCode・最初の知らせ 1 回）。画面でつなぐ道は K-58 が持つ */
export async function pairedPc(token: string, label: string): Promise<TestPc> {
  const c = await asPerson(token, "POST", "/bridge/pairing-codes", {});
  if (c.status !== 201) throw new Error(`接続コードの口が ${c.status}`);
  const pc = testPc(label);
  const got = await pc.enterCode(String(c.data?.["code"]));
  if (!got.ok) throw new Error(`引き取れない：${got.message}`);
  const b = await pc.beat();
  if (b >= 300) throw new Error(`最初の知らせが ${b}`);
  return pc;
}

/** チケットの区画（K-60 の createTicket の sections：区画の鍵 → 本文） */
export interface TicketSections {
  purpose: string;
  done: string;
  /** 実施事項（`- ` の行が項目。完了の小窓のチェックになる・K-63） */
  todo: string;
}

/** チケットを口で 1 枚作る（種類「タスク」・担当は本人・期限は 3 日後）。作る画面は K-60・K-58 が持つ */
export async function ticketOf(me: Newcomer, title: string, sections: TicketSections): Promise<string> {
  const scope = await admin<{ s: string }>("select scope_id as s from members where id = $1", [me.memberId]);
  const kinds = await asPerson(me.token, "GET", "/ticket_kinds");
  const list = (kinds.data as unknown as { id: string; name: string }[] | null) ?? [];
  const kind = list.find((k) => k.name === "タスク");
  if (!kind) throw new Error("チケットの種類「タスク」が無い");
  const jst = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
  const r = await asPerson(me.token, "POST", "/tickets", {
    scope_id: scope[0]!.s,
    kind_id: kind.id,
    title,
    assignee_member_id: me.memberId,
    due_on: jst,
    sections,
  });
  if (r.status !== 201) throw new Error(`チケットを作る口が ${r.status}`);
  return String(r.data?.["id"]);
}

/** 同じ会社のもう 1 人（招待を受けた人・役は member）。画面は使わず、ログインの印だけ返す（その人の PC をつなぐため）。
 *  作り方は api.ts の viewerViaApi と同じ（招待の行を置き、受ける口を通す）。招待の受ける口は前の道すじ（/api/auth-ext）のまま */
export async function teammate(me: Newcomer, name = "同僚"): Promise<{ memberId: string; token: string }> {
  const tenant = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [me.memberId]);
  const token = randomBytes(24).toString("base64url");
  const email = uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, 'member', $3, now() + interval '7 days', $4)",
    [tenant[0]!.t, email, sha256(token), me.memberId],
  );
  const r = await fetch(`${API}/api/auth-ext/invitations/${token}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, password: PW }),
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`招待を受ける口が ${r.status}`);
  const j = (await r.json()) as { data: { token: string } };
  const u = await admin<{ id: string; m: string }>(
    `select u.id, m.id as m from kaname_auth."user" u join members m on m.auth_user_id = u.id where u.email = $1`,
    [email],
  );
  await agreeCurrentTerms(u[0]!.id);
  return { memberId: u[0]!.m, token: j.data.token };
}
