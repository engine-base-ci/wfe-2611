import { migrateAuth } from "./migrate.js";
const app = process.env["DATABASE_URL"] ?? "";
if (!app) {
  console.error("DATABASE_URL が無い");
  process.exit(1);
}
migrateAuth(app).then(
  (t) => {
    console.log(`auth の表 ${t.length ? "作成 " + t.join(", ") : "済み"}`);
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
