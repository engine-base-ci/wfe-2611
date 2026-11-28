// チケットの設定の画面（K-707 種別・K-708 状態・K-709 項目）の試験の道具：設定の口を網の手前で差し替える。
//   答えの形は 07_functional/段10-F9/土台-settings.md の 3・4 章（listTicketKinds・listTicketStages・listTicketFieldMaster・書く口 12 本）。
//   名前・字・数は下絵 v2（/dev/mock/f9 の set-kinds・set-stages・set-fields の見本＝app/(dev)/dev/mock/f9/ws-mocks.tsx）と同じにする（モックとの突き合わせのため）。
//   人数の札のための getWorkspaceMembers（K-419）も答える。本人の Bridge（127.0.0.1:38617）は届かせない（網の手前で 404）。
//   固定の待ちは使わない（答えは hold() で止め、返した関数を呼ぶと答える）。テストはチケットを作る人が書き、実装する人は変えない
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Request, Route } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本 errors.json の文（無ければ見つからない印の文字列を返し、試験が落ちる） */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

export const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const K_TASK = uid(0xc001);
export const K_BILL = uid(0xc002);
export const K_ASK = uid(0xc003);
export const K_BUG = uid(0xc004);
export const K_MTG = uid(0xc005);
export const K_NEW = uid(0xc0ff);
export const S_TODO = uid(0xd001);
export const S_DOING = uid(0xd002);
export const S_CHECK = uid(0xd003);
export const S_WAIT = uid(0xd004);
export const S_HOLD = uid(0xd005);
export const S_RUN = uid(0xd006);
export const S_APPR = uid(0xd007);
export const S_DONE = uid(0xd008);
export const S_NEW = uid(0xd0ff);
export const F_PJ = uid(0xe001);
export const F_AMOUNT = uid(0xe002);
export const F_PAY = uid(0xe003);
export const F_CLASS = uid(0xe004);
export const F_NOTE = uid(0xe005);
export const F_NEW = uid(0xe0ff);
export const GONE = uid(0xffff);

// ---------------------------------------------------------------- 文書の木（本文のひな形）
export type Doc = { type: "doc"; content: unknown[] };
const t = (text: string) => ({ type: "text", text });
const H2 = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [t(text)] });
const GHOST = (text: string) => ({ type: "paragraph", attrs: { ghost: true }, content: [t(text)] });
export const P = (text: string) => ({ type: "paragraph", content: [t(text)] });
export const doc = (...content: unknown[]): Doc => ({ type: "doc", content });
export const EMPTY_DOC: Doc = { type: "doc", content: [] };
/** モック set-kinds の「請求」のひな形（見出し 4 つ＋薄い字） */
export const BILL_TEMPLATE = doc(
  H2("目的"),
  GHOST("どの取引先の・何月分の請求かを書きます"),
  H2("完了の条件"),
  GHOST("どうなれば終わりかを書きます（例：請求書が届き、支払期日が合っている）"),
  H2("実施事項"),
  GHOST("やることを、チェックの行で並べます"),
  H2("参考"),
  GHOST("前の月の請求書や、取引先との決めごとがあれば書きます"),
);
export const TASK_TEMPLATE = doc(H2("目的"), GHOST("何のための仕事かを書きます"));

