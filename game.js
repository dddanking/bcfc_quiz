const EASY_OPPONENTS = [
  "Aston Villa", "Wolverhampton Wanderers", "West Bromwich Albion",
  "Arsenal", "Chelsea", "Manchester United", "Liverpool",
  "Tottenham Hotspur"
];

const TIER1_CLASSICS = new Set([
  "2002-03|16 September 2002|Aston Villa",
  "2002-03|3 March 2003|Aston Villa",
  "2002-03|23 February 2003|Liverpool",
  "2003-04|22 February 2004|Aston Villa",
  "2003-04|27 March 2004|Leeds United",
  "2004-05|6 November 2004|Liverpool",
  "2004-05|12 December 2004|Aston Villa",
  "2004-05|12 February 2005|Liverpool",
  "2004-05|20 March 2005|Aston Villa",
  "2004-05|15 May 2005|Arsenal",
  "2005-06|27 August 2005|West Bromwich Albion",
  "2007-08|2 December 2007|Tottenham Hotspur",
  "2010-11|16 January 2011|Aston Villa",
  "2010-11|20 November 2010|Chelsea",
  "2011-12|14 January 2012|Millwall",
  "2013-14|21 September 2013|Sheffield Wednesday",
  "2014-15|13 December 2014|Reading",
  "2016-17|30 October 2016|Aston Villa",
  "2018-19|9 February 2019|Queens Park Rangers",
  "2019-20|31 August 2019|Stoke City",
]);

const TIER2_CLASSICS = new Set([
  "2002-03|22 March 2003|West Bromwich Albion",
  "2003-04|25 April 2004|Wolverhampton Wanderers",
  "2004-05|18 December 2004|West Bromwich Albion",
  "2005-06|21 January 2006|Portsmouth",
  "2006-07|28 October 2006|West Bromwich Albion",
  "2006-07|22 April 2007|Wolverhampton Wanderers",
  "2007-08|1 March 2008|Tottenham Hotspur",
  "2007-08|11 May 2008|Blackburn Rovers",
  "2008-09|6 April 2009|Wolverhampton Wanderers",
  "2009-10|29 November 2009|Wolverhampton Wanderers",
  "2009-10|7 February 2010|Wolverhampton Wanderers",
  "2011-12|31 January 2012|Leeds United",
  "2012-13|29 March 2013|Crystal Palace",
  "2013-14|1 October 2013|Millwall",
  "2014-15|11 April 2015|Wolverhampton Wanderers",
  "2015-16|12 September 2015|Bristol City",
  "2015-16|7 November 2015|Fulham",
  "2016-17|18 October 2016|Rotherham United",
  "2016-17|24 February 2017|Wolverhampton Wanderers",
  "2021-22|21 August 2021|Luton Town",
  "2021-22|3 April 2022|West Bromwich Albion",
  "2022-23|14 September 2022|West Bromwich Albion",
  "2022-23|10 February 2023|West Bromwich Albion",
  "2022-23|4 February 2023|Swansea City",
  "2023-24|3 October 2023|Huddersfield Town",
  "2023-24|6 October 2023|West Bromwich Albion",
  "2024-25|5 April 2025|Barnsley",
]);

const ALL_SEASONS = [...new Set(RAW.map(r => r[6]))].sort();
const CURRENT_YEAR = new Date().getFullYear();
let hardMode = false;

function getSeasonYear(season) {
  try { return parseInt(season.split('-')[0]); }
  catch { return 0; }
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function buildMatches(rows) {
  const map = {};
  rows.forEach(r => {
    const [date, venue, opponent, result, score, scorer, season, competition] = r;
    if (!scorer) return;
    const key = `${season}|${date}|${opponent}`;
    if (!map[key]) map[key] = { date, venue, opponent, result, score, season, competition, scorers: {} };
    map[key].scorers[scorer] = (map[key].scorers[scorer] || 0) + 1;
  });
  return Object.values(map).filter(m => Object.keys(m.scorers).length > 0);
}

function buildScorerFrequency(matches) {
  const freq = {};
  matches.forEach(m => {
    Object.keys(m.scorers).forEach(s => {
      freq[s] = (freq[s] || 0) + m.scorers[s];
    });
  });
  return freq;
}

function getBirminghamGoals(score) {
  try {
    const parts = score.split('–');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]);
  } catch { return 0; }
}

