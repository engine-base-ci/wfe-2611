# ears-elsewhere.d（K-325）
表に足す分はチケットごとに K-<番号>.json（ops の鍵）に書く。前からの中身は _base.json。
足し合わせは python3 scripts/ci/build_registries.py。同じ ops の鍵を 2 つのファイルが持てば止まる。
