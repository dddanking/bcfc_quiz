import re
import json
from pathlib import Path


def get_season_year(season):
    """Extract the start year from a season string like 2009-10."""
    try:
        return int(season.split('-')[0])
    except:
        return 0


def fix_name(name, season):
    year = get_season_year(season)

    # Morrison
    if name == 'Morrison':
        if year <= 2006:
            return 'Clinton Morrison'
        elif year >= 2012:
            return 'Michael Morrison'

    # Johnson
    if name in ('Johnson', 'D. Johnson'):
        if year <= 2008:
            return 'Damien Johnson'
        elif year >= 2009:
            return 'Roger Johnson'

    # Ridgewell
    if name in ('Ridgewell', 'Liam Ridgewell'):
        return 'Liam Ridgewell'

    # Taylor
    if name in ('Taylor', 'Martin Taylor'):
        if year <= 2009:
            return 'Martin Taylor'
        elif year >= 2021:
            return 'Lyle Taylor'

    # Adams
    if name in ('Adams', 'Che Adams'):
        return 'Che Adams'

    # Roberts
    if name in ('Roberts', 'Marc Roberts'):
        if year <= 2022:
            return 'Marc Roberts'
        elif year >= 2025:
            return 'Patrick Roberts'

    # Gardner
    if name == 'C. Gardner':
        return 'Craig Gardner'
    if name == 'G. Gardner':
        return 'Gary Gardner'
    if name == 'Gardner':
        if year in (2009, 2010, 2016, 2017):
            return 'Craig Gardner'
        elif year >= 2020:
            return 'Gary Gardner'
        elif year == 2018:
            # 2018-19 — Craig scored one goal, stored as C. Gardner
            # plain Gardner shouldn't appear but default to Craig just in case
            return 'Craig Gardner'

    # Gray
    if name == 'Gray':
        if year <= 2007:
            return 'Julian Gray'
        elif year >= 2013:
            return 'Demarai Gray'

    # Paik
    if name == 'Paik':
        return 'Paik Seung-ho'

    # Furuhashi
    if name == 'Furuhashi':
        return 'Kyogo Furuhashi'

    return name


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
            if isinstance(row, list) and len(row) >= 6:
                rows.append(row)
        except json.JSONDecodeError:
            continue
    return rows


def main():
    data_path = Path('data.js')
    if not data_path.exists():
        print("data.js not found")
        return

    text = Path('data.js').read_text(encoding='utf-8')
    rows = load_data_js(data_path)

    print(f"Loaded {len(rows)} goal records")
    changes = []

    fixed_rows = []
    for row in rows:
        if len(row) < 8:
            fixed_rows.append(row)
            continue

        date, venue, opponent, result, score, scorer, season, competition = row[:8]
        fixed = fix_name(scorer, season)

        if fixed != scorer:
            changes.append(f"  {season} vs {opponent}: '{scorer}' → '{fixed}'")

        fixed_rows.append([date, venue, opponent, result, score, fixed, season, competition])

    print(f"\n{len(changes)} names changed:\n")
    for c in changes:
        print(c)

    # Write back to data.js, preserving everything outside the RAW array
    new_lines = []
    in_raw = False
    row_idx = 0

    for line in text.splitlines():
        stripped = line.strip()

        if 'const RAW' in line and '=' in line:
            in_raw = True
            new_lines.append(line)
            continue

        if in_raw:
            if stripped.startswith('['):
                if row_idx < len(fixed_rows):
                    row_json = json.dumps(fixed_rows[row_idx], ensure_ascii=False)
                    # Preserve trailing comma if original had one
                    if stripped.rstrip().endswith(','):
                        new_lines.append(f'  {row_json},')
                    else:
                        new_lines.append(f'  {row_json}')
                    row_idx += 1
                continue
            elif stripped == '];':
                in_raw = False
                new_lines.append(line)
                continue
            else:
                new_lines.append(line)
                continue
        else:
            new_lines.append(line)

    # Write backup first
    backup_path = Path('data.js.backup')
    backup_path.write_text(text, encoding='utf-8')
    print(f"\nBackup saved to data.js.backup")

    # Write fixed file
    Path('data.js').write_text('\n'.join(new_lines), encoding='utf-8')
    print(f"data.js updated successfully")
    print(f"\nRun check_duplicates.py again to verify everything looks clean")


if __name__ == '__main__':
    main()