import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("GET /healthz", () => {
  it("antwortet mit 200 und Status ok", async () => {
    const app = createApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});