function isClassic(match) {
  const key = `${match.season}|${match.date}|${match.opponent}`;
  return TIER1_CLASSICS.has(key) || TIER2_CLASSICS.has(key);
}

function isTier1(match) {
  return TIER1_CLASSICS.has(`${match.season}|${match.date}|${match.opponent}`);
}

function isTier2(match) {
  return TIER2_CLASSICS.has(`${match.season}|${match.date}|${match.opponent}`);
}

function getOpponentWeight(opponent, competition) {
  if (EASY_OPPONENTS.some(o => opponent.includes(o))) return -30;
  if (competition.includes('Premier League')) return -15;
  if (competition === 'EFL League One') return 10;
  return 0;
}

function getResultWeight(result, venue) {
  if (result === 'W' && venue === 'A') return -25;
  if (result === 'W') return -20;
  if (result === 'L') return 15;
  return 0;
}

function getGoalWeight(goals) {
  if (goals >= 4) return -20;
  if (goals === 3) return -15;
  if (goals === 2) return -10;
  return 0;
}

function getScorerWeight(match, freq) {
  const maxFreq = Math.max(...Object.keys(match.scorers).map(s => freq[s] || 0));
  if (maxFreq >= 20) return -20;
  if (maxFreq >= 10) return -15;
  if (maxFreq >= 5) return -5;
  return 10;
}

function getRecencyWeight(season) {
  const year = getSeasonYear(season);
  const currentSeasonYear = CURRENT_YEAR - 1;
  const age = currentSeasonYear - year;
  if (age <= 3) return -5;
  if (age <= 8) return 0;
  return 5;
}

