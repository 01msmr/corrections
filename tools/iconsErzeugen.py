#!/usr/bin/env python3
"""Erzeugt die Anwendungs-Icons aus dem Motiv der Wortmarke.

Aufruf (aus dem Repo-Stamm):

    python3 tools/iconsErzeugen.py

Das Motiv: das **K** der Wortmarke in der Didone des Zeitungstitels, quer
darueber der Rotstift. Der Strich laeuft nur ueber die Taille des
Buchstabens und nicht ueber die volle Diagonale: so bleibt das K lesbar und
der Strich wirkt als Korrekturzeichen, nicht als Loeschung.

Der Strich ist derselbe wie im Titel: die gebogene Filzstift-Form aus
`layout.tsx` (.marke .tilgung::after), von dort gelesen statt nachgebaut --
sonst entwickeln sich Kopf und Icon auseinander. Im Titel wird sie ueber ein
hohes, schmales Feld gezogen und steht deshalb steil; hier bekommt sie ein
breiteres Feld und liegt flacher.

Die Buchstabenform kommt aus "Bodoni 72" (macOS). Fuer die Pixelbilder
zeichnet PIL sie als Text, fuer das SVG wird der Umriss als Pfad
uebernommen: das SVG darf zur Laufzeit keine Schrift brauchen. Deshalb
laeuft das Skript nur dort, wo die Schrift liegt -- das Ergebnis
(`packages/api/src/views/icons.ts`) ist eingecheckt und wird zum Bauen nicht
gebraucht.

Gezeichnet wird vierfach vergroessert und dann verkleinert (Supersampling):
PIL glaettet Kanten beim Fuellen nicht, das Verkleinern besorgt es.
"""

from __future__ import annotations

import base64
import io
import json
import pathlib
import re
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTCollection
import numpy as np
from PIL import Image, ImageDraw, ImageFont

STAMM = pathlib.Path(__file__).resolve().parent.parent
KONSTANTEN = STAMM / "packages/shared/src/constants.ts"
ZIEL_TS = STAMM / "packages/api/src/views/icons.ts"

SCHRIFT = pathlib.Path("/System/Library/Fonts/Supplemental/Bodoni 72.ttc")
SCHRIFT_INDEX = 2  # Bold, aufrecht -- Index 1 waere die Kursive
ZEICHEN = "K"

# Rand um das Motiv, als Anteil der Kantenlaenge. iOS und Android schneiden
# Icons zu (maskable), deshalb bleibt aussen Luft.
RAND = 0.14
# Der Buchstabe darf ueber diesen Rand hinausgehen; er traegt das Motiv.
BUCHSTABE_MASS = 1.15
UEBERABTASTUNG = 4
# Mit Saum feiner: die Breite des Saums soll auf Zehntelpixel stimmen.
UEBERABTASTUNG_SAUM = 8

# Das Feld, in das der Strich gezogen wird (Anteile der Kantenlaenge). Seine
# Form bestimmt die Neigung: die Vorlage ist 46:26 breit, hier wird sie auf
# rund 2:1 gestaucht -- flacher als im Titel, aber nicht gequetscht.
STRICH_FELD = {"x": 0.06, "y": 0.30, "breite": 0.88, "hoehe": 0.40}

# Duenner weisser Saum um K und Strich (Anteil der Kantenlaenge), nur im
# iOS-Icon: er trennt fuer iOS Vorder- und Hintergrund, sodass der Grund je
# nach Modus gefuellt wird. Reines Weiss ist hier Absicht und kein Farbwert
# der Oberflaeche -- er kommt nicht in die Palette.
# 1,25 % der Breite (2,25 px bei 180): so hat es a.msmr.co auf dem iPhone
# ermittelt -- iOS faerbt den Grund im Dunkelmodus um und laesst den Saum nur
# ab 1,25 % stehen; duennere werden mit umgefaerbt und verschwinden.
SAUM = 0.0125
SAUM_FARBE = (255, 255, 255)
# Das K im iOS-Icon ist reines Schwarz, nicht die Tinte der Palette: iOS laesst
# den Buchstaben im Dunkelmodus unveraendert, und so ist es bei a.msmr.co.
IOS_TINTE = "#000000"


