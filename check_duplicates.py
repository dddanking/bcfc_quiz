import json
import re
from pathlib import Path
from collections import defaultdict

def extract_surname(name):
    """Get the last word of a name as the surname."""
    parts = name.strip().split()
    return parts[-1] if parts else name

def load_data_js(filepath):
    """Extract rows directly from data.js by parsing line by line."""
    text = Path(filepath).read_text(encoding='utf-8')
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('['):
            continue
        # Remove trailing comma
        line = line.rstrip(',')
        try:
            row = json.loads(line)
            if isinstance(row, list) and len(row) >= 6:
                rows.append(row)
        except json.JSONDecodeError:
            continue
    return rows

def main():
    data_path = Path('data.js')
    if not data_path.exists():
        print("data.js not found — make sure you're in the bcfc-quiz folder")
        return

    rows = load_data_js(data_path)
    if not rows:
        print("No data found")
        return

    print(f"Loaded {len(rows)} goal records\n")

    # Build a map of surname -> list of (full_name, season) pairs
    surname_map = defaultdict(list)
    seen = set()

    for row in rows:
        if len(row) < 8:
            continue
        date, venue, opponent, result, score, scorer, season, competition = row[:8]
        if not scorer:
            continue

        surname = extract_surname(scorer)
        key = (scorer, season)
        if key not in seen:
            seen.add(key)
            surname_map[surname].append((scorer, season))

    # Find surnames with more than one distinct full name
    print("=" * 60)
    print("DUPLICATE SURNAMES — different full names, needs review")
    print("=" * 60)
    duplicates_found = 0

    for surname, entries in sorted(surname_map.items()):
        # Get unique full names for this surname
        unique_names = list(dict.fromkeys(name for name, season in entries))
        if len(unique_names) > 1:
            duplicates_found += 1
            print(f"\n{surname}")
            for name in unique_names:
                seasons = sorted(set(s for n, s in entries if n == name))
                print(f"  {name:30s} seasons: {', '.join(seasons)}")

    if duplicates_found == 0:
        print("No duplicate surnames found.")

    # Also flag single-name entries that might be ambiguous
    print("\n" + "=" * 60)
    print("SAME FULL NAME, MULTIPLE ERAS — might be same or different player")
    print("=" * 60)

    full_name_seasons = defaultdict(set)
    for row in rows:
        if len(row) < 8:
            continue
        scorer, season = row[5], row[6]
        if scorer:
            full_name_seasons[scorer].add(season)

    multi_era = {
        name: sorted(seasons)
        for name, seasons in full_name_seasons.items()
        if len(seasons) > 3
    }

    print("\nPlayers appearing across many seasons (probably fine, just check):")
    for name, seasons in sorted(multi_era.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"  {name:30s} {len(seasons)} seasons: {seasons[0]} – {seasons[-1]}")

    print("\n" + "=" * 60)
    print("ALL UNIQUE SCORER NAMES IN DATASET")
    print("=" * 60)
    all_names = sorted(set(row[5] for row in rows if len(row) >= 6 and row[5]))
    print(f"\n{len(all_names)} unique names:\n")
    for name in all_names:
        print(f"  {name}")

if __name__ == '__main__':
    main()