function scoreDifficulty(match, freq) {
  const goals = getBirminghamGoals(match.score);
  let score = 30;
  score += getOpponentWeight(match.opponent, match.competition);
  score += getResultWeight(match.result, match.venue);
  score += getGoalWeight(goals);
  score += getScorerWeight(match, freq);
  score += getRecencyWeight(match.season);
  if (isTier1(match)) score -= 30;
  else if (isTier2(match)) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function getDifficultyTier(score) {
  if (score < 35) return 'easy';
  if (score < 65) return 'medium';
  return 'hard';
}

function getMaxDifficulty(streak) {
  if (streak <= 5) return 15;
  if (streak <= 9) return 35;
  if (streak <= 14) return 55;
  if (streak <= 19) return 75;
  return 100;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_MATCHES = buildMatches(RAW);
const SCORER_FREQ = buildScorerFrequency(ALL_MATCHES);

ALL_MATCHES.forEach(m => {
  m.difficulty = scoreDifficulty(m, SCORER_FREQ);
  m.tier = getDifficultyTier(m.difficulty);
  m.classic = isClassic(m);
  m.tier1 = isTier1(m);
  m.tier2 = isTier2(m);
});

let lives = 5, streak = 0, best = 0;
let current = null, answered = false, hintUsed = false;
let seasonMin = ALL_SEASONS[0];
let seasonMax = ALL_SEASONS[ALL_SEASONS.length - 1];
let filteredPool = [];
let usedMatches = new Set();
let firstQuestion = 1;

function buildPool() {
  usedMatches = new Set();
  filteredPool = shuffle(
    ALL_MATCHES.filter(m => {
      const year = getSeasonYear(m.season);
      const minYear = getSeasonYear(seasonMin);
      const maxYear = getSeasonYear(seasonMax);
      return year >= minYear && year <= maxYear;
    })
  );
}

function setMastheadOpponent(name) {
  const el = document.getElementById('masthead-blank');
  if (el) el.textContent = name || '___';
}

function weightedPick(pool) {
  const weighted = [];
  pool.forEach(m => {
    const weight = Math.round((100 - m.difficulty) / 10) + 1;
    for (let i = 0; i < weight; i++) weighted.push(m);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function pickMatch() {
  answered = false;
  hintUsed = false;

  const unused = key => !usedMatches.has(key);
  const matchKey = m => `${m.season}|${m.date}|${m.opponent}`;

  if (firstQuestion <= 3) {
    const pool = filteredPool.filter(m => unused(matchKey(m)) && m.tier1 && m.result === 'W');
    if (pool.length) {
      current = weightedPick(pool);
      firstQuestion++;
      usedMatches.add(matchKey(current));
      setMastheadOpponent(current.opponent);
      renderQuestion();
      return;
    }
    firstQuestion++;
  }

  if (firstQuestion <= 8) {
    const pool = filteredPool.filter(m => unused(matchKey(m)) && (m.tier1 || m.tier2) && m.result === 'W');
    if (pool.length) {
      current = weightedPick(pool);
      firstQuestion++;
      usedMatches.add(matchKey(current));
      setMastheadOpponent(current.opponent);
      renderQuestion();
      return;
    }
    firstQuestion++;
  }

  const maxDiff = getMaxDifficulty(streak);
  const winsOnly = streak <= 7;

  const available = filteredPool.filter(m =>
    unused(matchKey(m)) &&
    m.difficulty <= maxDiff &&
    (!winsOnly || m.result === 'W')
  );

  if (!available.length) {
    const anyLeft = filteredPool.filter(m => unused(matchKey(m)));
    if (!anyLeft.length) {
      showGameOver("You've seen every match in this range!");
      return;
    }
    current = weightedPick(anyLeft);
  } else {
    current = weightedPick(available);
  }

  usedMatches.add(matchKey(current));
  setMastheadOpponent(current.opponent);
  renderQuestion();
}

function loseLife() {
  lives = Math.max(0, lives - 1);
  updateHUD();
  return lives === 0;
}

function updateHUD() {
  const filled = '●'.repeat(lives);
  const empty = '○'.repeat(5 - lives);
  document.getElementById('lives-hud').textContent = filled + empty;
  document.getElementById('streak-hud').textContent = streak;
  document.getElementById('best-hud').textContent = best;
}

function getResultWord(result) {
  if (result === 'W') return 'Win';
  if (result === 'L') return 'Loss';
  return 'Draw';
}

function buildHint() {
  return Object.entries(current.scorers).map(([name, count]) => {
    const surname = name.trim().split(' ').pop();
    const masked = surname[0] + '_'.repeat(surname.length - 1);
    return count > 1 ? `${masked} (${count})` : masked;
  }).join(', ');
}

function doHint() {
  if (hintUsed) return;
  hintUsed = true;
  const dead = loseLife();
  const fb = document.getElementById('fb');
  if (fb) fb.innerHTML = `<span style="color:#0033aa">${buildHint()}</span>`;
  document.getElementById('btn-hint').disabled = true;
  if (dead) { renderReveal(false, 'Hint'); setTimeout(() => showGameOver(), 1500); }
}

function renderStartScreen() {
  firstQuestion = 1;
  setMastheadOpponent('___');
  document.getElementById('hud-bar').classList.remove('visible');

  document.getElementById('game').innerHTML = `
    <div class="start-area">
      <p class="start-intro">
        You'll be shown a Birmingham City match. Name a scorer from that game to earn a point.
        Get it wrong or skip and you lose a life. You've got five lives.
      </p>

      <div class="era-section">
        <div class="era-label">Pick your era</div>
        <div class="era-row">
          <select id="season-min-start" onchange="updateStartSeasonRange()">
            ${ALL_SEASONS.map(s => `<option value="${s}" ${s === seasonMin ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <span class="era-to">to</span>
          <select id="season-max-start" onchange="updateStartSeasonRange()">
            ${ALL_SEASONS.map(s => `<option value="${s}" ${s === seasonMax ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <span class="pool-count" id="pool-count-start"></span>
        </div>
        <p style="font-size:13px;color:#666;margin-top:8px;font-style:italic">
          The score is shown by default, which might help jog your memory.
          Switch it off below if you want a harder game.
        </p>
      </div>

      <div class="mode-row">
        <button class="mode-btn active" id="btn-normal" onclick="setMode(false)">Score on</button>
        <button class="mode-btn" id="btn-hard" onclick="setMode(true)">Score off</button>
      </div>

      <button class="btn-primary" onclick="startGame()" style="font-size:18px;padding:14px 36px">
        Kick off
      </button>
    </div>
  `;

  buildPool();
  const el = document.getElementById('pool-count-start');
  if (el) el.textContent = `${filteredPool.length} matches`;
}

function updateStartSeasonRange() {
  const minEl = document.getElementById('season-min-start');
  const maxEl = document.getElementById('season-max-start');
  if (!minEl || !maxEl) return;
  seasonMin = minEl.value;
  seasonMax = maxEl.value;
  if (getSeasonYear(seasonMin) > getSeasonYear(seasonMax)) {
    seasonMax = seasonMin;
    maxEl.value = seasonMin;
  }
  buildPool();
  const el = document.getElementById('pool-count-start');
  if (el) el.textContent = `${filteredPool.length} matches`;
}

function setMode(hard) {
  hardMode = hard;
  document.getElementById('btn-normal').classList.toggle('active', !hard);
  document.getElementById('btn-hard').classList.toggle('active', hard);
}

function startGame() {
  lives = 5; streak = 0; firstQuestion = 1;
  buildPool();
  document.getElementById('hud-bar').classList.add('visible');
  updateHUD();
  pickMatch();
}

function renderQuestion() {
  const venueWord = current.venue === 'H' ? 'Home' : 'Away';
  const venueVs = current.venue === 'H' ? 'Home vs' : 'Away at';

  document.getElementById('game').innerHTML = `
    <div class="match-block">
      <div class="competition-label">${current.competition}</div>
      <div class="fixture-date">${current.date}</div>
      <div class="fixture-headline">${venueVs}<br>${current.opponent}</div>
      <div class="info-boxes">
        <div class="info-box yellow">
          <div class="info-box-label">Season</div>
          <div class="info-box-val">${current.season}</div>
          <div class="info-box-sub">${venueWord} fixture</div>
        </div>
        <div class="info-box blue">
          <div class="info-box-label">Result</div>
          ${!hardMode ? `
            <div class="info-box-val">${current.score}</div>
            <div class="info-box-sub">${getResultWord(current.result)}</div>
          ` : `
            <div class="info-box-val">?</div>
            <div class="info-box-sub">Score hidden</div>
          `}
        </div>
      </div>
    </div>
    <div class="game-area">
      <div class="prompt-text">Name a scorer</div>
      <div class="input-wrap">
        <input type="text" id="guess" placeholder="Type a name…" autocomplete="off"/>
        <div class="dd" id="dd" style="display:none"></div>
      </div>
      <div class="actions">
        <button class="btn-primary" onclick="submitGuess()">Guess</button>
        <button class="btn-hint" id="btn-hint" onclick="doHint()">Hint</button>
        <button class="btn-skip" onclick="doSkip()">Skip</button>
      </div>
      <div class="feedback" id="fb"></div>
    </div>
  `;
  setupInput();
  updateHUD();
  document.getElementById('guess').focus();
}

function renderReveal(correct, guessedName) {
  const scorerDisplay = Object.entries(current.scorers)
    .map(([name, count]) => count > 1 ? `${name} (${count})` : name)
    .join(', ');

  const message = correct
    ? `Correct — ${guessedName}`
    : guessedName === 'Skipped'
      ? `Skipped`
      : guessedName === 'Hint'
        ? `Out of hints`
        : `${guessedName} did not score in this match`;

  const venueWord = current.venue === 'H' ? 'Home' : 'Away';
  const venueVs = current.venue === 'H' ? 'Home vs' : 'Away at';

  document.getElementById('game').innerHTML = `
    <div class="match-block">
      <div class="competition-label">${current.competition}</div>
      <div class="fixture-date">${current.date}</div>
      <div class="fixture-headline">${venueVs}<br>${current.opponent}</div>
      <div class="info-boxes">
        <div class="info-box yellow">
          <div class="info-box-label">Season</div>
          <div class="info-box-val">${current.season}</div>
          <div class="info-box-sub">${venueWord} fixture</div>
        </div>
        <div class="info-box blue">
          <div class="info-box-label">Result</div>
          <div class="info-box-val">${current.score}</div>
          <div class="info-box-sub">${getResultWord(current.result)}</div>
        </div>
      </div>
    </div>
    <div class="game-area">
      <div class="feedback ${correct ? 'correct' : 'wrong'}" style="margin-bottom:1rem">${message}</div>
      <div class="reveal-box">
        <div class="reveal-label">Scorers</div>
        <div class="reveal-names">${scorerDisplay}</div>
      </div>
      <div class="actions" style="margin-top:1.25rem">
        <button class="btn-primary" onclick="pickMatch()">Next match</button>
        <button class="btn-secondary" onclick="renderStartScreen()">Change era</button>
      </div>
    </div>
  `;
  updateHUD();
}

function showGameOver(msg) {
  setMastheadOpponent('___');
  document.getElementById('hud-bar').classList.remove('visible');
  document.getElementById('game').innerHTML = `
    <div class="over-box">
      <div class="over-title">Full<br>Time.</div>
      <div class="over-rule"></div>
      <div class="over-stats">
        <div class="over-stat">
          <span class="over-stat-label">Final streak</span>
          <span class="over-stat-val">${streak}</span>
        </div>
        <div class="over-stat">
          <span class="over-stat-label">Best streak</span>
          <span class="over-stat-val">${best}</span>
        </div>
      </div>
      <div class="actions" style="margin-top:1.5rem">
        <button class="btn-primary" onclick="restartFromOver()">Play again</button>
        <button class="btn-secondary" onclick="renderStartScreen()">Change era</button>
      </div>
    </div>
  `;
}

function restartFromOver() {
  lives = 5; streak = 0; firstQuestion = 1;
  buildPool();
  document.getElementById('hud-bar').classList.add('visible');
  updateHUD();
  pickMatch();
}

function doSkip() {
  streak = 0;
  const dead = loseLife();
  renderReveal(false, 'Skipped');
  if (dead) setTimeout(() => showGameOver(), 1500);
}

function submitGuess() {
  const input = document.getElementById('guess');
  if (!input || answered) return;
  const val = input.value.trim();
  if (!val) return;
  const nv = stripAccents(val).toLowerCase();

  const correct = Object.keys(current.scorers).some(s => {
    const ns = stripAccents(s).toLowerCase();
    const parts = ns.split(' ');
    return nv === ns || parts.some(p => p.length > 2 && p === nv);
  });

  if (correct) {
    streak++;
    if (streak > best) best = streak;
    answered = true;
    renderReveal(true, val);
  } else {
    streak = 0;
    const dead = loseLife();
    const fb = document.getElementById('fb');
    if (fb) fb.innerHTML = `<span style="color:#cc0000">${val} did not score in this match. Try again or skip.</span>`;
    if (dead) { renderReveal(false, val); setTimeout(() => showGameOver(), 1500); }
    else { input.value = ''; input.focus(); }
  }
}

function filterNames(q) {
  if (!q || q.length < 2) return [];
  const sq = stripAccents(q);
  return ALL_NAMES.filter(n => stripAccents(n).includes(sq)).slice(0, 8);
}

function setupInput() {
  const input = document.getElementById('guess');
  const dd = document.getElementById('dd');
  if (!input) return;
  let ai = -1;
  input.addEventListener('input', () => {
    const r = filterNames(input.value);
    if (!r.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = r.map(n => `<div class="ddi" data-n="${n}">${n}</div>`).join('');
    dd.style.display = 'block'; ai = -1;
    dd.querySelectorAll('.ddi').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = el.dataset.n;
        dd.style.display = 'none';
        submitGuess();
      });
    });
  });
  input.addEventListener('keydown', e => {
    const items = dd.querySelectorAll('.ddi');
    if (e.key === 'ArrowDown') { e.preventDefault(); ai = Math.min(ai + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('active', i === ai)); if (items[ai]) input.value = items[ai].dataset.n; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ai = Math.max(ai - 1, -1); items.forEach((it, i) => it.classList.toggle('active', i === ai)); if (ai >= 0 && items[ai]) input.value = items[ai].dataset.n; }
    else if (e.key === 'Enter') { dd.style.display = 'none'; submitGuess(); }
    else if (e.key === 'Escape') { dd.style.display = 'none'; }
  });
  input.addEventListener('blur', () => setTimeout(() => { dd.style.display = 'none'; }, 150));
}

buildPool();
renderStartScreen();