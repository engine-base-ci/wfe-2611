"use client";
// 招待を受けて参加する（/invite/:token・A03・K-335）。見た目は段 3 の部品（views の InviteAccept）。ここは動きだけ。
//   口は契約の口だけ：下見 getInvitation（K-331）・参加 acceptInvitation（K-332）・送り直しを頼む requestInvitationResend（K-334）。
//   開くと下見を 1 回だけ呼び、答えで画面を選ぶ：404 → 見つからない／429 → 少し待って（口の秒）／そのほかの失敗 → 調子が悪い／
//   期限切れ・取り消し・使われた → それぞれの画面／使える → 新しく作って参加（宛てにアカウントがある・ログイン中は K-336 の状態）。
//   参加：201 → 口が返した印を置き、口が返した行き先（付けるまで進めない /mfa-setup）へ。422 → 欄の下に口の文。
//   410・404 → 下見と同じ画面。409 E-INV-006 → ログインして参加。そのほかの失敗 → 画面は移らず赤の知らせ（入れた値は残る）。
//   送り直し：sent → 頼みました／already → 今日はもう頼んである／failed → 期限切れのまま赤の知らせ（押し直せる）。
//   URL の next は読まない（行き先は口の答えだけ・同じ出どころの道だけ・K-259）
import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { CATALOG } from "@kaname/errors/catalog";
import { sameOriginPath } from "@/lib/after-login";
import { call, type CallErr } from "@/lib/api/call";
import { setToken } from "@/lib/api/client";
import { refreshSession } from "@/lib/auth/client";
import { linksOf, useCurrentTerms } from "../../F1/consent-terms/current-terms";
import { AuthLoading } from "../../F1/sign-up/auth-loading";
import {
  INVITE_NOTICE,
  InviteAccept,
  ROLE_LABEL,
  type InviteJoin,
  type InvitePreview,
  type InviteRole,
  type InviteState,
} from "./views";

const SCREEN = "invite-accept";
/** 参加した直後の行き先（口の答えに行き先が無い・外を向いているとき）。付けるまで進めない */
const AFTER_JOIN = "/mfa-setup" as Route;
/** 口が秒を返さなかった送りすぎの待ち（口の上限の窓と同じ 1 分） */
const WAIT_SEC = 60;

type Errors = { name?: string; password?: string };
/** 画面の様子：読んでいる間は null */
interface View {
  state: InviteState;
  preview?: InvitePreview;
  waitSec?: number;
}
type Raw = Record<string, unknown>;

const catalogText = (id: string): string => CATALOG[id as keyof typeof CATALOG]?.message ?? id;
const waitText = (sec: number): string => catalogText("E-LIM-005").replace("{秒}", String(sec));
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const isRole = (v: unknown): v is InviteRole => typeof v === "string" && Object.hasOwn(ROLE_LABEL, v);

