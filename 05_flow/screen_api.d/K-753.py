# K-753 分身の今を読む口（getMyClone・getCloneNow）の答えの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/clone-room/（DB の関数 app.clone_me・app.clone_now・20261125023300）。
#   getCloneNow の答え（CloneNow）と 2 つの口の使う表の欄・PERMS は本体 05_flow/screen_api.py の前からある行を直した（同じ鍵を 2 つのファイルが持てない）
RESPONSES = {
    # 部屋の頭（鍵ちょうど 4）：呼ばれたい名前（無ければ表示の名前）・表示の名前・いつから（日本の日付）・PC（state と label）
    "getMyClone": ("MyClone", {"name": "string", "full_name": "string", "since": "string", "pc": "object"}),
}
