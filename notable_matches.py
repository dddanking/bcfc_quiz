from pathlib import Path
import json

def load_data_js(filepath):
    text = Path(filepath).read_text(encoding='utf-8')
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('['):
            continue
        line = line.rstrip(',')
        try:
            row = json.loads(line)
            if isinstance(row, list) and len(row) >= 8:
                rows.append(row)
        except json.JSONDecodeError:
            continue
    return rows

def get_bcfc_goals(score):
    try:
        parts = score.split('–')
        if len(parts) != 2:
            return 0
        return int(parts[0])
    except:
        return 0

def main():
    rows = load_data_js(Path('data.js'))
    if not rows:
        print("No data found")
        return

    DERBIES = [
        "Aston Villa",
        "Wolverhampton Wanderers",
        "West Bromwich Albion"
    ]

    matches = {}
    for row in rows:
        date, venue, opponent, result, score, scorer, season, competition = row[:8]
        key = f"{season}|{date}|{opponent}"
        if key not in matches:
            matches[key] = {
                'date': date,
                'venue': venue,
                'opponent': opponent,
                'result': result,
                'score': score,
                'season': season,
                'competition': competition,
                'scorers': {}
            }
        matches[key]['scorers'][scorer] = matches[key]['scorers'].get(scorer, 0) + 1

    high_scoring = []
    derbies = []

    for key, m in matches.items():
        goals = get_bcfc_goals(m['score'])
        venue_label = 'H' if m['venue'] == 'H' else 'A'
        scorers_display = ', '.join(
            f"{s} ({c})" if c > 1 else s
            for s, c in m['scorers'].items()
        )
        line = (
            f"{m['season']:8s}  {m['date']:22s}  "
            f"{venue_label}  {m['opponent']:30s}  "
            f"{m['result']}  {m['score']:6s}  |  {scorers_display}"
        )

        if goals >= 4:
            high_scoring.append((goals, m['season'], m['date'], line))

        if any(d in m['opponent'] for d in DERBIES):
            derbies.append((m['season'], m['date'], m['result'], line))

    print("=" * 90)
    print("HIGH SCORING MATCHES (Birmingham scored 4+)")
    print("=" * 90)
    for goals, season, date, line in sorted(high_scoring, key=lambda x: (-x[0], x[1], x[2])):
        print(f"[{goals}]  {line}")

    print()
    print("=" * 90)
    print("DERBY MATCHES — WINS ONLY (Villa, Wolves, West Brom)")
    print("=" * 90)
    for season, date, result, line in sorted(derbies, key=lambda x: (x[0], x[1])):
        if result == 'W':
            print(line)

    print()
    print("=" * 90)
    print("DERBY MATCHES — ALL RESULTS (Villa, Wolves, West Brom)")
    print("=" * 90)
    for season, date, result, line in sorted(derbies, key=lambda x: (x[0], x[1])):
        print(line)

if __name__ == '__main__':
    main()