/** 期限の日（その人の時計で「M/D」）。読めない日付は空 */
function dayOf(iso: unknown): string {
  const d = new Date(typeof iso === "string" ? iso : Number.NaN);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 下見の答えを画面の言葉にする */
function previewOf(d: Raw): InvitePreview {
  const signed = d["signed_in"] as Raw | null | undefined;
  return {
    workspaceName: str(d["workspace_name"]) ?? "",
    inviterName: str(d["inviter_name"]),
    groupName: str(d["group_name"]),
    role: isRole(d["role"]) ? d["role"] : "member",
    message: str(d["message"]),
    email: str(d["email"]) ?? "",
    expiresOn: dayOf(d["expires_at"]),
    signedInEmail: signed ? str(signed["email"]) : null,
  };
}

/** 使える招待の形：ログイン中（もう入っている → 同じメール → 別のメール）→ 宛てにアカウントがある → 新しく作って参加 */
function usableState(d: Raw): InviteState {
  const signed = d["signed_in"] as Raw | null | undefined;
  if (signed)
    return signed["already_member"] === true ? "member" : signed["email_matches"] === true ? "signed" : "other";
  return d["account_exists"] === true ? "account" : "new";
}

/** 下見の答え（200）→ 画面の様子。知らない状態は調子が悪い（形を決めつけない） */
function viewOfPreview(d: Raw): View {
  const preview = previewOf(d);
  const s = d["state"];
  if (s === "expired" || s === "revoked" || s === "used") return { state: s, preview };
  return s === "ok" ? { state: usableState(d), preview } : { state: "down" };
}

/** 口が断った答え → 下見と同じ画面（無い・取り消し・期限切れ・使われた）。当たらなければ null */
function deadOf(r: CallErr): InviteState | null {
  if (r.status === 404) return "notfound";
  if (r.status !== 410) return null;
  if (r.code === "E-INV-002") return "revoked";
  if (r.code === "E-INV-003") return "expired";
  return r.code === "E-INV-004" ? "used" : null;
}

/** 画面は移らないときの赤の知らせ：送りすぎは待つ秒数の文・止められたワークスペースは口の文・ほかは調子が悪い */
function noticeOf(r: CallErr): string {
  if (r.status === 429) return waitText(r.retryAfterSec ?? WAIT_SEC);
  if (r.status === 403 && r.code === "E-AUTH-012") return r.message ?? catalogText(r.code);
  return INVITE_NOTICE.down;
}

/** 422 の文を欄に分ける（口はいまは誤りを 1 つずつ返す。2 つ返ってきたら 2 つとも出す）。欄が分からなければ null */
function errorsOf(r: CallErr): Errors | null {
  const text = r.message ?? catalogText(r.code);
  const name = r.fields["name"] ?? (r.code === "E-VAL-007" ? text : undefined);
  const password = r.fields["password"] ?? (/^E-VAL-(005|011|026)$/.test(r.code) ? text : undefined);
  if (!name && !password) return null;
  return { ...(name ? { name } : {}), ...(password ? { password } : {}) };
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const links = linksOf(useCurrentTerms());
  const [view, setView] = useState<View | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 二度押しで口を 2 回呼ばない
  const loaded = useRef<string | null>(null); // 下見は開いたときに 1 回だけ（作り直しでも 2 回呼ばない）

  /** 下見を呼んで画面を決める */
  const load = useCallback(async (t: string) => {
    try {
      const r = await call("getInvitation", { params: { token: t }, keepOn401: true, screenId: SCREEN });
      if (loaded.current !== t) return; // 別の招待を開き直した後に届いた答えは捨てる
      if (r.ok) return setView(viewOfPreview((r.data ?? {}) as Raw));
      if (r.status === 404) return setView({ state: "notfound" });
      if (r.status === 429) return setView({ state: "wait", waitSec: r.retryAfterSec ?? WAIT_SEC });
      setView({ state: "down" });
    } catch {
      if (loaded.current === t) setView({ state: "down" }); // 網が切れた（口が答えない）
    }
  }, []);

  useEffect(() => {
    if (!token || loaded.current === token) return;
    loaded.current = token;
    setView(null);
    void load(token);
  }, [token, load]);

  /** 押した口を 1 回だけ呼ぶ。"leave"（ページを移る）なら待ちの形のまま。投げたら（網の切れ）赤の知らせ */
  const run = useCallback(async (send: () => Promise<"stay" | "leave">) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setErrors({});
    setNotice(null);
    let leave = false;
    try {
      leave = (await send()) === "leave";
    } catch {
      setNotice(INVITE_NOTICE.down);
    } finally {
      if (!leave) {
        sending.current = false;
        setBusy(false);
      }
    }
  }, []);

  /** 押した口が断った：下見と同じ画面へ（下見の中身は残す）。当たらなければ false */
  const toDead = (r: CallErr): boolean => {
    const state = deadOf(r);
    if (!state) return false;
    setView((v) => (state === "notfound" ? { state } : { state, ...(v?.preview ? { preview: v.preview } : {}) }));
    return true;
  };

  const onJoin = (v?: InviteJoin) => {
    if (!v) return; // 今のアカウントで参加（引数なし）は K-336
    void run(async () => {
      const r = await call("acceptInvitation", {
        params: { token },
        body: { name: v.name, password: v.password },
        keepOn401: true,
        screenId: SCREEN,
      });
      if (r.ok) {
        const joined = (r.data ?? {}) as Raw;
        const session = str(joined["token"]);
        if (session) {
          setToken(session);
          refreshSession(); // ログインの部品の見え方（セッションの印）にも新しいログインを知らせる
        }
        router.push(session ? sameOriginPath(str(joined["next"]), AFTER_JOIN) : ("/login" as Route));
        return "leave";
      }
      if (toDead(r)) return "stay";
      if (r.status === 409 && r.code === "E-INV-006") {
        setView((x) => (x ? { ...x, state: "account" } : x)); // 下見の後に、宛てのメールでアカウントができた
        return "stay";
      }
      const byField = r.status === 422 ? errorsOf(r) : null;
      if (byField) setErrors(byField);
      else setNotice(noticeOf(r));
      return "stay";
    });
  };

  const onResend = () =>
    void run(async () => {
      const r = await call("requestInvitationResend", {
        params: { token },
        body: {},
        keepOn401: true,
        screenId: SCREEN,
      });
      if (r.ok) {
        const result = (r.data as Raw | undefined)?.["result"];
        if (result === "sent" || result === "already")
          setView((x) => (x ? { ...x, state: result === "sent" ? "resent" : "resent-already" } : x));
        else setNotice(result === "failed" ? INVITE_NOTICE.resendFailed : INVITE_NOTICE.down);
        return "stay";
      }
      if (toDead(r)) return "stay";
      // まだ使える招待だった（409・E-INV-008：期限が延びた など）→ 下見を読み直して今の形を出す
      if (r.status === 409 && r.code === "E-INV-008") await load(token);
      else setNotice(noticeOf(r));
      return "stay";
    });

  if (!view) return <AuthLoading />;
  return (
    <InviteAccept
      state={view.state}
      {...(view.preview ? { preview: view.preview } : {})}
      {...(view.waitSec !== undefined ? { waitSec: view.waitSec } : {})}
      errors={errors}
      notice={notice}
      busy={busy}
      links={links}
      signedLocked
      onJoin={onJoin}
      onResend={onResend}
      loginHref={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
      openHref="/"
    />
  );
}
