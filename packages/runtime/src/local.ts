// ローカルの隔離（開発・Bridge の作業フォルダ用の土台）。サーバー経路の Microsandbox は T-F-16 以降で別ドライバ
import { spawn } from "node:child_process";
import type { Isolation } from "./index.js";

export function localIsolation(): Isolation {
  return {
    run(spec, io) {
      return new Promise((resolve, reject) => {
        const child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, stdio: ["pipe", "pipe", "pipe"] });
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (c: string) => io.onStdout(c));
        child.stderr.on("data", (c: string) => io.onStderr(c));
        const kill = () => child.kill("SIGKILL");
        io.signal.addEventListener("abort", kill, { once: true });
        child.on("error", (e) => {
          io.signal.removeEventListener("abort", kill);
          reject(e);
        });
        child.on("close", (code, signal) => {
          io.signal.removeEventListener("abort", kill);
          resolve({ exitCode: code, signal });
        });
        if (spec.stdin !== undefined) child.stdin.write(spec.stdin);
        child.stdin.end();
      });
    },
  };
}
