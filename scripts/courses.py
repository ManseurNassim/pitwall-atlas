"""Données « spectacle » préparées au build, appelées par donnees.py :
- progression() : classement des pilotes après chaque manche (replay de saison) ;
- tour_par_tour() : position de chaque pilote à la fin de chaque tour + arrêts aux stands (OpenF1, 2023+).
"""
import datetime as dt
from bisect import bisect_right

from commun import CACHE_API, CACHE_OPENF1 as OPENF1, lire_json


def lire(nom):
    """Fichier du cache Jolpica (data/api/<nom>.json), None s'il n'existe pas."""
    return lire_json(CACHE_API / f"{nom}.json")


def progression(annee, courses):
    """[{round, pilotes: [[code, points, eqId], …] triés par points}] pour chaque manche courue."""
    etapes = []
    for c in courses:
        cl = lire(f"classement_{annee}_{c['round']}")
        listes = (cl or {}).get("StandingsTable", {}).get("StandingsLists", [])
        if not listes or not c["vainqueur"]:
            continue
        etapes.append({"round": c["round"], "pilotes": [
            [x["Driver"].get("code") or x["Driver"]["familyName"][:3].upper(), float(x["points"]),
             x["Constructors"][-1]["constructorId"] if x.get("Constructors") else ""]
            for x in listes[-1]["DriverStandings"]]})
    return etapes


def _date(s):
    return dt.datetime.fromisoformat(s) if s else None


def _lire(cle, t):
    return lire_json(OPENF1 / f"{cle}_{t}.json")


def _une_course(cle, equipe_de):
    tours, positions, arrets, pilotes = (_lire(cle, t) for t in ("laps", "position", "pit", "drivers"))
    if not tours or not positions or not pilotes:
        return None
    # Historique des positions de chaque voiture (horodaté, trié)
    histo = {}
    for p in sorted(positions, key=lambda p: p["date"]):
        h = histo.setdefault(p["driver_number"], ([], []))
        h[0].append(_date(p["date"]))
        h[1].append(p["position"])

    def position_a(num, quand):
        dates, pos = histo.get(num, ([], []))
        i = bisect_right(dates, quand) - 1
        return pos[i] if i >= 0 else None

    par_pilote = {}
    for t in tours:
        par_pilote.setdefault(t["driver_number"], {})[t["lap_number"]] = t
    nb_tours = max(t["lap_number"] for t in tours)
    # Abandon : dernier tour commencé bien avant celui des autres (un retardé d'un tour finit quand même avec eux)
    debut_dernier = {n: max((_date(t["date_start"]) for t in ts.values() if t.get("date_start")), default=None)
                     for n, ts in par_pilote.items()}
    fin_course = max(d for d in debut_dernier.values() if d)

    resultat = []
    for d in pilotes:
        num, mes_tours = d["driver_number"], par_pilote.get(d["driver_number"], {})
        if num not in histo:
            continue
        pos = [histo[num][1][0]]                      # tour 0 = position sur la grille
        for n in range(1, max(mes_tours, default=0) + 1):
            suivant, ce_tour = mes_tours.get(n + 1), mes_tours.get(n)
            fin = _date(suivant["date_start"]) if suivant and suivant.get("date_start") else None
            if not fin and ce_tour and ce_tour.get("date_start") and ce_tour.get("lap_duration"):
                fin = _date(ce_tour["date_start"]) + dt.timedelta(seconds=ce_tour["lap_duration"])
            pos.append(position_a(num, fin) if fin else (histo[num][1][-1] if n == max(mes_tours) else pos[-1]))
        code = d["name_acronym"]
        abandon = not debut_dernier.get(num) or fin_course - debut_dernier[num] > dt.timedelta(minutes=4)
        if abandon and len(pos) > 2:
            pos = pos[:-1]   # au tour de l'abandon, la voiture est reclassée dernière : on coupe ce point trompeur
        resultat.append({
            "code": code, **({"eq": equipe_de[code]} if code in equipe_de else {"couleur": "#" + (d.get("team_colour") or "888888")}),
            "pos": pos, "arrets": sorted({a["lap_number"] for a in (arrets or []) if a["driver_number"] == num and a.get("lap_number")}),
            "abandon": abandon,
        })
    if not resultat:
        return None
    resultat.sort(key=lambda r: (r["abandon"], -len(r["pos"]), r["pos"][-1] or 99))
    return {"tours": nb_tours, "pilotes": resultat}


def tour_par_tour(annee, courses):
    """{round: données du graphique} pour les manches de la saison couvertes par OpenF1."""
    sessions = [s for s in lire_json(OPENF1 / f"sessions_{annee}.json", []) if s.get("date_start")]
    if not sessions:
        return {}
    sortie = {}
    for c in courses:
        if not c["vainqueur"]:
            continue
        jour = dt.date.fromisoformat(c["date"])
        # Même jour à ±1 près (Las Vegas : samedi soir local = dimanche UTC)
        proches = [s for s in sessions if abs((dt.date.fromisoformat(s["date_start"][:10]) - jour).days) <= 1]
        if not proches:
            continue
        cl = lire(f"classement_{annee}_{c['round']}") or {}
        listes = cl.get("StandingsTable", {}).get("StandingsLists", [])
        equipe_de = {x["Driver"].get("code"): x["Constructors"][-1]["constructorId"]
                     for x in (listes[-1]["DriverStandings"] if listes else []) if x.get("Constructors")}
        for s in proches:   # OpenF1 garde aussi des courses annulées (sans données) : on prend la première remplie
            donnees = _une_course(s["session_key"], equipe_de)
            if donnees:
                sortie[c["round"]] = donnees
                break
    return sortie
