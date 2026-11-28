# K-744 差し戻しの「次は誰が直すか」（returnApproval の next_actor）
#   値は clone（既定・AI が作り直す）か self（自分で直す・作り直しの仕事を積まない）。入口は enum を読まないので、422 にするのは口（decide.ts）
VALUE_RANGES = {
    "returnApproval": {"next_actor": {"enum": ["clone", "self"]}},
}
