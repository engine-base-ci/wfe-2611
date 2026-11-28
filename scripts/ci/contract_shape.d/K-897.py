# K-897 PC の側が案を返す口（reportClientRequestDraft）の契約の形の表に足す分（K-325 の断片）
#   draft か failed のちょうど 1 つ（INPUT_RULES の oneOf で契約に書いた）。案の中の形・長さ・日付と failed の長さは口の parse が 422 で断る（K897-API-002・004）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "reportClientRequestDraft": "draft か failed のどちらか 1 つ（どちらが要るかは oneOf で書いた）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