// ---------------------------------------------------------------- 口の答えの形
export interface KindA {
  id: string;
  name: string;
  color: string;
  color_key: string;
  position: number;
  is_builtin: boolean;
  body_template: Doc | null;
  fields: unknown[];
}
export interface StageA {
  id: string;
  key: string | null;
  name: string;
  color_key: string;
  position: number;
  lock: "start" | "end" | "system" | null;
}
export interface OptionA {
  id: string;
  name: string;
  position: number;
}
export interface FieldA {
  id: string;
  name: string;
  field_type: "short_text" | "long_text" | "number" | "money" | "date" | "select" | "multi_select" | "check";
  required: boolean;
  description: string | null;
  options: OptionA[];
  position: number;
  kind_ids: string[];
  all_kinds: boolean;
  value_count: number;
}
const kind = (id: string, name: string, key: string, position: number, tpl: Doc | null, builtin = false): KindA => ({
  id,
  name,
  color: "#000000",
  color_key: key,
  position,
  is_builtin: builtin,
  body_template: tpl,
  fields: [],
});
export const kindsTaka = (): KindA[] => [
  kind(K_TASK, "タスク", "indigo", 10, TASK_TEMPLATE, true),
  kind(K_BILL, "請求", "teal", 20, BILL_TEMPLATE),
  kind(K_ASK, "問い合わせ", "amber", 30, TASK_TEMPLATE),
  kind(K_BUG, "不具合", "coral", 40, null),
  kind(K_MTG, "打ち合わせ", "lavender", 50, null),
];
const stage = (
  id: string,
  key: string | null,
  name: string,
  color: string,
  position: number,
  lock: StageA["lock"],
): StageA => ({
  id,
  key,
  name,
  color_key: color,
  position,
  lock,
});
/** 一覧に出る 5 つ（未着手・作業中・先方の返事待ち・保留・完了）と、画面が一覧から外す仕組みの状態 3 つ */
export const stagesTaka = (): StageA[] => [
  stage(S_TODO, "todo", "未着手", "teal-light", 10, "start"),
  stage(S_DOING, "doing", "作業中", "indigo", 20, null),
  stage(S_CHECK, "checking", "確認中", "teal", 25, "system"),
  stage(S_WAIT, null, "先方の返事待ち", "amber", 30, null),
  stage(S_HOLD, "hold", "保留", "plum", 40, null),
  stage(S_RUN, "running", "実行中", "coral", 45, "system"),
  stage(S_APPR, "awaiting_approval", "承認待ち", "amber", 47, "system"),
  stage(S_DONE, "done", "完了", "sage", 90, "end"),
];
const opt = (id: string, name: string, position: number): OptionA => ({ id, name, position });
export const fieldsTaka = (): FieldA[] => [
  {
    id: F_PJ,
    name: "PJコード",
    field_type: "select",
    required: true,
    description: "どの案件の仕事かを選びます",
    options: [
      opt(uid(0xe101), "SK-2026-11（セイコー商事）", 1),
      opt(uid(0xe102), "MN-2026-08（ミナト工業）", 2),
      opt(uid(0xe103), "社内", 3),
    ],
    position: 10,
    kind_ids: [K_TASK, K_BILL],
    all_kinds: false,
    value_count: 3,
  },
  {
    id: F_AMOUNT,
    name: "請求額",
    field_type: "money",
    required: false,
    description: "税を含まない額",
    options: [],
    position: 20,
    kind_ids: [K_BILL],
    all_kinds: false,
    value_count: 0,
  },
  {
    id: F_PAY,
    name: "支払期日",
    field_type: "date",
    required: true,
    description: "取引先が支払う日",
    options: [],
    position: 30,
    kind_ids: [K_BILL],
    all_kinds: false,
    value_count: 0,
  },
  {
    id: F_CLASS,
    name: "分類",
    field_type: "multi_select",
    required: false,
    description: null,
    options: [opt(uid(0xe111), "経理", 1), opt(uid(0xe112), "営業", 2)],
    position: 40,
    kind_ids: [K_TASK],
    all_kinds: false,
    value_count: 0,
  },
  {
    id: F_NOTE,
    name: "備考",
    field_type: "long_text",
    required: false,
    description: null,
    options: [],
    position: 50,
    kind_ids: [K_TASK, K_ASK],
    all_kinds: false,
    value_count: 0,
  },
];

export type SOp =
  | "kinds"
  | "createKind"
  | "updateKind"
  | "deleteKind"
  | "stages"
  | "createStage"
  | "updateStage"
  | "deleteStage"
  | "reorderStages"
  | "fields"
  | "createField"
  | "updateField"
  | "deleteField"
  | "members";
