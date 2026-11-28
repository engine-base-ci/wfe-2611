// 記録の 1 行の文（K-823）。画面は「<人> が <文>」と出す。ここは「が」の後ろの 1 文を action ごとに作る。
//   action の名前は書く葉の今の名前（K-800 の表・K-802〜K-848・K-827〜K-830・K-838）に合わせた。書く葉が名前を変えるときは同じ回にここも直す。
//   対象の名前（label）が引けない（対象が消えた）ときは、その所を省いた文にする。知らない action は「<action> を行った」
//   payload に名前・メールは無い（K-800 の決め）。名前は DB の関数 app.audit_list が対象の表から引いた label

export interface LineRow {
  action: string;
  target_label: string | null;
  payload: Record<string, unknown>;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧のみ",
};

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

function roleChange(who: string | null, payload: Record<string, unknown>): string {
  const from = ROLE_LABEL[str(payload["from"]) ?? ""];
  const to = ROLE_LABEL[str(payload["to"]) ?? ""];
  const head = who ? `${who} の役割を` : "役割を";
  return from && to ? `${head} ${from} から ${to} に変えた` : `${head}変えた`;
}

/** 人を対象にする文（<人> が無ければ省く） */
const person = (who: string | null, tail: string, bare: string): string => (who ? `${who} ${tail}` : bare);
/** 名前を「」で囲む文（名前が無ければ省く） */
const named = (head: string, name: string | null, tail: string): string =>
  name ? `${head}「${name}」${tail}` : `${head}${tail}`;

const LINES: Record<string, (r: LineRow) => string> = {
  "tickets.delete": (r) => (r.target_label ? `チケット ${r.target_label} を消した` : "チケットを消した"),
  "invitation.created": () => "メンバーを招いた",
  "invitation.resend": () => "招待を送り直した",
  "invitation.revoke": () => "招待を取り消した",
  "member.role_change": (r) => roleChange(r.target_label, r.payload),
  "member.groups_change": (r) => person(r.target_label, "のグループを変えた", "グループを変えた"),
  "member.suspend": (r) => person(r.target_label, "を一時的に止めた", "メンバーを一時的に止めた"),
  "member.resume": (r) => person(r.target_label, "を戻した", "メンバーを戻した"),
  "member.remove": (r) => person(r.target_label, "をワークスペースから外した", "メンバーをワークスペースから外した"),
  "member.left": () => "ワークスペースを抜けた",
  "scope.create": (r) => named("グループ", r.target_label, "を作った"),
  "scope.update": (r) => named("グループ", r.target_label, "を直した"),
  "layer.create": (r) => named("層", r.target_label, "を足した"),
  "layer.update": (r) => named("層", r.target_label, "を直した"),
  "workspace.renamed": (r) => {
    const to = str(r.payload["to"]);
    return to ? `ワークスペースの名前を「${to}」に変えた` : "ワークスペースの名前を変えた";
  },
  "workspace.logo_changed": () => "ロゴを変えた",
  "workspace.permissions_changed": () => "「誰ができるか」を変えた",
  "workspace.deletion_requested": () => "ワークスペースを消す手続きを始めた",
  "workspace.deletion_cancelled": () => "ワークスペースを消す手続きを取り消した",
};

/** 1 行の文 */
export function lineOf(r: LineRow): string {
  const make = LINES[r.action];
  return make ? make(r) : `${r.action} を行った`;
}
