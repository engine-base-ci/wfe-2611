"""colrules.py — 列の型と参照（FK）を 名前の語尾・備考・関係 から決める規則。gen_ddl.py（DDL）と 05_flow/build_api.py（OpenAPI の型）が同じ規則を使う（DB と契約がずれない）。
プロジェクトで決める分（alias・vector の次元）は 03_architecture/colrules.json。"""
import json, re
from pathlib import Path

MEMBER_COLS = re.compile(r"(^|_)(member_id|requested_by|changed_by|released_by|approved_by|decided_by|applied_by|published_by|disabled_by|recorded_by|assignee_id)$")
POLY = {"origin", "subject", "target", "source_ref", "template", "options_master", "provisioning"}  # 多態・外の参照：uuid・FK なし
ENUMISH = {"kind", "status", "mode", "verdict", "disposition", "visibility", "type", "format", "channel", "component", "state", "method", "role", "reason", "strategy", "value_type", "data_type"}
INT_SUFFIX = ("_minutes", "_count", "order_no", "decimals", "version", "current_version", "version_in_use", "tokens_in", "tokens_out", "run_count", "fail_count", "avg_ms")
NUMERIC = {"amount", "value", "limit_value", "target_value", "allocated_value", "measured_value", "price_monthly", "cost", "confidence", "expected_effect"}
DATE_NAMES = {"period_start", "period_end", "planned_for", "retain_until"}

def load_rules(path="03_architecture/colrules.json"):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"aliases": {}, "vector_dim": 1536}

def singular(t: str) -> str:
    if t.endswith("ies"): return t[:-3] + "y"
    if t.endswith("ses"): return t[:-2] + "is"
    if t.endswith("s"): return t[:-1]
    return t

def is_master(e) -> bool:
    names = [f["name"] for f in e["fields"]]
    return e["tenant_isolation"]["type"] == "none" and "key" in names and not any(n.startswith("<") for n in names)

def has_tenant(e) -> bool:
    return e["tenant_isolation"]["type"] != "none" or any(f["name"] == "tenant_id" for f in e["fields"])

class Rules:
    def __init__(self, entities, aliases=None, vector_dim=1536, members_table="members"):
        self.by_table = {e["table_name"]: e for e in entities}
        self.aliases = aliases or {}
        self.vector_dim = vector_dim
        self.members = members_table

    def resolve_fk(self, e, col: str):
        """*_id → (型, (表, 列) or None)。None＝引けない"""
        t = e["table_name"]; stem = col[:-3]
        if col == "parent_id": return "uuid", (t, "id")
        if MEMBER_COLS.search(col) or MEMBER_COLS.search(stem) or col.endswith("ops_member_id"): return "uuid", (self.members, "id")
        # 表の名前そのものに当たるなら、それが先（別名の「_event → account_events」に bridge_job_event_id を取られた・2026-09-27）
        exact = next((tb for tb in self.by_table if singular(tb) == stem), None)
        if exact and not is_master(self.by_table[exact]) and stem not in self.aliases: return "uuid", (exact, "id")
        for k, v in self.aliases.items():
            if stem == k or stem.endswith("_" + k):
                if v == "text": return "text", None
                return ("text", (v, "key")) if is_master(self.by_table[v]) else ("uuid", (v, "id"))
        last = stem.split("_")[-1]
        if last in POLY or stem in POLY: return "uuid", None
        if last in ENUMISH or stem in ENUMISH:
            own = f"{singular(t)}_{stem}s"
            if own in self.by_table: return "text", (own, "key")
            if f"{stem}s" in self.by_table and is_master(self.by_table[f"{stem}s"]): return "text", (f"{stem}s", "key")
            rel_m = [r["to"] for r in e.get("relations", []) if "to" in r and r["to"].endswith(f"_{stem}s") and r["to"] in self.by_table and is_master(self.by_table[r["to"]])]
            if len(rel_m) == 1: return "text", (rel_m[0], "key")
            return "text", None
        rel_targets = [r["to"] for r in e.get("relations", []) if "to" in r]
        cands = list(dict.fromkeys(rel_targets + list(self.by_table)))
        def score(tb: str) -> int:
            s = singular(tb)
            if s == stem or tb == stem: return 4
            if s.endswith("_" + stem): return 2
            if stem.endswith("_" + s) or (stem.endswith(s) and s != stem): return 1
            return 0
        best = max(cands, key=lambda tb: (score(tb), tb.split("_")[0] == t.split("_")[0], tb in rel_targets), default=None)
        if best and score(best) > 0:
            te = self.by_table[best]
            return ("text", (best, "key")) if is_master(te) else ("uuid", (best, "id"))
        return None

    def col_type(self, e, f):
        """→ (pg の型, 参照 'table(col)' or None)"""
        n, note = f["name"], (f.get("note") or "")
        m = re.match(r"(jsonb|uuid\[\]|text\[\]|date|numeric\(\d+,\d+|vector\(N|int|bigint|boolean|timestamptz)", note)
        if m:
            ty = m.group(1)
            if ty.startswith("numeric("): ty += ")"
            if ty == "vector(N": ty = f"vector({self.vector_dim})"
            return ty, None
        if n.endswith("_ids"): return "uuid[]", None
        if n.endswith("_id") or MEMBER_COLS.search(n):
            r = self.resolve_fk(e, n if n.endswith("_id") else n + "_id")
            if r: return r[0], (f"{r[1][0]}({r[1][1]})" if r[1] else None)
            if "／" in note or n[:-3].split("_")[-1] in ENUMISH: return "text", None
            return "uuid", None
        if n.endswith("_at") or n in ("blocked_since",): return "timestamptz", None
        if n.endswith("_on") or n.endswith("_date") or n in DATE_NAMES: return "date", None
        if n.endswith(INT_SUFFIX): return "int", None
        if n == "size": return "bigint", None
        if n in NUMERIC: return "numeric", None
        if n.startswith("is_") or n in ("enabled", "required", "locked") or n.endswith("_enabled"): return "boolean", None
        return "text", None

def openapi_of(pg_type: str) -> dict:
    """pg の型 → OpenAPI の schema（契約と DB を同じ規則で）"""
    if pg_type == "uuid": return {"type": "string", "format": "uuid"}
    if pg_type == "timestamptz": return {"type": "string", "format": "date-time"}
    if pg_type == "date": return {"type": "string", "format": "date"}
    if pg_type in ("int", "bigint"): return {"type": "integer"}
    if pg_type.startswith("numeric"): return {"type": "number"}
    if pg_type == "boolean": return {"type": "boolean"}
    if pg_type == "jsonb": return {"type": "object", "additionalProperties": True}
    if pg_type == "uuid[]": return {"type": "array", "items": {"type": "string", "format": "uuid"}}
    if pg_type == "text[]": return {"type": "array", "items": {"type": "string"}}
    if pg_type.startswith("vector"): return {"type": "array", "items": {"type": "number"}}
    return {"type": "string"}
