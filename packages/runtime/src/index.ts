// 関門 C5 プロセス起動：runProcess(spec, ctx) だけ。child_process はこのパッケージの外では使えない（CI G20）。
// 関門の中で 1 回だけ：隔離（サーバー経路は Microsandbox・Bridge は作業フォルダの制限）→ 環境変数の遮断 → タイムアウト・強制終了 → 出力の上限 → 完了信号の検証（exit 0 を成功と見なさない）→ 証跡。
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export interface ProcessSpec {
  purpose: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>; // 渡してよい変数だけ（秘密は渡さない。遮断リストで落とす）
  timeoutMs?: number; // 既定 10 分（E-TO-004）
  maxOutputBytes?: number; // 既定 1MB
  /** 完了信号：この印を含む行が標準出力に出て初めて「終わった」と見なす（既定 "@@KANAME_RESULT@@ " の後に JSON） */
  resultMarker?: string;
  stdin?: string;
}
export interface ProcessResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  result: unknown; // 完了信号の中身
  ms: number;
}
export type Outcome =
  | { status: "done"; value: ProcessResult; auditId?: string }
  | {
      status: "denied" | "failed" | "timeout";
      reason: string;
      handoff: string;
      partial?: Partial<ProcessResult>;
      auditId?: string;
    };

/** 隔離の実体（サーバー経路＝Microsandbox／ローカル＝子プロセス）。関門の中だけで使う */
export interface Isolation {
  run(
    spec: { command: string; args: string[]; cwd?: string; env: Record<string, string>; stdin?: string },
    io: { onStdout: (chunk: string) => void; onStderr: (chunk: string) => void; signal: AbortSignal },
  ): Promise<{ exitCode: number | null; signal: string | null }>;
}

/** 子プロセスに渡さない変数（秘密・鍵・トークン）。名前で落とす */
export const BLOCKED_ENV = [
  /KEY$/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /^DATABASE_URL$/i,
  /^AUTH_/i,
  /^ANTHROPIC_/i,
  /^OPENAI_/i,
  /^GOOGLE_/i,
  /^AWS_/i,
  /^SUPABASE_/i,
  /^INFISICAL_/i,
];
export function stripEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && !BLOCKED_ENV.some((re) => re.test(k))) out[k] = v;
  return out;
}
export const DEFAULT_MARKER = "@@KANAME_RESULT@@";

export class ProcessGateway {
  constructor(
    private readonly repo: Repository,
    private readonly isolation: Isolation,
    private readonly hooks: { authorize?: (spec: ProcessSpec, ctx: TenantContext) => Promise<boolean> } = {},
  ) {}

  async runProcess(spec: ProcessSpec, ctx: TenantContext): Promise<Outcome> {
    if (!ctx.tenantId) return { status: "denied", reason: "文脈が無い", handoff: "ログインし直す" };
    if (this.hooks.authorize && !(await this.hooks.authorize(spec, ctx)))
      return this.finish(ctx, spec, {
        status: "denied",
        reason: "この実行は許されていない",
        handoff: "権限のある人に頼む",
      });
    const timeoutMs = spec.timeoutMs ?? 10 * 60_000;
    const maxBytes = spec.maxOutputBytes ?? 1024 * 1024;
    const marker = spec.resultMarker ?? DEFAULT_MARKER;
    const env = stripEnv({
      PATH: process.env["PATH"],
      HOME: process.env["HOME"],
      LANG: "C.UTF-8",
      ...(spec.env ?? {}),
    }); // 親の環境は渡さない。PATH と HOME と、明示された変数だけ
    let stdout = "";
    let stderr = "";
    let truncated = false;
    const take = (cur: string, chunk: string) => {
      if (cur.length >= maxBytes) {
        truncated = true;
        return cur;
      }
      const next = cur + chunk;
      if (next.length > maxBytes) {
        truncated = true;
        return next.slice(0, maxBytes);
      }
      return next;
    };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const r = await this.isolation.run(
        {
          command: spec.command,
          args: spec.args ?? [],
          ...(spec.cwd ? { cwd: spec.cwd } : {}),
          env,
          ...(spec.stdin !== undefined ? { stdin: spec.stdin } : {}),
        },
        {
          onStdout: (c) => {
            stdout = take(stdout, c);
          },
          onStderr: (c) => {
            stderr = take(stderr, c);
          },
          signal: ac.signal,
        },
      );
      const ms = Date.now() - t0;
      if (ac.signal.aborted)
        return this.finish(ctx, spec, {
          status: "timeout",
          reason: `実行が ${Math.round(timeoutMs / 60000)} 分を超えたので止めました。途中までの結果は残っています`,
          handoff: "分けて動かすか、人が引き取る",
          partial: { stdout, stderr, truncated, ms },
        });
      // 完了信号：印の行を探す。無ければ exit 0 でも未完了（E-SIG-001）
      const line = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith(marker))
        .pop();
      if (!line)
        return this.finish(ctx, spec, {
          status: "failed",
          reason: "実行が結果を返さずに終わりました。完了とは見なしていません",
          handoff: "もう一度動かす。続くなら人が確認する",
          partial: { exitCode: r.exitCode, signal: r.signal, stdout, stderr, truncated, ms },
        });
      let result: unknown = null;
      try {
        result = JSON.parse(line.slice(marker.length).trim() || "null");
      } catch {
        result = line.slice(marker.length).trim();
      }
      return this.finish(ctx, spec, {
        status: "done",
        value: { exitCode: r.exitCode, signal: r.signal, stdout, stderr, truncated, result, ms },
      });
    } catch (e) {
      return this.finish(ctx, spec, {
        status: "failed",
        reason: e instanceof Error ? e.message : String(e),
        handoff: "コマンドと作業フォルダを確かめる",
        partial: { stdout, stderr, truncated },
      });
    } finally {
      clearTimeout(timer);
    }
  }
  private async finish(ctx: TenantContext, spec: ProcessSpec, o: Outcome): Promise<Outcome> {
    o.auditId = await this.repo.audit(ctx, `process.${o.status}`, "process", spec.purpose, "C5", {
      command: spec.command,
      reason: "reason" in o ? o.reason : null,
      ms: o.status === "done" ? o.value.ms : (o.partial?.ms ?? null),
      truncated: o.status === "done" ? o.value.truncated : (o.partial?.truncated ?? null),
    });
    return o;
  }
}
