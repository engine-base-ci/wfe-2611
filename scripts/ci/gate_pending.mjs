// まだ実装されていないゲートの振る舞い（T-F-01）。
// UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない。
// → Foundation（task/T-F-*）の PR だけ通し、それ以外の PR はこのゲートで落とす（担当タスクを示す）。
import { execSync } from "node:child_process";

const [gate, owner] = process.argv.slice(2);
let ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
if (!ref) {
  try {
    ref = execSync("git symbolic-ref --short HEAD", { encoding: "utf8" }).trim(); // 最初のコミット前（unborn）でも取れる
  } catch {
    ref = "";
  }
}
const foundation = /^task\/T-F-\d+/.test(ref) || ref === "main";
if (foundation) {
  console.log(`[${gate}] まだ無い（担当 ${owner}）。Foundation の PR なので通す: ${ref}`);
  process.exit(0);
}
console.error(`[${gate}] 基盤の検査がまだ無い（担当 ${owner}）。Foundation が終わるまで後段の PR（${ref}）は merge しない`);
process.exit(1);
