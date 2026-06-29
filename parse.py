import re
import json
import sys
from pathlib import Path

def strip_og(text):
    return bool(re.search(r'\bo\.?g\.?\b', text, re.IGNORECASE))

def parse_scorers_modern(scorer_text):
    scorers = []
    if not scorer_text or scorer_text.strip() in ('', '—', '-'):
        return scorers

    parts = scorer_text.split(',')
    current_player = None

    for part in parts:
        part = part.strip()
        if not part:
            continue

        if strip_og(part):
            current_player = None
            continue

        starts_with_minute = bool(re.match(r'^\d', part))

        if starts_with_minute and current_player:
            scorers.append(current_player)
        else:
            cleaned = part
            cleaned = re.sub(r'\(\d+\)', '', cleaned)
            cleaned = re.sub(r'\(pen\.?\)', '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bpen\.?\b', '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bo\.g\.?\b', '', cleaned, flags=re.IGNORECASE)
            cleaned = cleaned.strip()

            name_match = re.match(
                r'^([A-Za-zÀ-žŠšŽžČčÆæØøÅåŁłŃńŚśŹźÐðÞþĆćĐđ\-\'\.]+'
                r'(?:\s[A-Za-zÀ-žŠšŽžČčÆæØøÅåŁłŃńŚśŹźÐðÞþĆćĐđ\-\'\.]+)*)',
                cleaned
            )
            if not name_match:
                continue
            current_player = name_match.group(1).strip()
            scorers.append(current_player)

    return scorers


def parse_scorers_vintage(scorer_text):
    scorers = []
    if not scorer_text or scorer_text.strip() in ('', '—', '-'):
        return scorers

    parts = scorer_text.split(',')

    for part in parts:
        part = part.strip()
        if not part:
            continue

        if strip_og(part):
            continue

        cleaned = re.sub(r'\bpen\.?\b', '', part, flags=re.IGNORECASE).strip()
        count_match = re.search(r'\b(\d+)\s*$', cleaned)
        if count_match:
            count = int(count_match.group(1))
            name = cleaned[:count_match.start()].strip()
        else:
            count = 1
            name = cleaned.strip()

        name_match = re.match(
            r'^([A-Za-zÀ-žŠšŽžČčÆæØøÅåŁłŃńŚśŹźÐðÞþĆćĐđ\-\'\.]+'
            r'(?:\s[A-Za-zÀ-žŠšŽžČčÆæØøÅåŁłŃńŚśŹźÐðÞþĆćĐđ\-\'\.]+)*)',
            name
        )
        if not name_match:
            continue

        player = name_match.group(1).strip()
        for _ in range(count):
            scorers.append(player)

    return scorers


def detect_format(lines):
    for line in lines[:20]:
        cols = line.split('\t')
        if len(cols) >= 6:
            for col in cols[5:]:
                if re.search(r"\d+'", col):
                    return 'modern'
    return 'vintage'


def get_columns(lines):
    """
    Sniff the actual column count from the first data row
    and return appropriate column indices.
    """
    for line in lines:
        if re.match(r'^\s*(Date|Match|No\.)', line, re.IGNORECASE):
            continue
        parts = line.split('\t')
        parts = [p.strip() for p in parts]
        if len(parts) < 6:
            continue

        # Find venue column (H or A)
        venue_idx = None
        for i, p in enumerate(parts):
            if p in ('H', 'A'):
                venue_idx = i
                break

        if venue_idx is None:
            continue

        # Find result column (W, D or L) — should be right after venue
        result_idx = None
        for i in range(venue_idx + 1, min(venue_idx + 3, len(parts))):
            if parts[i] in ('W', 'D', 'L'):
                result_idx = i
                break

        if result_idx is None:
            continue

        score_idx = result_idx + 1
        scorers_idx = result_idx + 2
        opponent_idx = venue_idx - 1
        date_idx = 0

        return {
            'date': date_idx,
            'opponent': opponent_idx,
            'venue': venue_idx,
            'result': result_idx,
            'score': score_idx,
            'scorers': scorers_idx
        }

    return None


def parse_season_file(filepath, season_label, competition_label):
    text = Path(filepath).read_text(encoding='utf-8')
    lines = [l for l in text.splitlines() if l.strip()]

    fmt = detect_format(lines)
    cols = get_columns(lines)

    if cols is None:
        print(f"  WARNING: Could not detect column layout for {filepath}")
        return []

    print(f"  Format: {fmt}")
    print(f"  Columns: {cols}")

    goals = []

    for line in lines:
        if re.match(r'^\s*(Date|Match|No\.)', line, re.IGNORECASE):
            continue

        parts = line.split('\t')
        parts = [p.strip() for p in parts]

        if len(parts) <= cols['scorers']:
            continue

        date        = parts[cols['date']]
        opponent    = parts[cols['opponent']]
        venue       = parts[cols['venue']]
        result      = parts[cols['result']]
        score       = parts[cols['score']]
        scorer_text = parts[cols['scorers']]

        if not date or not opponent:
            continue
        if venue not in ('H', 'A'):
            continue
        if result not in ('W', 'D', 'L'):
            continue

        if fmt == 'modern':
            scorers = parse_scorers_modern(scorer_text)
        else:
            scorers = parse_scorers_vintage(scorer_text)

        for scorer in scorers:
            goals.append([
                date,
                venue,
                opponent,
                result,
                score,
                scorer,
                season_label,
                competition_label
            ])

    return goals


def main():
    print("Birmingham City Goal Parser")
    print("=" * 40)
    print()

    txt_files = sorted(Path('.').glob('*.txt'))
    if not txt_files:
        print("No .txt files found in current directory.")
        sys.exit(1)

    all_goals = []

    for txt_file in txt_files:
        print(f"File: {txt_file}")
        season = input("  Season label (e.g. 2005-06): ").strip()
        competition = input("  Competition (e.g. EFL Championship): ").strip()

        goals = parse_season_file(txt_file, season, competition)
        all_goals.extend(goals)
        print(f"  → {len(goals)} goals parsed")
        print()

    if not all_goals:
        print("No goals found. Check your files and column layout.")
        sys.exit(1)

    output_path = Path('new_seasons.js')
    lines = ['// Paste these rows into the RAW array in data.js\n\n']
    for g in all_goals:
        row = json.dumps(g, ensure_ascii=False)
        lines.append(f'  {row},\n')
    output_path.write_text(''.join(lines), encoding='utf-8')

    print(f"Done. {len(all_goals)} goals written to new_seasons.js")
    print("Copy the rows from new_seasons.js and paste into the RAW array in data.js")


if __name__ == '__main__':
    main()