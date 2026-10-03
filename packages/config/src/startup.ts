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
/** 起動時の存在確認に落ちた。どの確認が落ちたか（"secrets:vault=error"）を持つ。/health はこれを 503 の理由にする（D-101.4・T-B-14） */
export class StartupFailed extends Error {
  /** 落ちた確認の名前と結果（値は含まない） */
  readonly failed: string[];
  constructor(readonly report: StartupReport) {
    const failed = Object.entries(report.results)
      .filter(([, v]) => v !== "ok")
      .map(([k, v]) => `${k}=${v}`);
    super(`起動時の存在確認に失敗: ${failed.join(", ")}（infra/provision/README.md）`);
    this.name = "StartupFailed";
    this.failed = failed;
  }
}
/** 起動の入口で呼ぶ：1 つでも無ければ名前を挙げて落ちる */
export async function assertStartup(checks: Record<string, StartupCheck>): Promise<StartupReport> {
  const r = await runStartupChecks(checks);
  if (!r.ok) throw new StartupFailed(r);
  return r;
}
