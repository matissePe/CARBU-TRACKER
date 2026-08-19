"""
Backtest des règles de conseil, sur l'historique réel de la base.

    python3 scripts/backtest-window.py

Sert à re-vérifier les seuils de src/lib/advice.ts si la source ou le comportement d'achat
changent. Ne modifie rien : lecture seule sur data/carbu.db.
"""
import sqlite3, datetime, statistics
from collections import defaultdict

DB = 'data/carbu.db'
con = sqlite3.connect(DB)
rows = con.execute(
    "select station_id, recorded_at, price_milli from prices where fuel='gazole' order by recorded_at"
).fetchall()

# Série journalière du meilleur prix de la zone.
# Une station n'est comptée que si son prix a moins de 60 jours : sinon elle a cessé de
# publier et son vieux prix tirerait le minimum vers le bas.
by_day = defaultdict(dict)          # jour -> {station: (prix, jour_du_relevé)}
for sid, ts, p in rows:
    by_day[ts[:10]][sid] = p

days = sorted(by_day)
d0 = datetime.date.fromisoformat(days[0])
d1 = datetime.date.fromisoformat(days[-1])

last = {}                            # station -> (prix, date)
best = {}                            # date -> meilleur prix
d = d0
while d <= d1:
    key = d.isoformat()
    for sid, p in by_day.get(key, {}).items():
        last[sid] = (p, d)
    active = [p for p, seen in last.values() if (d - seen).days <= 60]
    if active:
        best[d] = min(active)
    d += datetime.timedelta(days=1)

dates = sorted(best)
print(f"Série journalière : {len(dates)} jours, du {dates[0]} au {dates[-1]}\n")

WINDOWS = [21, 30, 45, 60, 90, 180]
FLEX = 14   # il peut décaler son plein d'environ deux semaines

def analyse(start_date, label):
    print(f"=== {label} ===")
    print(f"{'fenêtre':>8} | {'jauge collée':>13} | {'regret si jauge basse':>22} | {'regret si jauge haute':>22} | {'écart':>7}")
    print("-" * 88)
    subset = [d for d in dates if d >= start_date and d + datetime.timedelta(days=FLEX) <= dates[-1]]
    for W in WINDOWS:
        pegged = 0
        low_regret, high_regret = [], []
        for d in subset:
            window = [best[x] for x in dates if d - datetime.timedelta(days=W) <= x <= d]
            if len(window) < 5:
                continue
            lo, hi = min(window), max(window)
            pos = 50 if hi == lo else (best[d] - lo) / (hi - lo) * 100
            if pos > 90 or pos < 10:
                pegged += 1
            # Ce que l'attente optimale aurait rapporté sur les deux semaines suivantes.
            future = [best[x] for x in dates if d < x <= d + datetime.timedelta(days=FLEX)]
            if not future:
                continue
            regret = (best[d] - min(future)) / 1000
            (low_regret if pos < 30 else high_regret if pos > 70 else []).append(regret)
        if not low_regret or not high_regret:
            continue
        lm, hm = statistics.mean(low_regret), statistics.mean(high_regret)
        print(f"{W:>6} j | {pegged/len(subset)*100:>11.0f} % | "
              f"{lm*50:>17.2f} €/plein | {hm*50:>17.2f} €/plein | {(hm-lm)*50:>5.2f} €")
    print()

analyse(datetime.date(2022, 1, 1), "2022 → aujourd'hui (régime volatil)")
analyse(datetime.date(2025, 8, 19), "12 derniers mois")
