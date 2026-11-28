# errors.d（K-325）
表に足す分はチケットごとに K-<番号>.json（errors・classes のリスト）に書く。前からの中身は _base.json。
足し合わせは python3 scripts/ci/build_registries.py。同じ id を 2 つのファイルが持てば止まる。
