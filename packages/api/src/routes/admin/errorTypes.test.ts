import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { DEFAULT_ERROR_TYPES, seed } from "../../db/seed.js";
import { getErrorTypeByKey, listErrorTypes } from "../../repo/errorTypes.js";
import { errorTypeAdminRoutes } from "./errorTypes.js";

const NOW = 1_800_000_000;
let db: Db;

function post(path: string, fields: Record<string, string>) {
  return errorTypeAdminRoutes(db, () => NOW).request(path, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
});

describe("Adminoberfläche Fehlerarten", () => {
  it("listet die geseedeten Fehlerarten", async () => {
    const html = await (await errorTypeAdminRoutes(db, () => NOW).request("/admin/fehlerarten")).text();
    expect(html).toContain("ein Komma fehlt");
    expect(html).toContain("Buchstabendreher");
  });

  it("legt eine neue Fehlerart an", async () => {
    const res = await post("/admin/fehlerarten", {
      key: "falschzitat",
      label: "ein Falschzitat",
      description: "Zitat unzutreffend oder sinnentstellend.",
      sortOrder: "130",
    });
    expect(res.status).toBe(302);
    expect(getErrorTypeByKey(db, "falschzitat")?.label).toBe("ein Falschzitat");
  });

  it("weist einen Schlüssel mit Leerzeichen ab", async () => {
    const res = await post("/admin/fehlerarten", {
      key: "Toter Link",
      label: "Toter Link",
      description: "",
      sortOrder: "130",
    });
    expect(res.status).toBe(400);
    expect(listErrorTypes(db)).toHaveLength(DEFAULT_ERROR_TYPES.length);
  });

  it("meldet einen bereits vergebenen Schlüssel", async () => {
    const res = await post("/admin/fehlerarten", {
      key: "falsche_zahl",
      label: "Noch eine Zahl",
      description: "",
      sortOrder: "200",
    });
    expect(res.status).toBe(400);
    expect(listErrorTypes(db)).toHaveLength(DEFAULT_ERROR_TYPES.length);
  });

  it("bietet den Schlüssel beim Bearbeiten nicht als Eingabefeld an", async () => {
    const id = getErrorTypeByKey(db, "falsche_zahl")?.id ?? "";
    const html = await (await errorTypeAdminRoutes(db, () => NOW).request(`/admin/fehlerarten/${id}`)).text();
    expect(html).not.toContain('name="key"');
    expect(html).toContain("falsche_zahl");
  });

  it("ändert Bezeichnung und Reihenfolge", async () => {
    const id = getErrorTypeByKey(db, "falsche_zahl")?.id ?? "";
    await post(`/admin/fehlerarten/${id}`, {
      label: "Zahlendreher",
      description: "Zahl falsch wiedergegeben.",
      sortOrder: "5",
    });
    const updated = getErrorTypeByKey(db, "falsche_zahl");
    expect(updated?.label).toBe("Zahlendreher");
    expect(updated?.sortOrder).toBe(5);
  });

  it("löscht eine unbenutzte Fehlerart und meldet das zurück", async () => {
    const id = getErrorTypeByKey(db, "falsche_zahl")?.id ?? "";
    const res = await post(`/admin/fehlerarten/${id}/loeschen`, {});
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("geloescht");
    expect(listErrorTypes(db)).toHaveLength(DEFAULT_ERROR_TYPES.length - 1);
    expect(listErrorTypes(db, { includeArchived: true })).toHaveLength(DEFAULT_ERROR_TYPES.length - 1);
  });
});