export interface Reply {
  status: number;
  body: unknown;
}
export interface Call {
  op: SOp;
  id: string | undefined;
  body: Record<string, unknown>;
  key: string | undefined;
}
export interface SMock {
  kinds: KindA[];
  stages: StageA[];
  fields: FieldA[];
  calls: Call[];
  count: (op: SOp) => number;
  last: (op: SOp) => Call | undefined;
  /** 次の 1 回だけ、この答え（"network" は網が切れる）で答える */
  script: (op: SOp, ...replies: (Reply | "network")[]) => void;
  /** この口の答えを止める（返した関数を呼ぶと答える） */
  hold: (op: SOp) => () => void;
}
/** 口が断る答え。details・欄は付けない（控え帳：404・409 は欄なし）。差し込む値は detail だけ */
export const err = (status: number, code: string, detail?: Record<string, unknown>): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, ...(detail ? { detail } : {}) },
});

const API = /\/api\/v1\/(ticket_kinds|ticket_stages|ticket-field-master|ticket-fields|workspace\/members)(\/|\?|$)/;
const sorted = <T extends { position: number }>(xs: T[]): T[] => [...xs].sort((a, b) => a.position - b.position);

export async function mockSettings(
  page: Page,
  init: { kinds?: KindA[]; stages?: StageA[]; fields?: FieldA[] } = {},
): Promise<SMock> {
  const scripted = new Map<SOp, (Reply | "network")[]>();
  const gates = new Map<SOp, Promise<void>>();
  const mk: SMock = {
    kinds: init.kinds ?? kindsTaka(),
    stages: init.stages ?? stagesTaka(),
    fields: init.fields ?? fieldsTaka(),
    calls: [],
    count: (op) => mk.calls.filter((c) => c.op === op).length,
    last: (op) => [...mk.calls].reverse().find((c) => c.op === op),
    script: (op, ...r) => scripted.set(op, [...(scripted.get(op) ?? []), ...r]),
    hold: (op) => {
      let open = (): void => undefined;
      gates.set(op, new Promise<void>((r) => (open = r)));
      return () => {
        open();
        gates.delete(op);
      };
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(API, async (route: Route, req: Request) => {
    const seg = new URL(req.url()).pathname.replace("/api/v1", "").split("/").filter(Boolean);
    const m = req.method();
    const head = seg[0] === "workspace" ? "members" : seg[0]!;
    const id = seg[1] && seg[1] !== "order" ? seg[1] : undefined;
    let op: SOp | null = null;
    if (head === "members" && m === "GET") op = "members";
    else if (head === "ticket_kinds")
      op =
        m === "GET"
          ? "kinds"
          : m === "POST" && !id && !seg[1]
            ? "createKind"
            : m === "PATCH"
              ? "updateKind"
              : m === "DELETE"
                ? "deleteKind"
                : null;
    else if (head === "ticket_stages")
      op =
        m === "GET"
          ? "stages"
          : seg[1] === "order"
            ? "reorderStages"
            : m === "POST"
              ? "createStage"
              : m === "PATCH"
                ? "updateStage"
                : m === "DELETE"
                  ? "deleteStage"
                  : null;
    else if (head === "ticket-field-master" && m === "GET") op = "fields";
    else if (head === "ticket-fields")
      op = m === "POST" ? "createField" : m === "PATCH" ? "updateField" : m === "DELETE" ? "deleteField" : null;
    if (!op) return route.fallback();
    const raw = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
    mk.calls.push({ op, id, body: raw, key: req.headers()["idempotency-key"] });
    const gate = gates.get(op);
    if (gate) await gate;
    const next = scripted.get(op)?.shift();
    const send = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    if (next === "network") return route.abort("failed");
    if (next) return send(next);
    const ok = (data: unknown, status = 200) => send({ status, body: { data } });
    switch (op) {
      case "members":
        return ok({ groups: [], invitations: [], alerts: [], count: 9 });
      case "kinds":
        return ok(sorted(mk.kinds));
      case "createKind": {
        const k = kind(
          K_NEW,
          String(raw["name"]),
          String(raw["color_key"]),
          60,
          (raw["body_template"] as Doc | null) ?? null,
        );
        mk.kinds.push(k);
        return ok(k, 201);
      }
      case "updateKind": {
        const k = mk.kinds.find((x) => x.id === id);
        if (!k) return send(err(404, "E-PAGE-001"));
        if (raw["name"] !== undefined) k.name = String(raw["name"]);
        if (raw["color_key"] !== undefined) k.color_key = String(raw["color_key"]);
        if (raw["body_template"] !== undefined) k.body_template = raw["body_template"] as Doc | null;
        return ok(k);
      }
      case "deleteKind": {
        if (!mk.kinds.some((x) => x.id === id)) return send(err(404, "E-PAGE-001"));
        mk.kinds = mk.kinds.filter((x) => x.id !== id);
        return ok({ id });
      }
      case "stages":
        return send({ status: 200, body: { data: sorted(mk.stages), meta: { limit: 100 } } });
      case "createStage": {
        const s = stage(S_NEW, null, String(raw["name"]), String(raw["color_key"]), 85, null);
        mk.stages.push(s);
        return ok(s, 201);
      }
      case "updateStage": {
        const s = mk.stages.find((x) => x.id === id);
        if (!s) return send(err(404, "E-PAGE-001"));
        if (raw["name"] !== undefined) s.name = String(raw["name"]);
        if (raw["color_key"] !== undefined) s.color_key = String(raw["color_key"]);
        return ok(s);
      }
      case "deleteStage": {
        if (!mk.stages.some((x) => x.id === id)) return send(err(404, "E-PAGE-001"));
        mk.stages = mk.stages.filter((x) => x.id !== id);
        return ok({ id });
      }
      case "reorderStages": {
        const ids = (raw["stage_ids"] as string[]) ?? [];
        ids.forEach((sid, i) => {
          const s = mk.stages.find((x) => x.id === sid);
          if (s) s.position = (i + 1) * 10;
        });
        return ok(sorted(mk.stages));
      }
      case "fields":
        return ok(sorted(mk.fields));
      case "createField": {
        const opts = ((raw["options"] as { id?: string; name: string }[] | undefined) ?? []).map((o, i) =>
          opt(o.id ?? uid(0xe200 + i), o.name, i + 1),
        );
        const f: FieldA = {
          id: F_NEW,
          name: String(raw["name"]),
          field_type: raw["field_type"] as FieldA["field_type"],
          required: Boolean(raw["required"]),
          description: (raw["description"] as string | null | undefined) ?? null,
          options: opts,
          position: 60,
          kind_ids: (raw["kind_ids"] as string[]) ?? [],
          all_kinds: false,
          value_count: 0,
        };
        mk.fields.push(f);
        return ok(f, 201);
      }
      case "updateField": {
        const f = mk.fields.find((x) => x.id === id);
        if (!f) return send(err(404, "E-PAGE-001"));
        if (raw["name"] !== undefined) f.name = String(raw["name"]);
        if (raw["field_type"] !== undefined) f.field_type = raw["field_type"] as FieldA["field_type"];
        if (raw["required"] !== undefined) f.required = Boolean(raw["required"]);
        if (raw["description"] !== undefined) f.description = raw["description"] as string | null;
        if (raw["kind_ids"] !== undefined) {
          f.kind_ids = raw["kind_ids"] as string[];
          f.all_kinds = false;
        }
        if (raw["options"] !== undefined)
          f.options = (raw["options"] as { id?: string; name: string }[]).map((o, i) =>
            opt(o.id ?? uid(0xe300 + i), o.name, i + 1),
          );
        return ok(f);
      }
      case "deleteField": {
        if (!mk.fields.some((x) => x.id === id)) return send(err(404, "E-PAGE-001"));
        mk.fields = mk.fields.filter((x) => x.id !== id);
        return ok({ id });
      }
    }
  });
  return mk;
}
