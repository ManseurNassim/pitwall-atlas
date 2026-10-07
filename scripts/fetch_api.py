"""Télécharge l'API Jolpica (successeur d'Ergast) dans data/api/ (cache).

Usage : python scripts/fetch_api.py [--force]
- par saison (data/config.json → saisons) : calendrier, podiums, classements, classement après chaque manche ;
- pour chaque circuit couru : tous ses vainqueurs.
Les saisons terminées ne sont retéléchargées qu'avec --force ; la saison en cours l'est toujours.
"""
import argparse
import datetime as dt

from commun import ANNEE_COURANTE, CACHE_API, CONFIG, SAISONS, ecrire_json, http_json, lire_json

API = CONFIG["api"]["jolpica"]


def get(chemin):
    """Requête paginée (100 lignes max par page) : concatène toutes les pages de la table."""
    tout, offset = None, 0
    while True:
        separateur = "&" if "?" in chemin else "?"
        d = http_json(f"{API}/{chemin}{separateur}limit=100&offset={offset}", CONFIG["api"]["pauseJolpica"])["MRData"]
        table = next(k for k in d if k.endswith("Table"))
        liste = next((k for k in d[table] if isinstance(d[table][k], list)), None)
        if tout is None:
            tout = d
        elif liste:
            tout[table][liste] += d[table][liste]
        offset += 100
        if offset >= int(d["total"]):
            return tout


def sauver(nom, chemin_api):
    print(f"{nom}…")
    ecrire_json(CACHE_API / f"{nom}.json", get(chemin_api))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    force = ap.parse_args().force
    aujourdhui = dt.date.today().isoformat()

    circuits = set()
    for s in SAISONS:
        if force or s >= ANNEE_COURANTE or not (CACHE_API / f"calendrier_{s}.json").exists():
            sauver(f"calendrier_{s}", f"{s}.json")
            for p in (1, 2, 3):
                sauver(f"podium_{s}_{p}", f"{s}/results/{p}.json")
            sauver(f"pilotes_{s}", f"{s}/driverstandings.json")
            sauver(f"constructeurs_{s}", f"{s}/constructorstandings.json")
        courses = lire_json(CACHE_API / f"calendrier_{s}.json")["RaceTable"]["Races"]
        circuits |= {r["Circuit"]["circuitId"] for r in courses}
        # Classement après chaque manche courue (replay) : une manche en cache ne change plus
        for r in courses:
            nom = f"classement_{s}_{r['round']}"
            if r["date"] < aujourdhui and not (CACHE_API / f"{nom}.json").exists():
                sauver(nom, f"{s}/{r['round']}/driverstandings.json")

    # Vainqueurs par circuit : à rafraîchir pour les circuits de la saison en cours (nouvelle victoire possible)
    en_cours = {r["Circuit"]["circuitId"] for r in lire_json(CACHE_API / f"calendrier_{ANNEE_COURANTE}.json",
                                                             {"RaceTable": {"Races": []}})["RaceTable"]["Races"]}
    for cid in sorted(circuits):
        if force or cid in en_cours or not (CACHE_API / f"vainqueurs_{cid}.json").exists():
            sauver(f"vainqueurs_{cid}", f"circuits/{cid}/results/1.json")
    print("ok :", len(circuits), "circuits")


if __name__ == "__main__":
    main()
