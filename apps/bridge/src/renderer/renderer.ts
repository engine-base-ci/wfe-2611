// 窓の中。node は触らない（preload の口だけ）
interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fix?: "install" | "repair" | "login" | null;
}
interface BridgeApi {
  state(): Promise<{
    connected: boolean;
    deviceLabel: string;
    connectedAt?: string;
    apiBase: string;
    browser?: string;
  }>;
  setBrowser(b: string): Promise<{ ok: boolean; message?: string }>;
  onBrowser(fn: (b: string) => void): void;
  claim(code: string): Promise<{ ok: true } | { ok: false; message: string }>;
  check(): Promise<Check[]>;
  openKaname(): Promise<void>;
  installClaude(): Promise<{ ok: boolean; message: string }>;
  loginStart(): Promise<{ ok: boolean; url?: string; message: string }>;
  loginCode(code: string): Promise<{ ok: boolean; message: string }>;
  loginCancel(): Promise<{ ok: boolean }>;
  onInstallStep(fn: (s: { text: string; state: string }) => void): void;
}
declare const bridge: BridgeApi;

const $ = (id: string) => document.getElementById(id)!;
const msg = (t: string, kind: "ok" | "ng") => ($("msg").innerHTML = `<div class="msg ${kind}">${t}</div>`);

async function paint(): Promise<void> {
  const s = await bridge.state();
  $("foot").textContent = `${s.deviceLabel} ／ つなぎ先 ${s.apiBase}`;
  if (s.connected) msg("つながっています。Kaname の画面で「接続を確かめる」を押してください。", "ok");
  const pick = document.querySelector<HTMLInputElement>(`#browser input[value="${s.browser ?? "chrome"}"]`);
  if (pick) pick.checked = true;
}
// AI が使うブラウザ（D-119.2）。選んだらすぐ覚え、自己診断を出し直す
$("browser").addEventListener("change", async (e) => {
  const v = (e.target as HTMLInputElement).value;
  const r = await bridge.setBrowser(v);
  $("browser-msg").textContent = r.ok
    ? "変えました。次の作業から使います（Kaname の画面にも出ます）"
    : (r.message ?? "変えられませんでした");
  if (!r.ok) await paint(); // 変えられなかったら元の選択に戻す
  await checks();
});
// Kaname の画面で変えたら、この窓にも出す（D-120.1）
bridge.onBrowser((b) => {
  const pick = document.querySelector<HTMLInputElement>(`#browser input[value="${b}"]`);
  if (pick) pick.checked = true;
  void checks();
});
async function checks(): Promise<void> {
  $("checks").innerHTML = '<li><span class="d">確かめています…</span></li>';
  const rows = await bridge.check();
  // 印は Lucide の線画（絵文字は使わない）
  const ICON = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    ng: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  };
  $("checks").innerHTML = rows
    .map(
      (c) =>
        `<li class="${c.ok ? "ok" : "ng"}">${c.ok ? ICON.ok : ICON.ng}<span>${c.name}<span class="d">${c.detail}</span></span></li>`,
    )
    .join("");
  // 何が足りないかで出し分ける。2 つの検査はどちらも名前に「Claude Code」が入るので、名前で選ばない
  const needInstall = rows.find((c) => c.fix === "install" || c.fix === "repair");
  // 入っていないのにログインは押せない。押せないボタンを出さない
  const needLogin = needInstall ? undefined : rows.find((c) => c.fix === "login");
  const need = $("need") as HTMLElement;
  need.hidden = !needInstall && !needLogin;
  ($("install") as HTMLElement).hidden = !needInstall;
  ($("login") as HTMLElement).hidden = !needLogin;
  if (needInstall) {
    const repair = needInstall.fix === "repair";
    $("need-why").textContent = repair
      ? "Claude Code は入っていますが、本体が落ちてきていないので動きません。下のボタンで取り直せば直ります（ターミナルは触りません）。"
      : "この PC に Claude Code がありません。AI はこれで動くので、無いと 1 件も動きません。下のボタンで入れられます（ターミナルは触りません）。";
    $("install").lastChild!.textContent = repair ? " Claude Code を取り直す" : " Claude Code を入れる";
  } else if (needLogin) {
    $("need-why").textContent =
      "Claude Code にまだログインしていません。ブラウザで 1 回だけ承認すると、AI が動き出します（ターミナルは開きません）。";
  }
}

$("go").addEventListener("click", async () => {
  const el = $("code") as HTMLInputElement;
  const btn = $("go") as HTMLButtonElement;
  btn.disabled = true;
  const r = await bridge.claim(el.value.trim().toUpperCase());
  btn.disabled = false;
  if (r.ok) {
    msg("つながりました。Kaname の画面で「接続を確かめる」を押してください。", "ok");
    el.value = "";
  } else msg(r.message, "ng");
  void checks();
});
$("install").addEventListener("click", async () => {
  const b = $("install") as HTMLButtonElement;
  b.disabled = true;
  $("install-log").textContent = "入れています…";
  const r = await bridge.installClaude();
  b.disabled = false;
  $("install-log").textContent = r.message;
  void checks();
});
$("login").addEventListener("click", async () => {
  const b = $("login") as HTMLButtonElement;
  b.disabled = true;
  $("login-msg").textContent = "ブラウザを開いています…";
  ($("login-box") as HTMLElement).hidden = false;
  const r = await bridge.loginStart();
  b.disabled = false;
  $("login-msg").textContent = r.message;
  if (r.url) ($("login-url") as HTMLAnchorElement).href = r.url;
  if (r.ok && !r.url) {
    ($("login-box") as HTMLElement).hidden = true; // もう入れていた
    void checks();
    return;
  }
  ($("login-code") as HTMLInputElement).focus();
});
$("login-go").addEventListener("click", async () => {
  const el = $("login-code") as HTMLInputElement;
  const b = $("login-go") as HTMLButtonElement;
  b.disabled = true;
  $("login-msg").textContent = "確かめています（30 秒ほどかかります）…";
  const r = await bridge.loginCode(el.value);
  b.disabled = false;
  $("login-msg").textContent = r.message;
  if (r.ok) {
    el.value = "";
    ($("login-box") as HTMLElement).hidden = true;
  }
  void checks();
});
$("recheck").addEventListener("click", () => void checks());
$("open").addEventListener("click", () => void bridge.openKaname());
void paint();
void checks();
