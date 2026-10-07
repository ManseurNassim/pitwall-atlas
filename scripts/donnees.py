"""Prépare les données du site dans src/donnees/ (importées par le code, embarquées au build Vite).

Sources (rien n'est écrit en dur ici) :
- data/config.json          réglages (saisons, tolérances, tailles…)
- data/i18n/<langue>.json   noms de GP traduits, champ du nom des pays
- data/circuits_meta.json   fiche de chaque circuit (noms, km, tours, virages, anecdote, tracé, code pays)
- data/api/, data/openf1/   caches des API (scripts/fetch_api.py, scripts/fetch_openf1.py)
- data/f1-circuits.geojson  tracés réels · data/ne50.geojson pays Natural Earth

Usage : python scripts/donnees.py   (ou npm run donnees, qui télécharge d'abord)
"""
from collections import Counter

from commun import CONFIG, DATA, SAISONS, SORTIE, TRADUCTIONS, ecrire_json, lire_json
from courses import lire, progression, tour_par_tour
from geo import charger_pays, features_globe, pays_du_point, trace_svg

META = {k: v for k, v in lire_json(DATA / "circuits_meta.json").items() if not k.startswith("_")}
TRACES = {f["properties"]["id"]: f["geometry"]["coordinates"] for f in lire_json(DATA / "f1-circuits.geojson")["features"]}
GP = TRADUCTIONS["gp"]
non_traduits = set()


def nom_gp(nom_api, defaut):
    """« Italian Grand Prix » → « Grand Prix d'Italie » (data/i18n). Nom inconnu : signalé, valeur de la fiche."""
    cle = nom_api if nom_api in GP else nom_api.replace(" Grand Prix", "")
    if cle not in GP:
        non_traduits.add(nom_api)
    return GP.get(cle, defaut)


def nom_court(gp):
    """« Grand Prix d'Italie » → « Italie » (préfixes listés dans data/i18n)."""
    return next((gp[len(p):] for p in TRADUCTIONS["prefixesCourts"] if gp.startswith(p)), gp)


def pilote(d):
    return {"nom": d["familyName"], "prenom": d["givenName"], "code": d.get("code") or d["familyName"][:3].upper()}


def podium_de(pod):
    p1 = pod[1]
    return {**pilote(p1["Driver"]), "equipe": p1["Constructor"]["name"], "eqId": p1["Constructor"]["constructorId"],
            "grille": int(p1["grid"]),
            "podium": [{"code": pilote(pod[k]["Driver"])["code"], "nom": pod[k]["Driver"]["familyName"],
                        "eqId": pod[k]["Constructor"]["constructorId"]} for k in (1, 2, 3) if k in pod]}


def dernier_classement(nom, cle):
    listes = (lire(nom) or {}).get("StandingsTable", {}).get("StandingsLists", [])
    return listes[-1][cle] if listes else []


def saison(annee, lieux):
    """Calendrier, résultats et classements d'une saison. `lieux` reçoit la position de chaque circuit couru."""
    cal = lire(f"calendrier_{annee}")
    if not cal:
        return None
    podiums = {}
    for p in (1, 2, 3):
        for r in (lire(f"podium_{annee}_{p}") or {"RaceTable": {"Races": []}})["RaceTable"]["Races"]:
            podiums.setdefault(r["round"], {})[p] = r["Results"][0]
    courses = []
    for r in cal["RaceTable"]["Races"]:
        cid = r["Circuit"]["circuitId"]
        lieux[cid] = r["Circuit"]["Location"]
        gp = nom_gp(r["raceName"], META[cid]["gp"])
        pod = podiums.get(r["round"], {})
        courses.append({"round": int(r["round"]), "id": cid, "date": r["date"], "heure": r.get("time"),
                        "gp": gp, "gpCourt": nom_court(gp), "vainqueur": podium_de(pod) if 1 in pod else None})
    pilotes = [{"pos": int(x["position"]), **pilote(x["Driver"]), "pts": float(x["points"]), "v": int(x["wins"]),
                "equipe": x["Constructors"][-1]["name"], "eqId": x["Constructors"][-1]["constructorId"]}
               for x in dernier_classement(f"pilotes_{annee}", "DriverStandings")]
    constructeurs = [{"pos": int(x["position"]), "nom": x["Constructor"]["name"], "id": x["Constructor"]["constructorId"],
                      "pts": float(x["points"]), "v": int(x["wins"])}
                     for x in dernier_classement(f"constructeurs_{annee}", "ConstructorStandings")]
    return {"courses": courses, "pilotes": pilotes, "constructeurs": constructeurs, "progression": progression(annee, courses)}


