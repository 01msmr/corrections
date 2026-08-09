#!/usr/bin/env python3
"""Erzeugt die Anwendungs-Icons aus dem Motiv der Wortmarke.

Aufruf (aus dem Repo-Stamm):

    python3 tools/iconsErzeugen.py

Das Motiv: das **K** der Wortmarke in der Didone des Zeitungstitels, quer
darueber der Rotstift. Der Strich laeuft bewusst nur ueber die Mitte des
Buchstabens und nicht ueber die volle Diagonale: so bleibt das K lesbar und
der Strich wirkt als Korrekturzeichen, nicht als Loeschung.

Warum ein Skript und nicht einmal von Hand gezeichnet: die Groessen (16 bis
512) muessen dasselbe Motiv zeigen, und die Farben stehen in
`packages/shared/src/constants.ts`. Aendert sich die Palette oder das Motiv,
laeuft das Skript neu -- statt fuenf Dateien einzeln nachzuziehen.

Die Buchstabenform kommt aus "Bodoni 72" (macOS) und wird als Pfad
uebernommen, nicht als Text: das SVG darf zur Laufzeit keine Schrift
brauchen. Deshalb laeuft das Skript nur dort, wo die Schrift liegt --
das Ergebnis (`packages/api/src/views/icons.ts`) ist eingecheckt und wird
zum Bauen nicht gebraucht.

Gezeichnet wird vierfach vergroessert und dann verkleinert (Supersampling):
PIL kennt keine Kantenglaettung beim Fuellen, das Verkleinern besorgt sie.
"""

from __future__ import annotations

import base64
import io
import json
import math
import pathlib
import re
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTCollection
from PIL import Image, ImageDraw, ImageFont

STAMM = pathlib.Path(__file__).resolve().parent.parent
KONSTANTEN = STAMM / "packages/shared/src/constants.ts"
ZIEL_TS = STAMM / "packages/api/src/views/icons.ts"

SCHRIFT = pathlib.Path("/System/Library/Fonts/Supplemental/Bodoni 72.ttc")
SCHRIFT_INDEX = 1  # Bold — die Wortmarke laeuft ebenfalls fett
ZEICHEN = "K"

# Rand um das Motiv, als Anteil der Kantenlaenge. iOS und Android schneiden
# Icons zu (maskable), deshalb bleibt aussen Luft.
RAND = 0.14
UEBERABTASTUNG = 4

# Der Strich, in Anteilen der Kantenlaenge: von unten links nach oben rechts
# quer ueber die Mitte des Buchstabens, zur Spitze hin duenner.
STRICH = {"x1": 0.24, "y1": 0.63, "x2": 0.80, "y2": 0.34, "dick": 0.10}


def palette() -> dict[str, str]:
    """Liest die Farben aus der einzigen Quelle, die es dafuer gibt."""
    text = KONSTANTEN.read_text(encoding="utf-8")
    block = text.split("export const PALETTE = {", 1)[1].split("} as const;", 1)[0]
    return dict(re.findall(r'(\w+):\s*"([^"]+)"', block))


def strich_ecken(kante: float) -> list[tuple[float, float]]:
    """Die vier Ecken des Filzstift-Strichs auf einer Flaeche dieser Groesse."""
    x1, y1 = kante * STRICH["x1"], kante * STRICH["y1"]
    x2, y2 = kante * STRICH["x2"], kante * STRICH["y2"]
    dick_anfang = kante * STRICH["dick"]
    dick_ende = dick_anfang * 0.55
    laenge = math.hypot(x2 - x1, y2 - y1)
    nx, ny = -(y2 - y1) / laenge, (x2 - x1) / laenge  # Normale zur Richtung
    return [
        (x1 + nx * dick_anfang / 2, y1 + ny * dick_anfang / 2),
        (x2 + nx * dick_ende / 2, y2 + ny * dick_ende / 2),
        (x2 - nx * dick_ende / 2, y2 - ny * dick_ende / 2),
        (x1 - nx * dick_anfang / 2, y1 - ny * dick_anfang / 2),
    ]


def zeichne(kante: int, farben: dict[str, str]) -> Image.Image:
    """Malt das Motiv auf eine quadratische Flaeche der gegebenen Kantenlaenge."""
    gross = kante * UEBERABTASTUNG
    bild = Image.new("RGB", (gross, gross), farben["papier"])
    stift = ImageDraw.Draw(bild)

    schrift = ImageFont.truetype(
        str(SCHRIFT), int(gross * (1 - 2 * RAND) * 1.16), index=SCHRIFT_INDEX
    )
    kasten = stift.textbbox((0, 0), ZEICHEN, font=schrift)
    breite, hoehe = kasten[2] - kasten[0], kasten[3] - kasten[1]
    stift.text(
        ((gross - breite) / 2 - kasten[0], (gross - hoehe) / 2 - kasten[1]),
        ZEICHEN,
        font=schrift,
        fill=farben["tinte"],
    )
    stift.polygon(strich_ecken(gross), fill=farben["korrektur"])
    return bild.resize((kante, kante), Image.LANCZOS)


