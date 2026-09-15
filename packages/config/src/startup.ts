// 起動時の存在確認（G-11）。外部リソース（表・バケット・鍵・送出先）が無ければ起動で落ちる。黙って 502 を返さない
export type StartupCheck = () => Promise<boolean>;
export interface StartupReport {
  ok: boolean;
  results: Record<string, "ok" | "missing" | "error">;
}
export async function runStartupChecks(checks: Record<string, StartupCheck>): Promise<StartupReport> {
  const results: StartupReport["results"] = {};
  for (const [name, fn] of Object.entries(checks)) {
    try {
      results[name] = (await fn()) ? "ok" : "missing";
    } catch {
      results[name] = "error";
    }
  }
  return { ok: Object.values(results).every((r) => r === "ok"), results };
}
/** 起動の入口で呼ぶ：1 つでも無ければ名前を挙げて落ちる */
export async function assertStartup(checks: Record<string, StartupCheck>): Promise<StartupReport> {
  const r = await runStartupChecks(checks);
  if (!r.ok) {
    const bad = Object.entries(r.results)
      .filter(([, v]) => v !== "ok")
      .map(([k, v]) => `${k}=${v}`);
    throw new Error(`起動時の存在確認に失敗: ${bad.join(", ")}（infra/provision/README.md）`);
  }
  return r;
}
