#!/usr/bin/env python3
"""gen_rls.py — 07_functional/entities.json の access_control_policies から RLS の SQL を機械生成する（手で書かない＝仕様と実装のずれを作らない）。
使い方: python3 scripts/ci/gen_rls.py --tables tenants scopes ... -o packages/db/policies/0002_access_control.sql
 role: member → app.role() in ('member', 'owner') 相当（= 会社の人。権限の差は predicate の has_permission が持つ）／ ops → app.role() = 'ops'／ authenticated → 誰でも（ログイン済み）
 operation 'insert,update,delete' → INSERT(WITH CHECK)・UPDATE(USING+WITH CHECK)・DELETE(USING) の 3 本。select → SELECT(USING)"""
import argparse, json, re
ap = argparse.ArgumentParser(); ap.add_argument("--entities", default="07_functional/entities.json"); ap.add_argument("--tables", nargs="+", required=True); ap.add_argument("-o", required=True); ap.add_argument("--grant-table", default="support_access_grants", help="運営への許可の表（policy から直接引くと再帰するので関数に寄せる）"); ap.add_argument("--grant-fn", default="app.ops_grant_ok"); ap.add_argument("--member-fn", default="app.member_ok"); ap.add_argument("--tenant-fn", default="app.tenant_id()"); ap.add_argument("--user-fn", default="app.user_id()"); a = ap.parse_args()
EN = json.load(open(a.entities, encoding="utf-8")); EN = EN.get("entities") or EN["items"]; by = {e["table_name"]: e for e in EN}
out = ["-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）", ""]
for tb in a.tables:
    e = by[tb]; out += [f"alter table {tb} enable row level security;", f"alter table {tb} force row level security;"]
    for p in e["access_control_policies"]:
        pred = p["predicate"]; ops = [x.strip() for x in p["operation"].split(",")]
        # 文脈が無いとき（SET LOCAL を飛ばした要求）は '' が入るので、::uuid の直キャストは落ちる → null 安全な関数に寄せる（意味は同じ）
        pred = pred.replace("current_setting('app.tenant_id', true)::uuid", a.tenant_fn).replace("current_setting('app.user_id', true)::uuid", a.user_fn)
        # 役の柵：member の policy は運営（app.role='ops'）には効かせない（運営は grant の policy だけ）。authenticated は app.user_id が入っていること
        if p["role"] == "member": pred = f"{a.member_fn}() AND ({pred})"   # 会社の人：app.user_id がその app.tenant_id のメンバーであること（SET LOCAL を別テナントにしても 0 行・G-02）
        elif p["role"] == "ops":
            # 運営の grant 検査は policy の中で support_access_grants を直接引くと自分の policy に再帰する → security definer の関数に寄せる（意味は entities.json と同じ）
            pred = re.sub(r"current_setting\('app\.role', true\) = 'ops' AND EXISTS \(SELECT 1 FROM " + re.escape(a.grant_table) + r" g WHERE g\.tenant_id = (\w+)\.tenant_id AND g\.expires_at > now\(\) AND g\.revoked_at IS NULL\)", r"app.ops_grant_ok(\1.tenant_id)", pred)
        elif p["role"] == "authenticated": pred = f"coalesce(current_setting('app.user_id', true), '') <> '' AND ({pred})"
        for op in ops:
            name = f"{p['name']}_{op}" if len(ops) > 1 else p["name"]; out.append(f"drop policy if exists {name} on {tb};")
            if op == "select": out.append(f"create policy {name} on {tb} for select using ({pred});")
            elif op == "insert": out.append(f"create policy {name} on {tb} for insert with check ({pred});")
            elif op == "update": out.append(f"create policy {name} on {tb} for update using ({pred}) with check ({pred});")
            elif op == "delete": out.append(f"create policy {name} on {tb} for delete using ({pred});")
    out.append("")
open(a.o, "w", encoding="utf-8").write("\n".join(out)); print(f"{a.o}: {len(a.tables)} tables / {sum(len(by[t]['access_control_policies']) for t in a.tables)} policies")
