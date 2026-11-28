#!/usr/bin/env bash
# JIT：tickets.json から 1 タスクの CLAUDE.md を生成して Claude Code を起動する。--preview で標準出力に出すだけ。
set -e; cd "$(dirname "$0")/../.."
PREVIEW=0; [ "$1" = "--preview" ] && { PREVIEW=1; shift; }
TID="$1"; [ -n "$TID" ] || { echo "usage: dispatch.sh [--preview] T-xx-nn"; exit 1; }
OUT=$(${PYTHON:-python3} - "$TID" <<'PY'
import json, sys, pathlib
tid = sys.argv[1]; J = json.load(open("07_tasks/tickets.json", encoding="utf-8")); t = next((x for x in J["tasks"] if x["id"] == tid), None)
if not t: sys.exit(f"無いタスク {tid}")
tpl = pathlib.Path("09_dispatch/CLAUDE.md.template").read_text(encoding="utf-8")
def L(xs): return "\n".join(f"- {x}" for x in xs) or "- —"
fc = t["files_changed_predicted"]
out = tpl.format(id=t["id"], title=t["title"], group=t["group"], layer=t["deliverable_layer"], wave=t["wave"], hours_h=t["estimate_hours_human"], hours_ai=t["wall_clock_h_ai"],
   acts=" ".join(t["acts"]) or "—", screens=" ".join(t["screen_ids"]) or "—", entities=" ".join(t["entity_ids"]) or "—", chokes=" ".join(t["choke_points"]) or "—（" + t["choke_points_rationale"] + "）",
   depends=" ".join(t["depends_on"]) or "—", decisions="\n".join(f"- {d['id']}「{d['summary']}」" for d in t["decision_summaries"]) or "- —",
   new=L(fc["new"]), modify=L(fc["modify"]), shared=L(fc["shared_read"]), forbidden=L(fc["forbidden"]), forbidden_apis=L(t["forbidden_direct_apis_reminder"]),
   t1=L(t["acceptance_criteria_inline"]["tier_1_structural"]), t2=L(x["text"] for x in t["acceptance_criteria_inline"]["tier_2_functional"]), t3=L(t["acceptance_criteria_inline"]["tier_3_regression"]),
   scenarios="\n".join(f"- {s['name']}：{' → '.join(s['steps'])} ⇒ {s['expected']}" for s in t["test_scenarios_inline"]), l1=" ".join(t["qa_rows"]["l1"][:40]) + (" …" if len(t["qa_rows"]["l1"]) > 40 else ""), l2=" ".join(t["qa_rows"]["l2_flows"]) or "—", spec=L(t["spec_links"]), audit=t["audit_md_path"])
print(out)
PY
)
if [ "$PREVIEW" = 1 ]; then echo "$OUT"; exit 0; fi
D=/tmp/kaname-dispatch-$TID; mkdir -p "$D"; echo "$OUT" > "$D/CLAUDE.md"; echo "生成: $D/CLAUDE.md"; (cd "$D" && claude)