def circuit(cid, loc):
    """Fiche d'un circuit : métadonnées, tracé SVG, palmarès (champs affichés seulement) et statistiques."""
    hist = sorted(({"annee": int(r["season"]), "prenom": r["Results"][0]["Driver"]["givenName"],
                    "nom": r["Results"][0]["Driver"]["familyName"], "equipe": r["Results"][0]["Constructor"]["name"],
                    "eqId": r["Results"][0]["Constructor"]["constructorId"], "grille": int(r["Results"][0]["grid"])}
                   for r in lire(f"vainqueurs_{cid}")["RaceTable"]["Races"]), key=lambda h: h["annee"], reverse=True)
    pilotes = Counter(f"{h['prenom']} {h['nom']}" for h in hist)
    equipes = Counter(h["equipe"] for h in hist)
    id_equipe = {h["equipe"]: h["eqId"] for h in hist}
    return {"id": cid, **META[cid], "lat": float(loc["lat"]), "lng": float(loc["long"]),
            "svg": trace_svg(TRACES[META[cid]["geo"]]), "historique": hist,
            "stats": {"editions": len(hist), "premiere": min((h["annee"] for h in hist), default=None),
                      "topPilotes": [{"nom": n, "v": v} for n, v in pilotes.most_common(CONFIG["stats"]["topPilotes"])],
                      "topEquipes": [{"nom": n, "id": id_equipe[n], "v": v} for n, v in equipes.most_common(CONFIG["stats"]["topEquipes"])],
                      "poleVictoire": round(100 * sum(h["grille"] == 1 for h in hist) / len(hist)) if hist else None,
                      "remontee": max(hist, key=lambda h: (h["grille"] == 0, h["grille"])) if hist else None}}


def main():
    saisons, lieux, details = {}, {}, {}
    for annee in SAISONS:
        s = saison(annee, lieux)
        if s:
            saisons[str(annee)] = s
            details[str(annee)] = tour_par_tour(annee, s["courses"])

    circuits = {cid: circuit(cid, loc) for cid, loc in lieux.items()}
    pays = charger_pays()
    for c in circuits.values():
        p = pays_du_point(pays, c["lat"], c["lng"])
        c["continent"], c["paysNE"] = p["continent"], p["nom"]
    hotes = {c["paysNE"] for c in circuits.values()}

    ecrire_json(SORTIE / "circuits.json", circuits)
    ecrire_json(SORTIE / "pays.json", {"type": "FeatureCollection", "features": features_globe(pays, hotes)})
    en_cours = next((a for a in sorted(saisons) if any(not c["vainqueur"] for c in saisons[a]["courses"])), max(saisons))
    # « maj » = date du dernier GP couru : elle ne change qu'avec une nouvelle course, donc la mise à jour
    # automatique quotidienne ne produit un changement (commit + republication) que lorsqu'il y a du nouveau.
    dernier_gp = max(c["date"] for s in saisons.values() for c in s["courses"] if c["vainqueur"])
    ecrire_json(SORTIE / "index.json", {"maj": dernier_gp, "saisons": sorted(saisons), "enCours": en_cours,
                                         "hotes": sorted(hotes), "continents": sorted({c["continent"] for c in circuits.values()})})
    for annee, contenu in saisons.items():
        contenu["detailsDispo"] = sorted(details[annee])   # manches qui ont un graphique tour par tour
        ecrire_json(SORTIE / "saisons" / f"{annee}.json", contenu)
        for rnd, det in details[annee].items():
            ecrire_json(SORTIE / "courses" / f"{annee}-{rnd}.json", det)

    if non_traduits:
        print("⚠ noms de GP à traduire dans data/i18n :", sorted(non_traduits))
    taille = sum(f.stat().st_size for f in SORTIE.rglob("*.json")) / 1024
    print(f"src/donnees : {taille:.0f} Ko · saisons {', '.join(saisons)} · {len(circuits)} circuits · "
          f"{len(hotes)} pays hôtes · {sum(len(d) for d in details.values())} graphiques tour par tour")


if __name__ == "__main__":
    main()
