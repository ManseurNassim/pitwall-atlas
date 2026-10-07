"""Télécharge OpenF1 (api.openf1.org) : tours, positions, arrêts et pilotes de chaque course, dans data/openf1/.

Usage : python scripts/fetch_openf1.py
OpenF1 ne couvre que les saisons depuis data/config.json → openf1Depuis. Une course en cache n'est jamais
retéléchargée. Limite gratuite ~30 requêtes/minute : pause réglée par config → api.pauseOpenf1.
"""
import datetime as dt

from commun import ANNEE_COURANTE, CACHE_OPENF1, CONFIG, ecrire_json, http_json

API, PAUSE = CONFIG["api"]["openf1"], CONFIG["api"]["pauseOpenf1"]
TYPES = ("laps", "position", "pit", "drivers")


def main():
    maintenant = dt.datetime.now(dt.timezone.utc).isoformat()
    for annee in range(CONFIG["openf1Depuis"], ANNEE_COURANTE + 1):
        sessions = http_json(f"{API}/sessions?year={annee}&session_name=Race", PAUSE)
        ecrire_json(CACHE_OPENF1 / f"sessions_{annee}.json", sessions)
        for s in sessions:
            cle = s["session_key"]
            if (s.get("date_end") or "9") > maintenant or all((CACHE_OPENF1 / f"{cle}_{t}.json").exists() for t in TYPES):
                continue
            print(f"{annee} {s['location']} ({cle})")
            for t in TYPES:
                if not (CACHE_OPENF1 / f"{cle}_{t}.json").exists():
                    ecrire_json(CACHE_OPENF1 / f"{cle}_{t}.json", http_json(f"{API}/{t}?session_key={cle}", PAUSE))
    print("ok")


if __name__ == "__main__":
    main()
