#!/usr/bin/env python3
"""gen_ddl.py — 正本（entities.json ← ER図）から migration の DDL を機械生成する（T-D-*）。手で書いた DDL は正本とずれる。

  python3 scripts/ci/gen_ddl.py --sections "1." "2." -o packages/db/migrations/0007_s01_s02.sql
  python3 scripts/ci/gen_ddl.py --tables clones ai_employees -o packages/db/migrations/0007_org.sql

決めていること（プロジェクトに依らない規則。固有名は引数で差し替える）
- <common>  = id uuid PK / tenant_id uuid NOT NULL → tenants / created_at / updated_at / created_by / updated_by / deleted_at
- <scoped>  = <common> ＋ scope_id uuid NOT NULL → scopes　　<versioned> = <scoped> ＋ version int NOT NULL
- マスタ（tenant_isolation none・key を持つ）= key text PK / label text NOT NULL
- 列の型は 名前の語尾と備考（jsonb / uuid[] / text[] / date / numeric(a,b / vector(N）から決める。*_id は関係（relations）と表名から FK を引く。
  引けない *_id は、備考に「／」で値が列挙されていれば text（値の集合）、そうでなければ uuid（多態の参照）
- 既に migration にある表は作らない（--migrations-dir を走査）。先の migration の表が今回の表を参照する列には、後から FK を足す
- 表ごとに：tenant_id・scope_id・FK の索引／updated_at のトリガ／target_kinds の行（権限の対象）／app ロールへの grant。RLS は gen_rls.py が別ファイルで出す
"""
import argparse, glob, json, re, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--entities", default="07_functional/entities.json")
ap.add_argument("--migrations-dir", default="packages/db/migrations")
ap.add_argument("--sections", nargs="*", default=[], help='節の頭（"1." "2."）')
ap.add_argument("--tables", nargs="*", default=[])
ap.add_argument("-o", required=True)
ap.add_argument("--app-role", default="kaname_app")
ap.add_argument("--tenants-table", default="tenants")
ap.add_argument("--scopes-table", default="scopes")
ap.add_argument("--members-table", default="members")
ap.add_argument("--target-kinds-table", default="target_kinds")
ap.add_argument("--updated-at-fn", default="app.set_updated_at()")
ap.add_argument("--migrations-table", default="app.schema_migrations")
ap.add_argument("--vector-dim", type=int, default=1536)
ap.add_argument("--title", default="")
ap.add_argument("--alias", action="append", default=[], help="語幹=表（引けない *_id の参照先。値 text なら値の集合）。例 service=service_registry event=account_events choke_point=text")
a = ap.parse_args()

ents = json.load(open(a.entities, encoding="utf-8"))["entities"]
by_table = {e["table_name"]: e for e in ents}
existing: set[str] = set()
for f in sorted(glob.glob(f"{a.migrations_dir}/*.sql")):
    if Path(f).name == Path(a.o).name: continue
    existing |= set(re.findall(r"create table if not exists (\w+)", open(f, encoding="utf-8").read()))

targets = [e for e in ents if (a.sections and any(e["section"].startswith(s) for s in a.sections)) or e["table_name"] in a.tables]
targets = [e for e in targets if e["table_name"] not in existing]
if not targets: print("作る表が無い（全部 migration 済み）"); sys.exit(0)
new_names = {e["table_name"] for e in targets}

# ---- 名前の規則 -------------------------------------------------------------
def singular(t: str) -> str:
    if t.endswith("ies"): return t[:-3] + "y"
    if t.endswith("ses"): return t[:-2] + "is"   # hypotheses → hypothesis
    if t.endswith("s"): return t[:-1]
    return t

def is_master(e) -> bool:
    names = [f["name"] for f in e["fields"]]
    return e["tenant_isolation"]["type"] == "none" and "key" in names and not any(n.startswith("<") for n in names)

def has_tenant(e) -> bool:
    return e["tenant_isolation"]["type"] != "none" or any(f["name"] == "tenant_id" for f in e["fields"])

MEMBER_COLS = re.compile(r"(^|_)(member_id|requested_by|changed_by|released_by|approved_by|decided_by|applied_by|published_by|disabled_by|recorded_by|assignee_id)$")
POLY = {"origin", "subject", "target", "source_ref", "template", "options_master", "provisioning"}  # 多態・外の参照：uuid・FK なし
ALIASES = dict(x.split("=", 1) for x in a.alias)
ENUMISH = {"kind", "status", "mode", "verdict", "disposition", "visibility", "type", "format", "channel", "component", "state", "method", "role", "reason", "strategy", "value_type", "data_type"}

