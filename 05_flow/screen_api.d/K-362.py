# K-362 PC を外す口（revokeMyDevice・DELETE /api/v1/bridge/devices/:id・体は受けない）
# 答えは外した PC の 4 つだけ（今の答えの Sessions は外に見せない列を持つ・K-362 の切る段の決め）。device_label は空のこともある。revoked_at は外した答えでは必ず入るが、同じ名前の列 sessions.revoked_at が null 可なので契約も null 可（契約の形の検査 K144-SHAPE-013）
RESPONSES = {
    "revokeMyDevice": ("RevokedDevice", {"id": "string", "device_label": "string?", "revoked_at": "string?", "revoke_reason": "string"}),
}
