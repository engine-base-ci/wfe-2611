"use client";
// ログイン情報を預ける（T-U-10・A10）。状態：預けたもの（n）／追加する（a）／入力（i）／空（ge）／運用中（s）。平文は関門 C8 で暗号化、AI には参照 ID だけ
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, Field, Input, Section, Table, Td, Th, Pill } from "@/components/ui";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { RequireRole } from "@/lib/auth/role";
import {
  AuthExtError,
  answerCredential,
  myCredentials,
  retryLoginCheck,
  storeCredential,
  type LoginCheckState,
  type MyCredential,
  type TwoFactorKind,
  type Verdict,
} from "@/lib/auth/ext";
import { useMarkStep } from "@/lib/onboarding";
import { Ban, Check, KeyRound, Lock, Plus, ShieldCheck } from "lucide-react";

export default function CredentialsPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="ログイン情報を預ける" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <RequireRole screen="credentials">
        <Credentials />
      </RequireRole>
    </RequireSession>
  );
}
function Credentials() {
  // 預けたものは API から読む（D-108.3）。中身は返らない（サービス名・台帳の可否・状態・預かり先の番号の頭だけ）
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["my-credentials"],
    queryFn: myCredentials,
    // 預けた直後は Bridge が 1 回ログインを試している（D-117.1）。終わるまで 2 秒ごとに読み直す
    // コードを頼まれている間（asking）も読み直す：答えたら行が進む
    refetchInterval: (q) =>
      (q.state.data ?? []).some(
        (r) => r.asking || (r.login_check && ["pending", "running"].includes(r.login_check.state)),
      )
        ? 2000
        : false,
  });
  const rows = list.data ?? [];
  const [state, setState] = useState<"a" | "i">("a");
  const [service, setService] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [twoFactor, setTwoFactor] = useState<TwoFactorKind>("none");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const markStep = useMarkStep();
  const focusService = () => document.querySelector<HTMLInputElement>("[data-service-input]")?.focus();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await storeCredential({
        service_name: service.normalize("NFKC").trim(),
        login,
        password,
        two_factor: twoFactor,
        ...(twoFactor === "totp" && totp ? { totp_secret: totp } : {}),
      });
      await qc.invalidateQueries({ queryKey: ["my-credentials"] });
      setService("");
      setLogin("");
      setPassword("");
      setTotp("");
      setTwoFactor("none");
      setState("a");
      await markStep(4); // 段 4 を通した（D-089）
    } catch (err) {
      setMsg(err instanceof AuthExtError ? err.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };
  const addPanel =
    state === "a" ? (
      <Section title="追加する" className="border-t" data-state="a">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = service.normalize("NFKC").replace(/\s+/g, " ").trim(); // 境界で正規化（全角・空白）
            if (v) {
              setService(v);
              setMsg(null);
              setState("i");
            } else setMsg("サービス名を入れてください");
          }}
          noValidate
        >
          <Field label="サービス" error={msg ?? undefined}>
            {(id) => (
              <Input
                id={id}
                data-service-input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="サービス名か URL を入れる"
              />
            )}
          </Field>
          <div className="mb-4 rounded-r-[var(--r-md)] border-l-[3px] border-[var(--tertiary)] bg-[var(--tertiary-c)] px-3.5 py-3 text-[13px] leading-[1.75] text-[var(--on-tertiary-c)]">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold">
              <ShieldCheck className="size-4" aria-hidden />
              サービス台帳の判定
            </div>
            入力すると、そのサービスの利用規約から <b>自動操作の可否</b>{" "}
            を判定して出します。禁止のサービスは、預けても操作しません。
          </div>
          {/* 段を進むボタン（下の帯）と紛らわしくしない。押すと、ログイン名・パスワードを入れる欄へ（D-116） */}
          <Button type="submit" className="w-full">
            ログイン情報を入れる
          </Button>
        </form>
      </Section>
    ) : (
      <Section title={`${service} のログイン情報`} className="border-t" data-state="i">
        <p className="mb-4 rounded-[var(--r-md)] bg-[var(--primary-c)] px-3.5 py-3 text-[13px] leading-[1.75] text-[var(--on-primary-c)]">
          ここに入れた値は、<b>この画面を閉じた後は誰にも表示されません</b>。あなたにも、自分のAIにも。
        </p>
        <form onSubmit={save} noValidate>
          <Field label="メールアドレス（ログイン名）">
            {(id) => <Input id={id} autoComplete="off" value={login} onChange={(e) => setLogin(e.target.value)} />}
          </Field>
          <Field label="パスワード" error={msg ?? undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={!!msg}
              />
            )}
          </Field>
          {/* 2 段階認証の種類（D-117.2）。認証アプリは鍵を預かって Bridge が 6 桁を作る。SMS・メール・スマホ承認はその場で本人に頼む */}
          <Field label="2段階認証" help={TWO_FACTOR_HELP[twoFactor]}>
            {(id) => (
              <select
                id={id}
                data-two-factor
                value={twoFactor}
                onChange={(e) => setTwoFactor(e.target.value as TwoFactorKind)}
                className="w-full rounded-[var(--r-md)] border border-transparent bg-[var(--sv)] px-[13px] py-2.5 text-[16px] text-[var(--on-surface)] focus:bg-[var(--card)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--primary)] md:text-[14px]"
              >
                {TWO_FACTOR_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {twoFactor === "totp" ? (
            <Field label="認証アプリの秘密鍵" help="認証アプリの登録時に出る文字列。Bridge が6桁を生成します">
              {(id) => <Input id={id} autoComplete="off" value={totp} onChange={(e) => setTotp(e.target.value)} />}
            </Field>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" icon={<Check />} disabled={busy}>
              保存する
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setState("a");
                setMsg(null);
              }}
            >
              やめる
            </Button>
          </div>
        </form>
      </Section>
    );
  return (
    <WizardLayout
      title="ログイン情報を預ける"
      purpose="AI社員が使う外部サービスのログイン情報を、暗号化して預けます。AIには一切見せません。"
      existing={WIZARD_EXISTING}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          {list.isPending ? (
            <p className="text-[13.5px] text-[var(--on-sv)]">読んでいます</p>
          ) : list.isError ? (
            <p className="text-[13.5px]" role="alert">
              預けたものを読めませんでした（{list.error instanceof Error ? list.error.message : "理由は分かりません"}）
            </p>
          ) : rows.length === 0 ? (
            <div data-state="ge">
              <Empty
                icon={<KeyRound />}
                title="まだ資格情報がありません"
                action={<Button onClick={focusService}>追加する</Button>}
              >
                使う外部サービスの資格情報を暗号化して預ける。AIには一切見せない。最初の 1 件が入るとここに並びます。
              </Empty>
            </div>
          ) : (
            <div data-state="n">
              <Section
                title="預けたもの"
                aside={
                  <>
                    <span className="num mr-auto text-[12px] text-[var(--on-sv)]">{rows.length}件</span>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Plus />}
                      onClick={() => {
                        setState("a");
                        setTimeout(focusService, 0);
                      }}
                    >
                      追加する
                    </Button>
                  </>
                }
              >
                <Table>
                  <thead>
                    <tr>
                      <Th>サービス</Th>
                      <Th>自動操作</Th>
                      <Th>状態</Th>
                      <Th>1 回のログイン</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} data-credential={r.id}>
                        <Td>
                          <b>{r.service_name}</b>
                          {r.service_domain ? (
                            <div className="text-[12px] text-[var(--on-sv)]">{r.service_domain}</div>
                          ) : null}
                        </Td>
                        <Td>
                          <Pill tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Pill>
                        </Td>
                        <Td>
                          <Pill tone="neutral">
                            {r.state === "revoked" ? <Ban /> : r.state === "connected" ? <Check /> : <KeyRound />}
                            {r.state === "revoked"
                              ? "取り消した"
                              : r.state === "connected"
                                ? "連携済み"
                                : `預けた · 預かり先の番号 …${r.ref_tail}`}
                          </Pill>
                        </Td>
                        <Td>
                          <LoginCheckCell c={r} />
                          <AskCell c={r} onDone={() => qc.invalidateQueries({ queryKey: ["my-credentials"] })} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Section>
            </div>
          )}
          <Section className="border-t">
            <h2 className="mb-3.5 flex items-center gap-2 text-h2 font-bold">
              <Lock className="size-5" aria-hidden />
              ここに預けたものの扱い
            </h2>
            <div className="flex flex-col gap-2 text-[13.5px]">
              {HANDLING.map((x) => (
                <div
                  key={x}
                  className="flex items-center gap-2.5 rounded-[var(--r-md)] bg-[var(--surface)] px-3 py-2.5"
                >
                  <Check className="size-4 shrink-0 text-[var(--st-success)]" aria-hidden />
                  <span>{x}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
        <div>{addPanel}</div>
      </div>
    </WizardLayout>
  );
}
// 2 段階認証の種類（D-117.2）
const TWO_FACTOR_OPTIONS: [TwoFactorKind, string][] = [
  ["none", "なし"],
  ["totp", "認証アプリ（Google Authenticator など）"],
  ["sms", "SMS で届くコード"],
  ["email", "メールで届くコード"],
  ["push", "スマホで承認"],
];
const TWO_FACTOR_HELP: Record<TwoFactorKind, string> = {
  none: "ログインに 2 段階認証が無いサービス",
  totp: "鍵を預かり、Bridge が 6 桁を作って入れます。あなたに頼みません",
  sms: "ログインのたびに、届いたコードをこの画面で入れてもらいます（AI には渡りません）",
  email: "ログインのたびに、届いたコードをこの画面で入れてもらいます（AI には渡りません）",
  push: "ログインのたびに、スマホで承認してからこの画面で知らせてもらいます",
};
// いま本人に頼んでいること（D-117.3）：コードを入れる／スマホで承認した。コードは Bridge が取った時点で消える
function AskCell({ c, onDone }: { c: MyCredential; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!c.asking) return null;
  const send = async (b: { code?: string; approved?: boolean }) => {
    setBusy(true);
    setErr(null);
    try {
      await answerCredential(c.id, { request_id: c.asking!.request_id, ...b });
      setCode("");
      onDone();
    } catch (e) {
      setErr(e instanceof AuthExtError ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="mt-2 rounded-[var(--r-md)] border-l-[3px] border-[var(--tertiary)] bg-[var(--tertiary-c)] px-3 py-2.5"
      data-asking={c.asking.kind}
    >
      <div className="text-[13px] font-semibold text-[var(--on-tertiary-c)]">{c.asking.text}</div>
      {c.asking.kind === "approve" ? (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => void send({ approved: true })}>
            スマホで承認した
          </Button>
        </div>
      ) : (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return setErr("届いたコードを入れてください");
            void send({ code });
          }}
          noValidate
        >
          <Input
            aria-label="届いたコード"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="max-w-[160px]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button size="sm" type="submit" disabled={busy}>
            送る
          </Button>
        </form>
      )}
      {err ? (
        <p className="mt-1 text-[12px] text-[var(--error)]" role="alert">
          {err}
        </p>
      ) : null}
      <p className="mt-1 text-[12px] text-[var(--on-tertiary-c)]">
        入れたコードは PC の Bridge だけに渡り、AI にも記録にも残りません
      </p>
    </div>
  );
}
/** 本人が押したときだけもう一度試す（D-117.5） */
function RetryButton({ c, onDone }: { c: MyCredential; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await retryLoginCheck(c.id);
            onDone();
          } catch (e) {
            setErr(e instanceof AuthExtError ? e.message : "うまくいきませんでした");
          } finally {
            setBusy(false);
          }
        }}
      >
        もう一度試す
      </Button>
      {err ? (
        <p className="mt-1 text-[12px] text-[var(--error)]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
// 預けた直後の 1 回のログイン（D-117.1）：結果の種類ごとに、本人に見せる文と一手。値（ログイン名・パスワード）はどこにも出ない
const LOGIN_CHECK: Record<LoginCheckState, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  pending: { label: "PC がログインを試す順番を待っています", tone: "neutral" },
  bad_code: { label: "コードが通りませんでした", tone: "danger" },
  no_answer: { label: "返事が無かったので止めました", tone: "warning" },
  running: { label: "ログインを試しています…", tone: "neutral" },
  ok: { label: "ログインできました", tone: "success" },
  bad_password: { label: "ログイン名かパスワードが違うようです", tone: "danger" },
  needs_2fa: { label: "2 段階認証が要ります", tone: "warning" },
  captcha: { label: "CAPTCHA が出ました", tone: "warning" },
  forbidden: { label: "規約で自動操作が禁止なので試しません", tone: "danger" },
  unreachable: { label: "開けませんでした", tone: "danger" },
  no_form: { label: "ログインの欄が見つかりません", tone: "warning" },
  no_bridge: { label: "PC をつなぐと試します", tone: "neutral" },
  stopped: { label: "途中で止まりました", tone: "warning" },
};
const RETRYABLE: LoginCheckState[] = ["no_answer", "stopped", "unreachable", "bad_code"];
function LoginCheckCell({ c }: { c: MyCredential }) {
  const qc = useQueryClient();
  if (!c.login_check || c.state !== "stored") return <span className="text-[12px] text-[var(--on-sv)]">—</span>;
  const k = LOGIN_CHECK[c.login_check.state] ?? LOGIN_CHECK.stopped;
  return (
    <div data-login-check={c.login_check.state}>
      <Pill tone={k.tone}>{k.label}</Pill>
      {c.login_check.detail && c.login_check.state !== "ok" ? (
        <div className="mt-1 text-[12px] leading-[1.6] text-[var(--on-sv)]">{c.login_check.detail}</div>
      ) : null}
      {RETRYABLE.includes(c.login_check.state) && !c.asking ? (
        <RetryButton c={c} onDone={() => qc.invalidateQueries({ queryKey: ["my-credentials"] })} />
      ) : null}
    </div>
  );
}
// サービス台帳の可否（D-041）。色は状態の 4 色だけ（DESIGN の状態の色）
const VERDICT: Record<Verdict, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  api: { label: "正規API", tone: "success" },
  allowed: { label: "自動操作OK", tone: "success" },
  unspecified: { label: "規約に記載なし", tone: "warning" },
  forbidden: { label: "自動操作禁止", tone: "danger" },
  bank: { label: "銀行（触らない）", tone: "danger" },
};
const HANDLING = [
  "ログイン名・パスワード・ワンタイムコードの鍵は暗号化して保管",
  "入力するのは実行器（Bridge）。AIにも自分のAIにも渡らない",
  "AIが受け取るのは預かり先の番号だけ",
  "誰がいつ使ったかは証跡に残る。あなたが見られる",
];