def palette() -> dict[str, str]:
    """Liest die Farben aus der einzigen Quelle, die es dafuer gibt."""
    text = KONSTANTEN.read_text(encoding="utf-8")
    block = text.split("export const PALETTE = {", 1)[1].split("} as const;", 1)[0]
    return dict(re.findall(r'(\w+):\s*"([^"]+)"', block))


def strichpfad() -> tuple[str, float, float]:
    """Holt die Filzstift-Form aus dem Stylesheet -- sie soll nur einmal existieren.

    Sie steht als TILGUNG_STRICH in den geteilten Konstanten -- derselben
    Quelle, aus der auch Titelkopf und Mail zeichnen.
    """
    quelle = KONSTANTEN.read_text(encoding="utf-8")
    block_start = quelle.find("export const TILGUNG_STRICH")
    if block_start < 0:
        raise SystemExit("TILGUNG_STRICH nicht in constants.ts gefunden")
    block = quelle[block_start : quelle.index("} as const;", block_start)]
    pfad = re.search(r'pfad: "([^"]+)"', block)
    breite = re.search(r"breite: ([\d.]+)", block)
    hoehe = re.search(r"hoehe: ([\d.]+)", block)
    if not pfad or not breite or not hoehe:
        raise SystemExit("TILGUNG_STRICH unvollstaendig")
    return pfad.group(1), float(breite.group(1)), float(hoehe.group(1))