def resolve_fk(e, col: str):
    """*_id → (型, 参照先 or None)。参照先は (表, 列)"""
    t = e["table_name"]; stem = col[:-3]
    if col == "parent_id": return "uuid", (t, "id")
    if MEMBER_COLS.search(col) or MEMBER_COLS.search(stem) or col.endswith("ops_member_id"): return "uuid", (a.members_table, "id")
    for k, v in ALIASES.items():
        if stem == k or stem.endswith("_" + k):
            if v == "text": return "text", None
            return ("text", (v, "key")) if is_master(by_table[v]) else ("uuid", (v, "id"))
    last = stem.split("_")[-1]
    if last in POLY or stem in POLY: return "uuid", None
    if last in ENUMISH or stem in ENUMISH:
        # 値の集合（マスタ）：<表の単数>_<stem>s があればそれ。無ければ text（値は API 層の zod と正本が持つ）
        own = f"{singular(t)}_{stem}s"
        if own in by_table: return "text", (own, "key")
        if f"{stem}s" in by_table and is_master(by_table[f"{stem}s"]): return "text", (f"{stem}s", "key")  # rollup_kind_id → rollup_kinds
        rel_m = [r["to"] for r in e.get("relations", []) if "to" in r and r["to"].endswith(f"_{stem}s") and is_master(by_table.get(r["to"], {"tenant_isolation": {"type": "x"}, "fields": []}))]
        if len(rel_m) == 1 and not own in by_table: return "text", (rel_m[0], "key")
        return "text", None
    # 1) 関係（relations）の先で単数形が一致する表。同点なら 同じ接頭語の表 → relations にある表
    rel_targets = [r["to"] for r in e.get("relations", []) if "to" in r]
    cands = list(dict.fromkeys(rel_targets + list(by_table)))
    def score(tb: str) -> int:
        s = singular(tb)
        if s == stem or tb == stem: return 4
        if s.endswith("_" + stem): return 2            # definition_id → ledger_definitions
        if stem.endswith("_" + s) or (stem.endswith(s) and s != stem): return 1  # parent_goal_id → goals
        return 0
    best = max(cands, key=lambda tb: (score(tb), tb.split("_")[0] == t.split("_")[0], tb in rel_targets), default=None)
    if best and score(best) > 0:
        te = by_table[best]
        if is_master(te): return "text", (best, "key")
        return "uuid", (best, "id")
    return None

def col_type(e, f) -> tuple[str, str | None]:
    """→ (型, 参照先 'table(col)' or None)"""
    n, note = f["name"], (f.get("note") or "")
    m = re.match(r"(jsonb|uuid\[\]|text\[\]|date|numeric\(\d+,\d+|vector\(N|int|bigint|boolean|timestamptz)", note)
    if m:
        ty = m.group(1)
        if ty.startswith("numeric("): ty += ")"
        if ty == "vector(N": ty = f"vector({a.vector_dim})"
        return ty, None
    if n.endswith("_ids"): return "uuid[]", None
    if n.endswith("_id") or MEMBER_COLS.search(n):
        r = resolve_fk(e, n if n.endswith("_id") else n + "_id")
        if r: return r[0], (f"{r[1][0]}({r[1][1]})" if r[1] else None)
        if "／" in note or n[:-3].split("_")[-1] in ENUMISH: return "text", None
        return "uuid", None
    if n.endswith("_at") or n in ("blocked_since",): return "timestamptz", None
    if n.endswith("_on") or n.endswith("_date") or n in ("period_start", "period_end", "planned_for", "retain_until"): return "date", None
    if n.endswith(("_minutes", "_count", "order_no", "decimals", "version", "current_version", "version_in_use", "tokens_in", "tokens_out", "run_count", "fail_count", "avg_ms")): return "int", None
    if n == "size": return "bigint", None
    if n in ("amount", "value", "limit_value", "target_value", "allocated_value", "measured_value", "price_monthly", "cost", "confidence", "expected_effect"): return "numeric", None
    if n.startswith("is_") or n in ("enabled", "required", "locked") or n.endswith("_enabled"): return "boolean", None
    return "text", None

