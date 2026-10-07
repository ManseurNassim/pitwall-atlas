"""Géographie du globe, avec Shapely (référence Python pour la géométrie) :
- pays allégés pour les hexagones (simplification, îlots inutiles retirés, nom traduit) ;
- pays et continent de chaque circuit ;
- projection d'un tracé GeoJSON en chemin SVG pour la fiche."""
import math

import shapely
from shapely.geometry import MultiPolygon, Point, mapping, shape

from commun import CONFIG, DATA, TRADUCTIONS, lire_json

REGLES = CONFIG["pays"]


def charger_pays():
    """Pays Natural Earth 1:50m (inclut Monaco, Singapour, Bahreïn), hors continents exclus."""
    brut = lire_json(DATA / "ne50.geojson")["features"]
    return [{"nom": f["properties"]["NAME"], "nomAffiche": f["properties"].get(TRADUCTIONS["champPays"]) or f["properties"]["NAME"],
             "continent": f["properties"]["CONTINENT"], "geom": shape(f["geometry"])}
            for f in brut if f["properties"]["CONTINENT"] not in REGLES["exclus"]]


def pays_du_point(pays, lat, lng):
    """Pays qui contient le point ; à défaut (circuit en bord de mer) le plus proche."""
    p = Point(lng, lat)
    return next((x for x in pays if x["geom"].contains(p)), None) or min(pays, key=lambda x: x["geom"].distance(p))


def _aire_corrigee(geom):
    """Aire en degrés² corrigée de la latitude (≈ proportionnelle à l'aire réelle)."""
    return geom.area * math.cos(math.radians(geom.centroid.y))


def _polygones(geom):
    return list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]


def alleger(geom, hote):
    """Contour allégé (≈ 15 % des points) ; None s'il ne reste rien.
    - non hôte : îlots plus petits qu'un hexagone retirés (ils n'en porteraient aucun), simplification forte ;
    - hôte : simplification fine (on voit sa forme de près) ; pays minuscule (Monaco) : contour exact ;
    - coordonnées arrondies (set_precision garde des polygones valides : h3 plante sur les anneaux dégénérés)."""
    tolerance, grille = (REGLES["toleranceHote"], 1e-3) if hote else (REGLES["toleranceAutre"], 1e-2)
    morceaux = [p for p in _polygones(geom) if hote or p.area >= REGLES["aireMinIlot"]]
    resultat = []
    for p in morceaux:
        simple = shapely.set_precision(p.simplify(tolerance, preserve_topology=True), grille)
        if simple.is_empty and hote:
            simple = shapely.set_precision(p, grille)
        resultat += [q for q in _polygones(simple) if not q.is_empty and q.geom_type == "Polygon"]
    return MultiPolygon(resultat) if resultat else None


def features_globe(pays, hotes):
    """GeoJSON compact pour le front : n = nom (identifiant), nf = nom affiché, c = continent, r = résolution h3."""
    sortie = []
    for x in pays:
        hote = x["nom"] in hotes
        geom = alleger(x["geom"], hote)
        if not geom:
            continue
        fine = hote and _aire_corrigee(x["geom"]) < REGLES["aireMaxHexFin"]
        sortie.append({"type": "Feature",
                       "properties": {"n": x["nom"], "nf": x["nomAffiche"], "c": x["continent"],
                                      "r": REGLES["resolutionHexFine"] if fine else REGLES["resolutionHex"]},
                       "geometry": mapping(geom)})
    return sortie


def trace_svg(coords):
    """Projette lon/lat en plan local (équirectangulaire) et cadre le tracé dans le viewBox de la fiche."""
    largeur, hauteur, marge = (CONFIG["trace"][k] for k in ("largeur", "hauteur", "marge"))
    k = math.cos(math.radians(sum(c[1] for c in coords) / len(coords)))
    pts = [(lon * k, -lat) for lon, lat in coords]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = min((largeur - 2 * marge) / w, (hauteur - 2 * marge) / h)
    ox, oy = (largeur - w * s) / 2 - min(xs) * s, (hauteur - h * s) / 2 - min(ys) * s
    return "M" + " L".join(f"{round(x * s + ox, 1)},{round(y * s + oy, 1)}" for x, y in pts) + " Z"
