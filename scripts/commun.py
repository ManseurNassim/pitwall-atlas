"""Socle commun aux scripts de données : chemins, configuration (data/config.json), lecture/écriture JSON,
requêtes HTTP avec réessais. Les scripts n'écrivent rien en dur : tout réglage vient de la configuration."""
import datetime as dt
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RACINE = Path(__file__).parent.parent
DATA = RACINE / "data"
CACHE_API = DATA / "api"
CACHE_OPENF1 = DATA / "openf1"
SORTIE = RACINE / "src" / "donnees"


def lire_json(chemin, defaut=None):
    chemin = Path(chemin)
    return json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else defaut


def ecrire_json(chemin, obj, compact=True):
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(obj, ensure_ascii=False, indent=1)
    chemin.write_text(texte, encoding="utf-8")


CONFIG = lire_json(DATA / "config.json")
TRADUCTIONS = lire_json(DATA / "i18n" / f"{CONFIG['langue']}.json")
ANNEE_COURANTE = dt.date.today().year
SAISONS = range(CONFIG["saisons"]["de"], (CONFIG["saisons"]["a"] or ANNEE_COURANTE) + 1)


def http_json(url, pause):
    """GET JSON avec réessais (réseau, 429…). Une réponse 404 veut dire « aucune donnée » (OpenF1) : renvoie []."""
    essais = CONFIG["api"]["essais"]
    for essai in range(essais):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                donnees = json.load(r)
            time.sleep(pause)
            return donnees
        except urllib.error.HTTPError as e:
            if e.code == 404:
                time.sleep(pause)
                return []
            erreur = e
        except Exception as e:  # réseau, délai dépassé
            erreur = e
        print(f"  nouvel essai {essai + 1}/{essais} ({erreur})")
        time.sleep(5 * (essai + 1))
    raise RuntimeError(f"échec : {url}")