def buchstabenpfad() -> tuple[str, float]:
    """Die Umrisse des Zeichens als SVG-Pfad, dazu seine Hoehe in Font-Einheiten."""
    schrift = TTCollection(str(SCHRIFT)).fonts[SCHRIFT_INDEX]
    glyphen = schrift.getGlyphSet()
    name = schrift.getBestCmap()[ord(ZEICHEN)]
    feder = SVGPathPen(glyphen)
    glyphen[name].draw(feder)
    kasten = schrift["glyf"][name] if "glyf" in schrift else None
    hoehe = (kasten.yMax - kasten.yMin) if kasten is not None else schrift["head"].unitsPerEm
    return feder.getCommands(), hoehe, kasten, schrift["head"].unitsPerEm


def svg(farben: dict[str, str]) -> str:
    """Dieselbe Zeichnung in Vektorform — Buchstabe als Pfad, ohne Schriftbedarf.

    Die Farben werden als Platzhalter eingesetzt und beim Schreiben durch
    Verweise auf PALETTE ersetzt: Hexwerte im Quelltext verbietet der Linter,
    und zu Recht -- sonst gaebe es die Palette zweimal.
    """
    pfad, _hoehe, kasten, _em = buchstabenpfad()
    # Font-Koordinaten laufen nach oben, SVG nach unten: spiegeln und so
    # skalieren, dass der Buchstabe die Flaeche zwischen den Raendern fuellt.
    innen = 100 * (1 - 2 * RAND)
    mass = innen / max(kasten.xMax - kasten.xMin, kasten.yMax - kasten.yMin)
    dx = 50 - (kasten.xMin + kasten.xMax) / 2 * mass
    dy = 50 + (kasten.yMin + kasten.yMax) / 2 * mass
    ecken = " ".join(f"{x:.2f},{y:.2f}" for x, y in strich_ecken(100))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<rect width="100" height="100" fill="{farben["papier"]}"/>'
        f'<g transform="translate({dx:.3f} {dy:.3f}) scale({mass:.6f} {-mass:.6f})">'
        f'<path d="{pfad}" fill="{farben["tinte"]}"/></g>'
        f'<polygon points="{ecken}" fill="{farben["korrektur"]}"/>'
        "</svg>"
    )


def als_png(bild: Image.Image) -> bytes:
    puffer = io.BytesIO()
    bild.save(puffer, format="PNG", optimize=True)
    return puffer.getvalue()


def main() -> None:
    if not SCHRIFT.exists():
        sys.exit(
            f"Schrift nicht gefunden: {SCHRIFT}\n"
            "Das Skript laeuft nur auf macOS; das erzeugte icons.ts ist eingecheckt."
        )

    farben = palette()

    apple = als_png(zeichne(180, farben))
    android192 = als_png(zeichne(192, farben))
    android512 = als_png(zeichne(512, farben))

    ico = io.BytesIO()
    zeichne(64, farben).save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    manifest = {
        "name": "Korrekturen",
        "short_name": "Korrekturen",
        "description": "Textkorrekturen melden und tracken",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "lang": "de",
        "background_color": farben["papier"],
        "theme_color": farben["tinte"],
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {
                "src": "/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
        "shortcuts": [
            {"name": "Neue Korrektur", "url": "/hinweis"},
            {"name": "Bilanz", "url": "/bilanz"},
        ],
    }

    def b64(daten: bytes) -> str:
        return base64.b64encode(daten).decode("ascii")

    manifest_quelle = json.dumps(manifest, ensure_ascii=False, indent=2)
    manifest_quelle = manifest_quelle.replace(
        f'"{farben["papier"]}"', "PALETTE.papier"
    ).replace(f'"{farben["tinte"]}"', "PALETTE.tinte")

    # Hexwerte gehoeren nicht in den Quelltext (Projektregel: PALETTE ist die
    # einzige Farbquelle). Das SVG traegt sie deshalb als Verweis.
    svg_quelle = svg(farben)
    for name in ("papier", "tinte", "korrektur"):
        svg_quelle = svg_quelle.replace(farben[name], "${PALETTE." + name + "}")

    ZIEL_TS.write_text(
        "/* ERZEUGT von tools/iconsErzeugen.py -- nicht von Hand aendern.\n"
        "   Motiv: das K der Wortmarke, quer darueber der Rotstift. Die Bilder\n"
        "   liegen als Base64 im Buendel statt als Dateien daneben: der Hoster\n"
        "   startet die Anwendung aus einem Verzeichnis, das nicht dem\n"
        "   Arbeitsverzeichnis entspricht -- eingebettet gibt es keine Pfadfrage.\n"
        "   Neu erzeugen: python3 tools/iconsErzeugen.py */\n\n"
        'import { PALETTE } from "@korrektur/shared";\n\n'
        f"export const ICON_SVG = `{svg_quelle}`;\n\n"
        f"export const FAVICON_ICO = {json.dumps(b64(ico.getvalue()))};\n\n"
        f"export const APPLE_TOUCH_ICON = {json.dumps(b64(apple))};\n\n"
        f"export const ICON_192 = {json.dumps(b64(android192))};\n\n"
        f"export const ICON_512 = {json.dumps(b64(android512))};\n\n"
        f"export const MANIFEST = {manifest_quelle};\n",
        encoding="utf-8",
    )

    print(f"geschrieben: {ZIEL_TS.relative_to(STAMM)}")
    for name, daten in (
        ("favicon.ico", ico.getvalue()),
        ("apple-touch-icon.png (180)", apple),
        ("icon-192.png", android192),
        ("icon-512.png", android512),
    ):
        print(f"  {name}: {len(daten) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
