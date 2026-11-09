// PC をつなぐ（K-57）の契約の口の振る舞い。前の道すじ（/api/auth-ext/bridge/pair・claim・heartbeat・latest・download・file）の中身をここへ移した。
//   createPairingCode（本人）→ 画面に出す接続コード（10 分・1 回だけ・前のコードは使えなくなる）
//   claimPairingCode（PC。まだ印が無い・コードそのものが鍵・1 分 5 回）→ PC の印を 1 回だけ返す
//   sendHeartbeat（PC の印）→ 最後に見えた時刻・自己診断・版。古い Bridge には「古い」を足す（E-CONN-012）
//   listMyDevices（本人）→ 自分の PC（アカウント全体・D-128.137）。印もハッシュも返さない
//   getLatestBridgeRelease・downloadBridgeRelease（本人か PC の印）→ 配布物（D-015・D-109）
// DB に書くのは関門 C2 の関数（app.bridge_code_new・app.bridge_code_claim・app.bridge_beat）だけ。ログに接続コードと PC の印を出さない
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { ObjectStore } from "@kaname/storage";
import type { TenantContext } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import {
  isListed,
  legacyInstaller,
  pickInstaller,
  pickUpdate,
  releaseFileResponse,
  releaseState,
} from "../../../auth/bridge-release.js";
import { cleanLabel, newCode, newDeviceToken, normalizeCode, normalizeMachineId, sha256 } from "./code.js";