def zahlen(text: str) -> list[float]:
    """Alle Zahlen eines Pfad-Abschnitts, auch ohne Trennzeichen ('1.1-.5')."""
    return [float(z) for z in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", text)]


def pfad_zu_punkten(pfad: str, schritte: int = 32) -> list[tuple[float, float]]:
    """Wandelt den Filzstift-Pfad in einen Polygonzug.

    Gebraucht wird nur, was im Strich vorkommt: M/m, L/l, C/c und z. Kubische
    Kurven werden in Geradenstuecke zerlegt -- PIL kann keine Kurven fuellen,
    und in der Groesse, in der hier gezeichnet wird, sieht man es nicht.
    """
    punkte: list[tuple[float, float]] = []
    x = y = 0.0
    for befehl, rest in re.findall(r"([MmCcLlZz])([^MmCcLlZz]*)", pfad):
        werte = zahlen(rest)
        if befehl in "MmLl":
            for i in range(0, len(werte) - 1, 2):
                dx, dy = werte[i], werte[i + 1]
                x, y = (dx, dy) if befehl.isupper() else (x + dx, y + dy)
                punkte.append((x, y))
        elif befehl in "Cc":
            for i in range(0, len(werte) - 5, 6):
                a = werte[i : i + 6]
                if befehl == "C":
                    p1, p2, p3 = (a[0], a[1]), (a[2], a[3]), (a[4], a[5])
                else:
                    p1 = (x + a[0], y + a[1])
                    p2 = (x + a[2], y + a[3])
                    p3 = (x + a[4], y + a[5])
                p0 = (x, y)
                for schritt in range(1, schritte + 1):
                    t = schritt / schritte
                    u = 1 - t
                    punkte.append(
                        (
                            u**3 * p0[0]
                            + 3 * u**2 * t * p1[0]
                            + 3 * u * t**2 * p2[0]
                            + t**3 * p3[0],
                            u**3 * p0[1]
                            + 3 * u**2 * t * p1[1]
                            + 3 * u * t**2 * p2[1]
                            + t**3 * p3[1],
                        )
                    )
                x, y = p3
    return punkte


def scheibe_aufweiten(maske: Image.Image, radius: float) -> Image.Image:
    """Weitet eine 0/255-Maske um einen Kreis vom Radius `radius` (Pixel) aus.

    Zeilenweise: fuer jeden Versatz nach oben/unten eine waagerechte
    Aufweitung um die Sehnenhalbbreite des Kreises -- exakt rund, ohne die
    Ecken eines quadratischen Filters.
    """
    a = np.asarray(maske) > 127
    h, b = a.shape
    r = int(np.floor(radius))
    summe = np.pad(np.cumsum(a, axis=1, dtype=np.int32), ((0, 0), (1, 0)))
    waagerecht: dict[int, np.ndarray] = {}
    aus = np.zeros_like(a)
    for dy in range(-r, r + 1):
        halb = int(np.floor(np.sqrt(radius * radius - dy * dy)))
        if halb not in waagerecht:
            lo = np.clip(np.arange(b) - halb, 0, b)
            hi = np.clip(np.arange(b) + halb + 1, 0, b)
            waagerecht[halb] = (summe[:, hi] - summe[:, lo]) > 0
        zeilen = waagerecht[halb]
        if dy >= 0:
            aus[dy:] |= zeilen[: h - dy]
        else:
            aus[:dy] |= zeilen[-dy:]
    return Image.fromarray((aus * 255).astype(np.uint8), "L")


def zeichne(
    kante: int, farben: dict[str, str], grund: str = "papier", saum: bool = False
) -> Image.Image:
    """Malt das Motiv auf eine quadratische Flaeche der gegebenen Kantenlaenge."""
    gross = kante * (UEBERABTASTUNG_SAUM if saum else UEBERABTASTUNG)
    # Mit Saum wird das Motiv auf weissem Grund gemalt und zugleich auf eine
    # Maske, deren Aufweitung die Kontur des Saums ergibt; der eigentliche
    # Grund kommt erst beim Zusammensetzen dazu (siehe unten).
    bild = Image.new("RGB", (gross, gross), SAUM_FARBE if saum else farben[grund])
    maske = Image.new("L", (gross, gross), 0)
    stifte = [ImageDraw.Draw(bild)] + ([ImageDraw.Draw(maske)] if saum else [])

    schrift = ImageFont.truetype(
        str(SCHRIFT),
        int(gross * (1 - 2 * RAND) * BUCHSTABE_MASS * 1.16),
        index=SCHRIFT_INDEX,
    )
    kasten = stifte[0].textbbox((0, 0), ZEICHEN, font=schrift)
    breite, hoehe = kasten[2] - kasten[0], kasten[3] - kasten[1]
    ort = ((gross - breite) / 2 - kasten[0], (gross - hoehe) / 2 - kasten[1])
    strich, kb, kh = strichpfad()
    feld = STRICH_FELD
    sx, sy = feld["breite"] * gross / kb, feld["hoehe"] * gross / kh
    polygon = [
        (feld["x"] * gross + px * sx, feld["y"] * gross + py * sy)
        for px, py in pfad_zu_punkten(strich)
    ]

    if saum:
        zeichner = stifte[1]
        zeichner.text(ort, ZEICHEN, font=schrift, fill=255)
        zeichner.polygon(polygon, fill=255)
        weit = scheibe_aufweiten(maske, SAUM * gross)

    stift = stifte[0]
    stift.text(ort, ZEICHEN, font=schrift, fill=farben["tinte"])
    stift.polygon(polygon, fill=farben["korrektur"])
    klein = bild.resize((kante, kante), Image.LANCZOS)
    if not saum:
        return klein
    # Die Aussenkante des Saums ist geglaettet, aber auf Zehntelpixel genau:
    # der Anteil, den die Aufweitung von jedem Pixel deckt, mischt Weiss ueber
    # den Grund. So ist der Saum ueberall gleich breit; eine harte Kante
    # rastete an ganzen Pixeln ein und schwankte zwischen 1 und 3 px.
    deckung = np.asarray(weit.resize((kante, kante), Image.BOX), dtype=np.float64) / 255.0
    unten = np.asarray(Image.new("RGB", (kante, kante), farben[grund]), dtype=np.float64)
    oben = np.asarray(klein, dtype=np.float64)
    gemischt = oben * deckung[..., None] + unten * (1 - deckung[..., None])
    return Image.fromarray(np.rint(gemischt).astype(np.uint8), "RGB")


def buchstabenpfad() -> tuple[str, object]:
    """Die Umrisse des Zeichens als SVG-Pfad, dazu sein Rechteck in Font-Einheiten."""
    schrift = TTCollection(str(SCHRIFT)).fonts[SCHRIFT_INDEX]
    glyphen = schrift.getGlyphSet()
    name = schrift.getBestCmap()[ord(ZEICHEN)]
    feder = SVGPathPen(glyphen)
    glyphen[name].draw(feder)
    return feder.getCommands(), schrift["glyf"][name]


def svg(farben: dict[str, str]) -> str:
    """Dieselbe Zeichnung in Vektorform — Buchstabe als Pfad, ohne Schriftbedarf."""
    pfad, kasten = buchstabenpfad()
    # Font-Koordinaten laufen nach oben, SVG nach unten: spiegeln und so
    # skalieren, dass der Buchstabe die Flaeche zwischen den Raendern fuellt.
    innen = 100 * (1 - 2 * RAND) * BUCHSTABE_MASS
    mass = innen / max(kasten.xMax - kasten.xMin, kasten.yMax - kasten.yMin)
    dx = 50 - (kasten.xMin + kasten.xMax) / 2 * mass
    dy = 50 + (kasten.yMin + kasten.yMax) / 2 * mass

    strich, kb, kh = strichpfad()
    feld = STRICH_FELD
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<rect width="100" height="100" fill="{farben["papier"]}"/>'
        f'<g transform="translate({dx:.3f} {dy:.3f}) scale({mass:.6f} {-mass:.6f})">'
        f'<path d="{pfad}" fill="{farben["tinte"]}"/></g>'
        # Der Strich wird in sein Feld gerechnet statt ueber ein
        # verschachteltes <svg> gezogen: viewBox samt preserveAspectRatio
        # verstehen nicht alle Rasterer gleich, eine Transformation schon.
        f'<g transform="translate({feld["x"] * 100:.2f} {feld["y"] * 100:.2f}) '
        f'scale({feld["breite"] * 100 / kb:.5f} {feld["hoehe"] * 100 / kh:.5f})">'
        f'<path d="{strich}" fill="{farben["korrektur"]}"/></g>'
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

    apple = als_png(zeichne(180, {**farben, "tinte": IOS_TINTE}, "iosGrund", saum=True))
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

    # Farbliterale gehoeren nicht in den Quelltext (Projektregel: PALETTE ist
    # die einzige Farbquelle). SVG und Manifest tragen sie deshalb als Verweis.
    svg_quelle = svg(farben)
    for name in ("papier", "tinte", "korrektur"):
        svg_quelle = svg_quelle.replace(farben[name], "${PALETTE." + name + "}")

    manifest_quelle = json.dumps(manifest, ensure_ascii=False, indent=2)
    manifest_quelle = manifest_quelle.replace(f'"{farben["papier"]}"', "PALETTE.papier").replace(
        f'"{farben["tinte"]}"', "PALETTE.tinte"
    )

    ZIEL_TS.write_text(
        "/* ERZEUGT von tools/iconsErzeugen.py -- nicht von Hand aendern.\n"
        "   Motiv: das K der Wortmarke, quer darueber der Rotstift des Titels.\n"
        "   Die Bilder liegen als Base64 im Buendel statt als Dateien daneben:\n"
        "   der Hoster startet die Anwendung aus einem Verzeichnis, das nicht\n"
        "   dem Arbeitsverzeichnis entspricht -- eingebettet gibt es keine\n"
        "   Pfadfrage. Neu erzeugen: python3 tools/iconsErzeugen.py */\n\n"
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
