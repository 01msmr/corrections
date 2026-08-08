# Hybrid-Ressort „Neue Korrektur“ — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** „Neue Korrektur“ führt Betreiber (Cookie nach Admin-Besuch) mit paper-plane-Icon zum Formular, Besucher mit envelope-open-text-Icon in ein vorbefülltes mailto.

**Architecture:** Cookie-Middleware in `auth.ts`, Verdrahtung in `app.ts`, Weiche serverseitig im `Layout`; Icons als inline SVG. Spec: `docs/superpowers/specs/2026-08-08-hybrid-neue-korrektur-design.md`.

**Tech Stack:** Hono (basic-auth, cookie-Helfer), Hono-JSX, Vitest.

## Global Constraints

- TypeScript strict; keine Webfonts; keine Farbliterale außerhalb `constants.ts` (`currentColor` ist erlaubt).
- Keine Adressen im Repo — `MAIL_FROM` kommt zur Laufzeit aus der Umgebung.
- Testaufrufe vom Repo-Stamm: `pnpm exec vitest run <pfad>`.

---

### Task 1: Cookie-Erkennung + Weiche + Icons (ein zusammenhängender Schnitt)

**Files:**
- Modify: `packages/api/src/auth.ts`
- Modify: `packages/api/src/app.ts` (Middleware-Registrierung Zeilen 29–33, `setzeHinweisMailto` im `createApp`)
- Modify: `packages/api/src/views/layout.tsx` (Props, Nav-Link, SVG-Komponenten, `.navicon`-CSS, Modulzustand)
- Modify: `packages/api/src/views/capture.tsx` (3× `<Layout … betreiber>`), `packages/api/src/views/outlets.tsx` (2×), `packages/api/src/views/errorTypes.tsx` (2×), `packages/api/src/views/backfill.tsx` (1×)
- Modify: `packages/api/src/views/bilanz.tsx`, `packages/api/src/views/ueber.tsx` (Prop `betreiber?: boolean` durchreichen)
- Modify: `packages/api/src/routes/bilanz.tsx`, `packages/api/src/routes/ueber.tsx` (`istBetreiber(c)` übergeben)
- Test: `packages/api/src/app.test.ts`

**Interfaces:**
- Produces (`auth.ts`): `betreiberErkennung(): MiddlewareHandler` — setzt nach `next()` bei `c.res.status < 400` das Cookie `betreiber=1` (`path:"/"`, `httpOnly`, `sameSite:"Lax"`, `maxAge: 31_536_000`); `istBetreiber(c: Context): boolean`.
- Produces (`layout.tsx`): `setzeHinweisMailto(mailFrom: string): void`; `Layout` akzeptiert zusätzlich `betreiber?: boolean` (Vorgabe false; ohne gesetzten Modulzustand fällt das mailto auf `"mailto:"` zurück).

- [ ] **Step 1: Failing Tests in `app.test.ts`** (ans Datei-Ende, nutzt vorhandenes `app()` und `AUTH`):

```ts
describe("Hybrid-Ressort Neue Korrektur", () => {
  it("setzt das Betreiber-Cookie nur nach erfolgreichem Admin-Zugriff", async () => {
    const a = app();
    const abgewiesen = await a.request("/neu");
    expect(abgewiesen.headers.get("set-cookie")).toBeNull();
    const erlaubt = await a.request("/neu", { headers: { authorization: AUTH } });
    expect(erlaubt.headers.get("set-cookie")).toContain("betreiber=1");
  });

  it("zeigt Besuchern das mailto-Geruest, Betreibern den Formular-Link", async () => {
    const a = app();
    const besucher = await (await a.request("/bilanz")).text();
    expect(besucher).toContain(`mailto:${ENV.MAIL_FROM}?subject=Korrekturhinweis`);
    expect(besucher).toContain(encodeURIComponent("Artikel-URL:"));
    expect(besucher).not.toContain('href="/neu"');
    const betreiber = await (
      await a.request("/bilanz", { headers: { cookie: "betreiber=1" } })
    ).text();
    expect(betreiber).toContain('href="/neu"');
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run packages/api/src/app.test.ts` → FAIL (kein Set-Cookie, kein mailto).

- [ ] **Step 3: `auth.ts` erweitern**

```ts
import { getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";

/** Bequemlichkeits-Weiche, keine Sicherheit: Wer das Cookie faelscht, sieht
 *  nur den Passwort-Dialog des Formulars. Deshalb genuegt ein fester Wert. */
const BETREIBER_COOKIE = "betreiber";

export function betreiberErkennung(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (c.res.status < 400) {
      setCookie(c, BETREIBER_COOKIE, "1", {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        /* Ohne Secure: lokale Entwicklung laeuft ueber http. */
        maxAge: 31_536_000,
      });
    }
  };
}

export function istBetreiber(c: Context): boolean {
  return getCookie(c, BETREIBER_COOKIE) === "1";
}
```