/** この版より古い Bridge には仕事を渡さない（apps/bridge/src/loop.ts の BRIDGE_PROTOCOL と揃える） */
export const BRIDGE_PROTOCOL_MIN = 4;
/** 古い Bridge のとき、自己診断に足す 1 行（画面は fix=update を見て入れ直しを案内する・E-CONN-012） */
export const OUTDATED_CHECK = {
  name: "Bridge が新しい",
  ok: false,
  detail: "この PC の Bridge が古いので、自分のAI に仕事を渡せません。Bridge を入れ直してください",
  fix: "update",
  code: "E-CONN-012",
};
/** 自己診断の行は 50 まで（大きすぎる知らせで行を膨らませない） */
const HEALTH_MAX = 50;
/** 自己診断の 1 行の文字の上限（名前・説明・直し方・エラーの ID） */
const CHECK_TEXT_MAX = { name: 80, detail: 500, fix: 40, code: 20 } as const;
/** 自己診断の 1 行は name・ok・detail・fix・code だけを、文字（ok は真偽）にして長さで切って残す。ほかの欄・入れ子・名前の無い行は捨てる */
function cleanCheck(x: unknown): { name: string; ok: boolean; detail?: string; fix?: string; code?: string } | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? [...v].slice(0, max).join("") : undefined);
  const name = text(o["name"], CHECK_TEXT_MAX.name);
  if (!name || typeof o["ok"] !== "boolean") return null;
  const out: { name: string; ok: boolean; detail?: string; fix?: string; code?: string } = { name, ok: o["ok"] };
  for (const k of ["detail", "fix", "code"] as const) {
    const v = text(o[k], CHECK_TEXT_MAX[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export interface ConnectPcDeps {
  appPool: pg.Pool;
  /** 配布物の置き場（設定の BRIDGE_RELEASE_DIR・BRIDGE_RELEASE_BASE） */
  release: { dir: string; base: string };
  /** 外の置き場の署名 URL を出す関門 C4（packages/storage・D-128.153） */
  objects: Pick<ObjectStore, "signExternal">;
}

const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
const fromCatalog = (code: string, extra: Record<string, unknown> = {}): HookReply => {
  const e = new KanameError(code);
  return { status: e.status, body: { ...e.toJSON(), ...extra } };
};
const OS = new Set(["mac", "win"]);
const ARCH = new Set(["arm64", "x64"]);

export function connectPcHooks(d: ConnectPcDeps): Record<string, Hook> {
  /** 外の置き場のファイルの期限つき URL（関門 C4 が置き場の仕組みで作る・D-128.153・D-128.160）。
   *  作れない（置き場の口が無い）は E-PAGE-007、渡せない名前は null（呼び手が 404 にする） */
  const signed = async (ctx: TenantContext, name: string) => {
    const s = await d.objects.signExternal(ctx, d.release.base, name);
    if (s.status === "done") return { ok: true as const, url: s.value.url, expiresAt: s.value.expiresAt };
    return { ok: false as const, reply: s.status === "failed" ? fromCatalog("E-PAGE-007") : null };
  };
  /** 新しい版の中身の受け取り先：手元のフォルダなら Kaname の口、外の置き場なら期限つき URL */
  const fileUrl = async (ctx: TenantContext, from: "dir" | "base", name: string) => {
    if (from === "dir") return { ok: true as const, url: `/api/v1/bridge/releases/${encodeURIComponent(name)}/file` };
    return signed(ctx, name);
  };
  /** 配布物を渡す。手元のフォルダならファイルをそのまま流す。外の置き場なら短い期限の URL を 200 で返す（D-128.153。302 の転送はしない） */
  const give = async (ctx: TenantContext, from: "dir" | "base", name: string): Promise<HookReply | null> => {
    if (from === "base") {
      const s = await signed(ctx, name);
      if (!s.ok) return s.reply;
      return { status: 200, body: { data: { url: s.url, expires_at: s.expiresAt.toISOString() } } };
    }
    const r = releaseFileResponse(d.release.dir, name);
    return r ? { status: 200, body: null, raw: r } : null;
  };

  return {
    createPairingCode: {
      before: async (a: HookArgs) => {
        const code = newCode();
        let r: { rows: { exp: Date }[] };
        try {
          r = await d.appPool.query<{ exp: Date }>("select app.bridge_code_new($1, $2, $3) as exp", [
            a.ctx.tenantId,
            a.ctx.userId,
            sha256(code),
          ]);
        } catch (e) {
          // セッションの人がその会社のメンバーでない（DB の app.people_same_tenant が 22023）：コードを作らず 403（K-144 ㉔）。
          //   答えに DB の文を出さない（D-130.2）。ほかの失敗はそのまま上げる
          if ((e as { code?: string }).code !== "22023") throw e;
          console.error("[bridge] 接続コードを作れなかった（その会社のメンバーでない・22023）");
          return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
        }
        return { status: 201, body: { data: { code, expires_at: new Date(r.rows[0]!.exp).toISOString() } } };
      },
    },
    claimPairingCode: {
      noIdempotency: true, // 答えに PC の印が入る。器に残さない
      before: async (a: HookArgs) => {
        const c = normalizeCode(a.input["code"]);
        if (!c.ok) return invalid("code", c.message);
        const m = normalizeMachineId(a.input["machine_id"]);
        if (!m.ok) return invalid("machine_id", m.message);
        const label = cleanLabel(a.input["device_label"]);
        const token = newDeviceToken();
        // 同じ人の同じ PC の印（machine_id）の生きている行だけを切る。名前では見分けない・印が無ければ何も切らない（D-128.174）
        const r = await d.appPool.query<{ session_id: string; member_id: string }>(
          "select * from app.bridge_code_claim($1, $2, $3, $4::uuid)",
          [sha256(c.code), label, sha256(token), m.machineId],
        );
        const row = r.rows[0];
        // 違う・期限切れ・使い終わり・出し直した前のコードは、同じ返事（どれかを見分けさせない・D-089）
        if (!row) return fromCatalog("E-CONN-013", { field: "code" });
        return {
          status: 201,
          body: {
            data: { device_token: token, device_id: row.session_id, member_id: row.member_id, device_label: label },
          },
        };
      },
    },
    sendHeartbeat: {
      before: async (a: HookArgs) => {
        const sid = a.ctx.sessionId;
        if (!sid) return { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
        const outdated = !(Number(a.input["protocol"]) >= BRIDGE_PROTOCOL_MIN);
        const raw = a.input["health"];
        const health = Array.isArray(raw)
          ? raw
              .map(cleanCheck)
              .filter((x) => x !== null)
              .slice(0, HEALTH_MAX)
          : [];
        const withVersion = outdated ? [...health, OUTDATED_CHECK] : health;
        const version = typeof a.input["version"] === "string" ? a.input["version"].slice(0, 40) : null;
        const ok = await d.appPool.query<{ ok: boolean }>("select app.bridge_beat($1, $2::jsonb, $3) as ok", [
          sid,
          raw === undefined && !outdated ? null : JSON.stringify(withVersion),
          version,
        ]);
        if (!ok.rows[0]?.ok) return { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
        const br = await d.appPool.query<{ b: string | null }>("select app.bridge_browser($1) as b", [sid]);
        return { status: 201, body: { data: { ok: true, browser: br.rows[0]?.b ?? null, outdated } } };
      },
    },
    listMyDevices: {
      before: async (a: HookArgs) => {
        const r = await d.appPool.query<{ v: unknown[] }>("select app.bridge_devices($1) as v", [a.ctx.userId]);
        const data = r.rows[0]?.v ?? [];
        return { status: 200, body: { data, meta: { limit: data.length } } };
      },
    },
    getLatestBridgeRelease: {
      before: async (a: HookArgs) => {
        const s = await releaseState(d.release);
        if (s.state === "unreachable") return fromCatalog("E-PAGE-007");
        if (s.state === "none") return { status: 200, body: { data: { released: false } } };
        const os = a.c.req.query("os") ?? "";
        const arch = a.c.req.query("arch") ?? "";
        const f = OS.has(os) && ARCH.has(arch) ? pickUpdate(s.m, os as "mac" | "win", arch as "arm64" | "x64") : null;
        const link = f ? await fileUrl(a.ctx, s.from, f.name) : null;
        if (link && !link.ok && link.reply) return link.reply;
        return {
          status: 200,
          body: {
            data: {
              released: true,
              version: s.m.version,
              released_at: s.m.released_at,
              update: f && link?.ok ? { name: f.name, url: link.url, sha256: f.sha256, size: f.size } : null,
            },
          },
        };
      },
    },
    downloadBridgeRelease: {
      before: async (a: HookArgs) => {
        const name = a.c.req.param("name") ?? "";
        const s = await releaseState(d.release);
        if (s.state === "unreachable") return fromCatalog("E-PAGE-007");
        if (OS.has(name)) {
          // 人が受け取るインストーラ（目録にあれば目録のもの。目録にあるのにファイルが無ければ前の探し方に落とす）
          const inst = s.state === "ok" ? pickInstaller(s.m, name as "mac" | "win") : null;
          const viaManifest = s.state === "ok" && inst ? await give(a.ctx, s.from, inst.name) : null;
          if (viaManifest) return viaManifest;
          const legacy = legacyInstaller(d.release.dir, name as "mac" | "win");
          const viaDir = legacy ? await give(a.ctx, "dir", legacy) : null;
          return viaDir ?? fromCatalog("E-CONN-014");
        }
        if (/^[a-z]+$/.test(name)) return invalid("name", "mac か win を指定してください");
        // 自分で入れ替える中身：目録に載った名前だけ（名前で置き場の外を指させない）
        const f = s.state === "ok" ? isListed(s.m, name) : null;
        const out = f && s.state === "ok" ? await give(a.ctx, s.from, f.name) : null;
        return out ?? { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
      },
    },
  };
}