# ---- DDL --------------------------------------------------------------------
def ddl_for(e) -> tuple[str, list[str]]:
    t = e["table_name"]; cols: list[str] = []; extra: list[str] = []; idx: list[str] = []
    fields = e["fields"]; names = [f["name"] for f in fields]
    scoped = "<scoped>" in names or "<versioned>" in names
    tenant = has_tenant(e)
    if is_master(e):
        cols.append("key text primary key"); cols.append("label text not null")
        for f in fields:
            if f["name"] in ("key", "label"): continue
            ty, _ = col_type(e, f); cols.append(f"{f['name']} {ty}")
        cols.append("created_at timestamptz not null default now()"); cols.append("updated_at timestamptz not null default now()")
        return t, [f"create table if not exists {t} (\n  " + ",\n  ".join(cols) + "\n);"]
    cols.append("id uuid primary key default gen_random_uuid()")
    if tenant:
        ops = any((f.get("note") or "").startswith("tenant_id＝運営") for f in fields)
        cols.append(f"tenant_id uuid not null references {a.tenants_table}(id)" + (" default app.ops_tenant_id()" if ops else ""))
        idx.append(f"create index if not exists {t}_tenant_idx on {t} (tenant_id);")
    if scoped:
        cols.append(f"scope_id uuid not null references {a.scopes_table}(id)"); idx.append(f"create index if not exists {t}_scope_idx on {t} (tenant_id, scope_id);")
    if "<versioned>" in names: cols.append("version int not null default 1")
    uniq: list[str] = []
    parent_fk = None
    for f in fields:
        n = f["name"]
        if n.startswith("<") or n == "tenant_id": continue
        ty, ref = col_type(e, f)
        notnull = ""
        if n == "key": notnull = " not null"; uniq.append("(tenant_id, key)" if tenant and "definition_id" not in names else ("(definition_id, key)" if "definition_id" in names else ""))
        if n == "label" or n == "version": notnull = " not null"
        if ref:
            rt, rc = ref.split("(")[0], ref.split("(")[1].rstrip(")")
            if rt in existing or rt in new_names or rt == t:
                cols.append(f"{n} {ty}{notnull} references {rt}({rc})")
            else:
                cols.append(f"{n} {ty}{notnull} /* FK → {rt}({rc}) は {rt} を作る migration で足す */")
            if ty == "uuid" and rt != t: idx.append(f"create index if not exists {t}_{n}_idx on {t} ({n});")
            if parent_fk is None and not tenant and ty == "uuid": parent_fk = n
        else:
            cols.append(f"{n} {ty}{notnull}")
    if "version" in names and parent_fk: uniq.append(f"({parent_fk}, version)")
    if "version" in names and tenant:
        pf = next((f["name"] for f in fields if f["name"].endswith("_id") and f["name"] != "tenant_id"), None)
        if pf: uniq.append(f"({pf}, version)")
    cols.append("created_at timestamptz not null default now()"); cols.append("updated_at timestamptz not null default now()")
    if tenant: cols.append("created_by uuid"); cols.append("updated_by uuid")
    if e.get("soft_delete"): cols.append("deleted_at timestamptz")
    for u in [u for u in uniq if u]: cols.append(f"unique {u}")
    out = [f"create table if not exists {t} (\n  " + ",\n  ".join(cols) + "\n);"] + idx
    out.append(f"drop trigger if exists {t}_updated_at on {t}; create trigger {t}_updated_at before update on {t} for each row execute function {a.updated_at_fn};")
    if tenant: out.append(f"insert into {a.target_kinds_table} (key, label) values ('{t}', '{e.get('name', t)}') on conflict do nothing;")
    return t, out

# 依存順（FK の先を先に）
def deps(e) -> set[str]:
    d = set()
    for f in e["fields"]:
        if f["name"].startswith("<"): continue
        ty, ref = col_type(e, f)
        if ref:
            rt = ref.split("(")[0]
            if rt in new_names and rt != e["table_name"]: d.add(rt)
    return d
order: list = []; pending = {e["table_name"]: e for e in targets}
while pending:
    ready = [n for n, e in pending.items() if not (deps(e) & set(pending))]
    if not ready: ready = [sorted(pending)[0]]  # 循環は名前順で切る（FK は後から）
    for n in sorted(ready): order.append(pending.pop(n))

lines = [f"-- {Path(a.o).name}{'：' + a.title if a.title else ''}。正本 {a.entities}（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）", ""]
for e in order:
    t, sql = ddl_for(e)
    lines.append(f"-- {e['id']} {t}（{e['section']}）"); lines += sql; lines.append("")
# 先の migration の表 → 今回の表への FK を後から足す
late: list[str] = []
for e in ents:
    t = e["table_name"]
    if t not in existing: continue
    for f in e["fields"]:
        if f["name"].startswith("<"): continue
        ty, ref = col_type(e, f)
        if ref and ref.split("(")[0] in new_names and ty == "uuid":
            rt = ref.split("(")[0]
            late.append(f"do $$ begin if not exists (select 1 from pg_constraint where conname = '{t}_{f['name']}_fkey') and exists (select 1 from information_schema.columns where table_name = '{t}' and column_name = '{f['name']}' and data_type = 'uuid') then alter table {t} add constraint {t}_{f['name']}_fkey foreign key ({f['name']}) references {rt}(id); end if; end $$;")
if late: lines.append("-- 先に作った表から今回の表への FK"); lines += late; lines.append("")
lines.append(f"grant select, insert, update, delete on {', '.join(e['table_name'] for e in order)} to {a.app_role};")
lines.append(f"insert into {a.migrations_table} (name) values ('{Path(a.o).name}') on conflict do nothing;")
Path(a.o).write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{a.o}: {len(order)} tables ({', '.join(e['table_name'] for e in order)})" + (f" / late FK {len(late)}" if late else ""))
