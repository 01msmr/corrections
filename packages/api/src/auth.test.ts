import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { adminAuth } from "./auth.js";
import type { Env } from "./env.js";

const ENV = {
  PORT: 3000,
  DATABASE_PATH: ":memory:",
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: "geheimes-passwort",
  PUBLIC_BASE_URL: "https://korrekturen.msmr.co",
  SMTP_HOST: "mail.example.tld",
  SMTP_PORT: 587,
  SMTP_USER: "korrektur@example.tld",
  SMTP_PASSWORD: "x",
  MAIL_FROM: "korrektur@example.tld",
} satisfies Env;

function app() {
  const instance = new Hono();
  instance.use("/geschuetzt/*", adminAuth(ENV));
  instance.get("/geschuetzt/x", (c) => c.text("ok"));
  return instance;
}

function header(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

describe("adminAuth", () => {
  it("verlangt ohne Anmeldung eine Authentifizierung", async () => {
    const res = await app().request("/geschuetzt/x");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Basic");
  });

  it("weist falsche Zugangsdaten ab", async () => {
    const res = await app().request("/geschuetzt/x", {
      headers: { authorization: header("admin", "falsch") },
    });
    expect(res.status).toBe(401);
  });

  it("lässt korrekte Zugangsdaten durch", async () => {
    const res = await app().request("/geschuetzt/x", {
      headers: { authorization: header("admin", "geheimes-passwort") },
    });
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("ok");
  });
});
