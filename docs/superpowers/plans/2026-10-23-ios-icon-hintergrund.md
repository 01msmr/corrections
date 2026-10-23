# Plan: iOS-Icon, Hintergrund folgt Hell/Dunkel

Stand 23.10.2026. Ziel: Der Grund hinter dem K-Motiv im Startbildschirm-Icon (iOS-PWA) wird nach dem Hinzufügen von iOS selbst je nach Modus gefüllt, wie bei a.msmr.co und msmr.dev.

## Befund

- `APPLE_TOUCH_ICON` (180 px) ist deckend und hat den Grund `PALETTE.papier` (`#f7f7f4`), fast weiß. Bei msmr.dev blieb ein reinweißer Grund in beiden Modi weiß.
- Was dort funktioniert hat: ein **deckendes hellgraues** Icon (`#e6e6e9`, RGB-PNG, ohne Alpha), eingebettet als **`data:`-URI** im `apple-touch-icon`-Link. Ein zweites Icon, ein transparenter Grund, ein Skript und `media` am Link helfen auf iOS nicht (`media` wird ignoriert, Transparenz wird immer schwarz gefüllt).
- Das Icon wird beim Hinzufügen festgelegt. Eine bestehende Verknüpfung ändert sich nicht, sie muss neu hinzugefügt werden.

## Schritte (auf dem Mac, in VS Code: der Generator braucht „Bodoni 72“)

1. `packages/shared/src/constants.ts`: `PALETTE` bekommt `iosGrund: "#e6e6e9"` mit Kommentar (deckendes helles Grau, iOS füllt es je nach Modus selbst; reines Weiß blieb weiß). Dann `pnpm --filter @korrektur/shared build`.
2. `tools/iconsErzeugen.py`: `zeichne()` bekommt einen Parameter für den Grund (Vorgabe `papier`). Das Apple-Icon wird mit `iosGrund` gezeichnet: `als_png(zeichne(180, farben, "iosGrund"))`. Die übrigen Icons (192, 512, Favicon, SVG) bleiben auf `papier`.
3. `python3 tools/iconsErzeugen.py` ausführen. Das schreibt `packages/api/src/views/icons.ts` neu (nur `APPLE_TOUCH_ICON` ändert sich). Ergebnis ansehen: K und Rotstrich unverändert, nur der Grund ist grau.
4. `packages/api/src/views/layout.tsx`: `APPLE_TOUCH_ICON` aus `./icons.js` importieren und den Link auf `href={"data:image/png;base64," + APPLE_TOUCH_ICON}` setzen. Der Grund für `data:`: Der „Zum Home-Bildschirm“-Dialog von iOS 27.2 lädt das Icon laut a.msmr.co nicht von einer URL. Die Route `/apple-touch-icon.png` (und `-precomposed`) bleibt als Rückfall bestehen.
5. `packages/api/src/app.test.ts`: Test, dass eine öffentliche Seite (z. B. `/hinweis`) genau einen `apple-touch-icon`-Link mit `data:image/png;base64,` enthält. Die Route-Tests unter „Icons und Manifest“ bleiben.
6. `pnpm test`, `pnpm typecheck`, `pnpm lint`.
7. Bundle bauen, ausliefern, Icon auf dem iPhone **neu** zum Home-Bildschirm hinzufügen, Hell- und Dunkelmodus prüfen.

## Nicht tun

- Kein Rand um den Buchstaben, kein zweites Icon, kein Skript, keine Transparenz (alles in a.msmr.co und msmr.dev versucht und verworfen).
- Manifest-Icons (Android, `icon-192/512`, maskable) und Favicon bleiben unverändert.

## Falls der Grund trotzdem hell bleibt

Als Nächstes einen weißen Rand um das Motiv testen, wie bei a.msmr.co: Er trennt für iOS Vorder- und Hintergrund. Das ist der zweite Versuch, nicht der erste.