- [ ] **Step 4: `app.ts`** — vor den `adminAuth`-Zeilen dieselben Pfade mit `betreiberErkennung()` belegen (Reihenfolge: Erkennung zuerst registriert, damit ihr `next()` die Auth umschließt und 401 kein Cookie bekommt); im `createApp` früh `setzeHinweisMailto(options.env.MAIL_FROM);` aufrufen. Importe ergänzen.

- [ ] **Step 5: `layout.tsx`** — Modulzustand + Icons + Weiche:

```tsx
/* Ziel des Besucher-Ressorts: mailto an MAIL_FROM mit Betreff und Geruest.
   Wird beim App-Bau gesetzt; der Fallback haelt direkt gerenderte Views
   (Tests) funktionsfaehig. */
let HINWEIS_MAILTO = "mailto:";
export function setzeHinweisMailto(mailFrom: string): void {
  const geruest = "Artikel-URL: \r\nZitat (falsche Stelle): \r\nVorschlag: \r\nAnmerkung: \r\n";
  HINWEIS_MAILTO = `mailto:${mailFrom}?subject=${encodeURIComponent("Korrekturhinweis")}&body=${encodeURIComponent(geruest)}`;
}

/* Font Awesome Free 6 (fontawesome.com — CC BY 4.0); Pfade unveraendert,
   als inline SVG statt Webfont (Projektregel: keine Webfonts). */
const PapierfliegerIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 512 512" aria-hidden="true">
    <path fill="currentColor" d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3.3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z" />
  </svg>
);
const HinweisbriefIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 512 512" aria-hidden="true">
    <path fill="currentColor" d="M215.4 96H144 107.8 96v8.8V144v40.4V273L.2 202.5c1.6-18.1 10.9-34.9 25.7-45.8L48 140.3V96c0-26.5 21.5-48 48-48h76.6l49.9-36.9C232.2 3.9 243.9 0 256 0s23.8 3.9 33.5 11L339.4 48H416c26.5 0 48 21.5 48 48v44.3l22.1 16.4c14.8 10.9 24.1 27.7 25.7 45.8L416 273V184.4 144 104.8 96h-11.8H368 296.6 256 215.4zM0 448V242.1L217.6 403.3c11.1 8.2 24.6 12.7 38.4 12.7s27.3-4.4 38.4-12.7L512 242.1V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64zM176 160h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64h160c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16z" />
  </svg>
);
```

Layout-Signatur um `betreiber?: boolean` erweitern; der Ressort-Link wird zur Weiche:

```tsx
            {betreiber ? (
              <a href="/neu" aria-current={aktiv === "neu" ? "page" : undefined} draggable={false}>
                <PapierfliegerIcon /> Neue Korrektur
              </a>
            ) : (
              <a href={HINWEIS_MAILTO} draggable={false}>
                <HinweisbriefIcon /> Neue Korrektur
              </a>
            )}
```

CSS neben den `nav a`-Regeln: `.navicon { width: .85em; height: .85em; margin-right: .4em; vertical-align: -.06em; }`

- [ ] **Step 6: Views/Routen verdrahten** — `capture`/`outlets`/`errorTypes`/`backfill`: `betreiber` statisch an `<Layout>` (hinter der Auth ist jeder Betrachter Betreiber). `BilanzSeite`/`UeberSeite`: Prop `betreiber?: boolean` annehmen und an `Layout` reichen; `routes/bilanz.tsx` und `routes/ueber.tsx` übergeben `istBetreiber(c)`.

- [ ] **Step 7:** `pnpm exec vitest run packages/api/src/app.test.ts` → PASS; dann `pnpm test && pnpm typecheck && pnpm lint` → alles grün (288 Tests).

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/auth.ts packages/api/src/app.ts packages/api/src/views packages/api/src/routes packages/api/src/app.test.ts
git commit -m "Hybrid-Ressort 'Neue Korrektur': Formular fuer Betreiber, mailto fuer Besucher

Cookie nach Admin-Besuch schaltet die Weiche (Bequemlichkeit, keine
Sicherheit); Besucher bekommen ein mailto an MAIL_FROM mit Geruest.
Icons als inline SVG (FA Free, CC BY 4.0): paper-plane / envelope-open-text.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Sichtkontrolle

- [ ] **Step 1:** Dev-Server starten, `/bilanz` ohne Cookie (Besucher-Ansicht: Brief-Icon, mailto) und mit Cookie (paper-plane, `/neu`) screenshotten; Icon-Formen prüfen (SVG-Pfade aus dem Gedächtnis → Sichtprüfung zwingend).
- [ ] **Step 2:** Abnahme durch den Betreiber; push erst auf Zuruf.
