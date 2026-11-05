"use client";
// 登録の画面（K-51・A01・キャンバスの AuthSignup）。メール・名前・会社・チームの名前（空でよい）・パスワードを入れて「次へ」。
//   ここでは本人も会社も作らない。保留の申し込みができ、確認のメールが 1 通届き、待つ画面へ進む（確定はメールのリンク・K-52）。
//   同意は画面の中（続けると利用規約とプライバシーに同意したことになる・D-128.137）。
//   入力の確かめはこの画面でもする（ブラウザ標準の検証は使わない＝ noValidate。文言は正本 errors.json）。サーバーが最後の砦
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, Callout, PasswordField, TextField, PAGE_ERROR, errorText } from "@/components/k";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { pendingRoute } from "@/lib/pending-route";
import { AuthFrame, PRIVACY_HREF, TERMS_HREF } from "./frame";
import { readDraft, saveDraft, saveTicket } from "./store";
import { waitText } from "./wait-text";

const NAME_MAX = 100;
const COMPANY_MAX = 100;
const PASSWORD_MIN = 12;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const msg = (code: string): string => CATALOG[code]?.message ?? code;

type Field = "email" | "name" | "company_name" | "password";
type Errors = Partial<Record<Field, string>>;
type Banner = { kind: "registered" } | { kind: "wait"; sec: number } | { kind: "failed"; code: string } | null;

/** 表記ゆらぎを直したメール（全角・前後の空白・大文字）。途中の空白は打ち間違いなので残す（形の確かめで止める） */
const tidyEmail = (v: string): string => v.normalize("NFKC").trim().toLowerCase();

function check(v: { email: string; name: string; company: string; password: string }): Errors {
  const e: Errors = {};
  const email = tidyEmail(v.email);
  if (!EMAIL_RE.test(email)) e.email = msg("E-VAL-004");
  const name = v.name.normalize("NFKC").trim();
  if (!name || [...name].length > NAME_MAX) e.name = msg("E-VAL-010");
  if ([...v.company.normalize("NFKC").trim()].length > COMPANY_MAX) e.company_name = msg("E-VAL-016");
  if ([...v.password].length < PASSWORD_MIN) e.password = msg("E-VAL-005");
  return e;
}

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  // ログイン中の人には登録させず、今のアカウントの画面へ移す。鍵が切れていれば（401）ふつうに登録の画面を出す
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setEmail(d.email);
      setName(d.name);
      setCompany(d.company);
    }
    if (!getToken()) {
      setChecking(false);
      return;
    }
    let alive = true;
    void call("getMe", { keepOn401: true, screenId: "signup" })
      .then((r) => {
        if (!alive) return;
        if (r.ok) router.replace(pendingRoute("/tickets", "K-60"));
        else setChecking(false);
      })
      .catch(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [router]);

  // 書きかけを残す（送っている途中で再読み込みしても消えない）。パスワードは残さない
  useEffect(() => {
    if (!checking) saveDraft({ email, name, company });
  }, [email, name, company, checking]);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (sending.current) return; // 2 回押し：申し込みは 1 つ・メールは 1 通
    setBanner(null);
    const found = check({ email, name, company, password });
    setErrors(found);
    if (Object.keys(found).length) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("createSignup", {
        body: { email: tidyEmail(email), name, company_name: company, password },
        screenId: "signup",
        keepOn401: true,
      });
      if (r.ok) {
        saveTicket({
          token: r.data.signup_token ?? "",
          email: r.data.email ?? tidyEmail(email),
          sent: r.data.sent === true,
          mailError: r.data.mail_error ?? null,
        });
        // 待つ画面は登録の画面と入れ替える（戻る・進む・再読み込みをまたいでも、待つ画面がほかの画面の中身にならない）。
        // メールを直したいときは待つ画面の「入力し直す」から戻る（書きかけはパスワードのほかは残っている）
        router.replace("/verify-email");
        return;
      }
      if (r.status === 409) setBanner({ kind: "registered" });
      else if (r.status === 429) setBanner({ kind: "wait", sec: r.retryAfterSec ?? 60 });
      else if (r.status === 422 && Object.keys(r.fields).length) setErrors(r.fields as Errors);
      else setBanner({ kind: "failed", code: r.status >= 500 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed });
    } catch {
      setBanner({ kind: "failed", code: PAGE_ERROR.loadFailed });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (checking) return <AuthFrame>{null}</AuthFrame>;
  return (
    <AuthFrame>
      <h1>アカウントを作る</h1>
      <p className="k-auth-lead">登録したらすぐ使い始められる。設定の段はない</p>
      {banner?.kind === "registered" ? (
        <Callout tone="warn">
          <span>{msg("E-CONF-001")}</span>
          <br />
          <Link href="/login">ログイン</Link> ・ <Link href="/password-reset">パスワードの再設定</Link>
        </Callout>
      ) : null}
      {banner?.kind === "wait" ? <Callout tone="danger">{waitText(banner.sec)}</Callout> : null}
      {banner?.kind === "failed" ? <Callout tone="danger">{errorText(banner.code).entry.message}</Callout> : null}
      <form className="k-auth-form" onSubmit={submit} noValidate>
        <TextField
          label="メール"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="名前"
          name="name"
          autoComplete="name"
          placeholder="例：高本 聖斗"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          label="会社・チームの名前"
          name="company_name"
          autoComplete="organization"
          placeholder="例：株式会社ENGINE BASE"
          description="空なら、あなたの名前で個人のワークスペースになる。あとで人を招ける"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          error={errors.company_name}
        />
        <PasswordField
          label="パスワード"
          name="password"
          autoComplete="new-password"
          description="12 文字以上。漏れたことのあるパスワードは使えない"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" loading={busy}>
          次へ（メールを確かめる）
        </Button>
      </form>
      <p className="k-auth-note">
        続けると{" "}
        <Link href={TERMS_HREF} target="_blank" rel="noopener">
          利用規約
        </Link>{" "}
        と{" "}
        <Link href={PRIVACY_HREF} target="_blank" rel="noopener">
          プライバシー
        </Link>{" "}
        に同意したことになる
      </p>
      <p className="k-auth-alt">
        アカウントがある方は <Link href="/login">ログイン</Link>
      </p>
    </AuthFrame>
  );
}
