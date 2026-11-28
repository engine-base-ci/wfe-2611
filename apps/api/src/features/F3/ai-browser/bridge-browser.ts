// K-366 Bridge の窓でも AI が使うブラウザを選び直せる口（setBridgeBrowser・POST /api/v1/bridge/browser・PC の印・体は { browser } だけ）。
//   Kaname が正本で、画面（updateMyDevice・K-364）で変えたのと同じ値（sessions.browser）が変わる（D-120・代表の答え answer=0a262be577b2 ②）。
//   上限（1 分に 60 回）・PC の印の解決（無い・知らない・外した印は 401）・人のログインで呼ぶ（403）・体の形（strict・NFKC と前後の空白を落とす）は契約の入口が先に確かめる。
//   PC の印で呼ぶので、書くのはその PC 自身の行だけ（ctx.sessionId）。体に別の PC の id を入れても受けない（strict で 422）。
//   前の道すじ /api/auth-ext/bridge/browser（apps/api/src/auth/ext.ts）の中身（app.bridge_set_browser・0057）を移した。前の道すじを消すのは K-367。
//   DB の失敗は 503・E-PAGE-003（1 つの update なので半分だけ書いた形は無い）。ログに PC の id・印・DB の文を出さない
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { BROWSER_REJECTED_MESSAGE, deviceBrowserOf } from "./pick.js";

const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const browserRejected: HookReply = {
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "browser", message: BROWSER_REJECTED_MESSAGE }],
  },
};

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export function createSetBridgeBrowser(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const sid = a.ctx.sessionId;
    if (!sid) return unauthenticated;
    const browser = deviceBrowserOf(a.input["browser"]);
    if (browser === null) return browserRejected;
    let ok: boolean;
    try {
      const r = await appPool.query<{ ok: boolean }>("select app.bridge_set_browser($1, $2) as ok", [sid, browser]);
      ok = r.rows[0]?.ok === true;
    } catch (e) {
      console.error(`[ai-browser] 窓からの選び直しを書けなかった（${kindOf(e)}）`);
      return { status: 503, body: new KanameError("E-PAGE-003").toJSON() };
    }
    // 外した直後など、その PC の行がもう使えない：Bridge は印を捨ててつなぎ直す（K-57 の生きている知らせと同じ 401）
    if (!ok) return unauthenticated;
    return { status: 201, body: { data: { browser } } };
  };
}
