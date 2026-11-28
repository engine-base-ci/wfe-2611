// 外のコマンドに聞く（非同期・時間切れあり）。窓の処理（main）の中で同期で待たない（固まる。PATH を聞く所で一度起きた）
import { spawn } from "node:child_process";

export interface Out {
  code: number | null;
  stdout: string;
  stderr: string;
}
/** 動かして出力を受け取る。時間切れは殺して code=null。見つからない・動かないも code=null（投げない） */
export function ask(bin: string, args: string[], opts: { timeoutMs: number; env?: NodeJS.ProcessEnv }): Promise<Out> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve({ code, stdout, stderr });
    };
    let p: ReturnType<typeof spawn>;
    try {
      p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], ...(opts.env ? { env: opts.env } : {}) });
    } catch {
      return resolve({ code: null, stdout, stderr });
    }
    const t = setTimeout(() => {
      try {
        p.kill("SIGKILL");
      } catch {
        /* もう終わっている */
      }
      finish(null);
    }, opts.timeoutMs);
    p.stdout?.on("data", (c: Buffer) => (stdout += c.toString()));
    p.stderr?.on("data", (c: Buffer) => (stderr += c.toString()));
    p.on("error", () => finish(null));
    p.on("close", (code) => finish(code));
  });
}
