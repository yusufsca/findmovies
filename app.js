/* Duspeakingclub Movies Challenge – 2 takımlı Tabu */
(() => {
  const $ = s => document.querySelector(s);
  const SCREENS = ['setup', 'rules', 'ready', 'game', 'round', 'final'];
  const show = id => SCREENS.forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Ayarlar ---------- */
  const KEY = 'dsc-settings-v3';
  const DEFAULTS = { teams: ['Takım 1', 'Takım 2'], duration: 60, points: 1, penalty: 0, foul: 1 };
  let settings = { ...DEFAULTS };
  try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  if (!Array.isArray(settings.teams) || settings.teams.length !== 2) settings.teams = [...DEFAULTS.teams];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} };

  let clips = [];
  let state = null;
  let wakeLock = null;
  let rulesFrom = 'setup';

  /* ---------- Ana menü ---------- */
  const fmt = (k, v) => ({ points: `+${v}`, penalty: v ? `−${v}` : '0', foul: v ? `−${v}` : '0' }[k] || v);
  document.querySelectorAll('.stepper').forEach(el => {
    const k = el.dataset.key;
    const refresh = () => { el.querySelector('output').textContent = fmt(k, settings[k]) + (el.dataset.unit || ''); };
    el.innerHTML = '<button type="button" class="step-btn" data-d="-1" aria-label="Azalt">−</button><output></output>' +
                   '<button type="button" class="step-btn" data-d="1" aria-label="Artır">+</button>';
    refresh();
    el.addEventListener('click', e => {
      const b = e.target.closest('.step-btn');
      if (!b) return;
      const step = +el.dataset.step, min = +el.dataset.min, max = +el.dataset.max;
      settings[k] = Math.min(max, Math.max(min, (+settings[k] || 0) + (+b.dataset.d) * step));
      refresh(); save();
    });
  });

  [0, 1].forEach(i => {
    const inp = $('#team' + i);
    inp.value = settings.teams[i];
    inp.addEventListener('input', () => { settings.teams[i] = inp.value; save(); });
  });

  function renderClips() {
    const n = clips.length;
    $('#clipNum').textContent = n;
    $('#clipInfo').textContent = n
      ? 'Sahneler rastgele sırayla gelir, her sahne oyunda yalnızca bir kez çıkar.'
      : 'Henüz sahne yok. clips.json dosyasına sahne eklenmeli.';
  }

  async function loadClips() {
    try {
      const r = await fetch('clips.json', { cache: 'no-store' });
      const data = await r.json();
      clips = Array.isArray(data) ? data.filter(c => c && c.file) : [];
    } catch { clips = []; }
    renderClips();
  }

  /* ---------- Kurallar ---------- */
  function openRules(from) {
    rulesFrom = from;
    $('#ruleOk').textContent = `+${settings.points}`;
    $('#rulePass').textContent = settings.penalty ? `−${settings.penalty}` : '0';
    $('#ruleFoul').textContent = settings.foul ? `−${settings.foul}` : '0';
    show('rules');
    window.scrollTo(0, 0);
  }

  /* ---------- Oyun ---------- */
  const shuffleArr = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function startGame() {
    if (!clips.length) return alert('Henüz sahne yok 🎞️');
    const names = [0, 1].map(i => (settings.teams[i] || '').trim() || `Takım ${i + 1}`);
    state = {
      teams: names.map(name => ({ name, score: 0, right: 0, pass: 0, foul: 0 })),
      turn: 0,
      queue: shuffleArr(clips), qi: 0, total: clips.length,
      round: { right: 0, pass: 0, foul: 0 },
      current: null, finished: false,
      paused: false, endAt: 0, pausedLeft: 0, timeLeft: 0, tick: null
    };
    showReady();
  }

  const idx = () => state.turn % 2;
  const cur = () => state.teams[idx()];
  const other = () => state.teams[1 - idx()];

  function chips(el) {
    el.innerHTML = '';
    state.teams.forEach((t, i) => {
      const d = document.createElement('div');
      d.className = 'score-chip' + (i === idx() ? ' now' : '');
      d.dataset.team = i;
      d.innerHTML = `<i></i>${esc(t.name)} <b>${t.score}</b>`;
      el.appendChild(d);
    });
  }

  function showReady() {
    $('#ready').dataset.team = idx();
    $('#readyTurn').textContent = `Tur ${state.turn + 1} · Kalan sahne: ${state.total - state.qi}`;
    $('#readyName').textContent = cur().name;
    chips($('#readyScores'));
    show('ready');
  }

  function playVideo() { const p = $('#video').play(); if (p && p.catch) p.catch(() => {}); }

  function updateMeta() {
    $('#game').dataset.team = idx();
    $('#hudMeta').textContent = `${cur().name} · ⭐ ${cur().score} · 🎞️ ${state.qi}/${state.total}`;
  }

  // Ekranda görünen ad: JSON'daki title, yoksa dosya adından üretilir (squid-game_1.mp4 → Squid Game 1)
  function titleOf(c) {
    if (c.title && String(c.title).trim()) return String(c.title).trim();
    let n = String(c.file || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    try { n = decodeURIComponent(n); } catch {}
    n = n.replace(/[-_]+/g, ' ').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim();
    return n.replace(/(^|\s)[a-z]/g, m => m.toUpperCase()) || 'Sahne';
  }

  function renderBanned(clip) {
    const box = $('#banned');
    box.innerHTML = '';
    const list = Array.isArray(clip.banned) ? clip.banned : [];
    list.forEach(w => { const s = document.createElement('span'); s.textContent = '🚫 ' + w; box.appendChild(s); });
    box.classList.toggle('hidden', !list.length);
  }

  // Sıradaki sahne. Sahne kalmadıysa tur ve oyun biter.
  function advance() {
    if (state.qi >= state.queue.length) {
      state.current = null;
      state.finished = true;
      endRound();
      return false;
    }
    const clip = state.queue[state.qi++];
    state.current = clip;
    const v = $('#video');
    v.muted = true;
    v.src = clip.file;
    playVideo();
    renderBanned(clip);
    $('#clipTitle').textContent = '🎬 ' + titleOf(clip);
    updateMeta();
    return true;
  }

  // start/end desteği (saniye)
  $('#video').addEventListener('loadedmetadata', () => {
    const c = state && state.current;
    if (c && c.start) $('#video').currentTime = c.start;
  });
  $('#video').addEventListener('timeupdate', () => {
    const c = state && state.current, v = $('#video');
    if (c && c.end && v.currentTime >= c.end) v.currentTime = c.start || 0;
  });

  async function keepAwake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
  function releaseAwake() { try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; }

  function startRound() {
    state.round = { right: 0, pass: 0, foul: 0 };
    state.paused = false;
    state.timeLeft = settings.duration;
    $('#okHint').textContent = `+${settings.points}`;
    $('#passHint').textContent = settings.penalty ? `−${settings.penalty}` : '0';
    $('#foulHint').textContent = settings.foul ? `−${settings.foul}` : '0';
    $('#toast').classList.add('hidden');
    $('#pauseOverlay').classList.add('hidden');
    show('game');
    keepAwake();
    if (!advance()) return;
    state.endAt = Date.now() + settings.duration * 1000;
    clearInterval(state.tick);
    state.tick = setInterval(tick, 200);
    tick();
  }

  function tick() {
    if (!state || state.paused) return;
    state.timeLeft = Math.max(0, (state.endAt - Date.now()) / 1000);
    const secs = Math.ceil(state.timeLeft);
    const t = $('#timer');
    t.textContent = secs;
    t.classList.toggle('low', secs <= 10);
    $('#timebar').style.width = (state.timeLeft / settings.duration * 100) + '%';
    if (state.timeLeft <= 0) endRound();
  }

  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + kind;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.add('hidden'), 1500);
  }

  function mark(kind) {
    if (!state || state.paused || !state.current) return;
    const t = cur();
    if (kind === 'ok') {
      t.score += settings.points; t.right++; state.round.right++;
      toast(`✓ +${settings.points}`, 'ok');
      if (navigator.vibrate) navigator.vibrate(40);
    } else if (kind === 'pass') {
      t.score -= settings.penalty; t.pass++; state.round.pass++;
      toast(settings.penalty ? `⏭ Pas −${settings.penalty}` : '⏭ Pas', 'pass');
    } else {
      t.score -= settings.foul; t.foul++; state.round.foul++;
      toast(settings.foul ? `⚠️ İhlal −${settings.foul}` : '⚠️ İhlal', 'foul');
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    }
    advance();
  }

  function pause(p) {
    if (!state || p === state.paused) return;
    state.paused = p;
    if (p) { state.pausedLeft = state.timeLeft; $('#video').pause(); }
    else { state.endAt = Date.now() + state.pausedLeft * 1000; playVideo(); }
    $('#pauseOverlay').classList.toggle('hidden', !p);
  }

  function endRound() {
    clearInterval(state.tick);
    releaseAwake();
    $('#video').pause();
    // Süre dolarken yarım kalan sahne, kalan sahneler arasında rastgele bir yere geri döner
    if (!state.finished && state.current) {
      const at = state.qi - 1;
      const [c] = state.queue.splice(at, 1);
      const remain = state.queue.length - at;
      state.queue.splice(at + Math.floor(Math.random() * (remain + 1)), 0, c);
      state.qi--;
      state.current = null;
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    $('#round').dataset.team = idx();
    $('#roundEmoji').textContent = state.finished ? '🎞️' : '⏰';
    $('#roundTitle').textContent = state.finished ? 'Sahneler bitti!' : 'Süre doldu!';
    $('#roundWho').textContent = cur().name;
    const r = state.round;
    $('#roundStats').innerHTML =
      `<div class="stat ok"><b>${r.right}</b>Bildi</div>` +
      `<div class="stat pass"><b>${r.pass}</b>Pas</div>` +
      `<div class="stat foul"><b>${r.foul}</b>İhlal</div>`;
    chips($('#roundScores'));
    $('#nextTeamBtn').textContent = state.finished ? 'Sonuçlar 🏆' : `Sıra: ${other().name} ▶`;
    $('#finishBtn').classList.toggle('hidden', state.finished);
    show('round');
  }

  function afterRound() {
    if (state.finished) return showFinal();
    state.turn++;
    showReady();
  }

  function confetti() {
    const box = $('#confetti');
    const em = ['🎉', '🎊', '⭐', '🍿', '🎬', '✨'];
    for (let i = 0; i < 36; i++) {
      const s = document.createElement('span');
      s.textContent = em[i % em.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.fontSize = (18 + Math.random() * 18) + 'px';
      s.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
      s.style.animationDelay = (Math.random() * 1.2) + 's';
      box.appendChild(s);
    }
    setTimeout(() => { box.innerHTML = ''; }, 6500);
  }

  function showFinal() {
    clearInterval(state.tick);
    const [a, b] = state.teams;
    const tie = a.score === b.score;
    const best = Math.max(a.score, b.score);
    $('#finalTitle').textContent = tie ? '🤝 Berabere!' : `${(a.score > b.score ? a : b).name} kazandı!`;
    const ol = $('#ranking');
    ol.innerHTML = '';
    state.teams.map((t, i) => ({ t, i })).sort((x, y) => y.t.score - x.t.score).forEach(({ t, i }) => {
      const li = document.createElement('li');
      li.dataset.team = i;
      if (t.score === best) li.className = 'win';
      li.innerHTML = `<i></i><span>${esc(t.name)}</span><b>${t.score}</b>`;
      ol.appendChild(li);
    });
    const sum = k => a[k] + b[k];
    $('#finalStats').textContent = `Bildi ${sum('right')} · Pas ${sum('pass')} · İhlal ${sum('foul')} · Toplam ${state.total} sahne`;
    show('final');
    if (sum('right') > 0) confetti();
  }

  function goHome(ask) {
    if (ask && state) {
      const inGame = !$('#game').classList.contains('hidden');
      const wasPaused = state.paused;
      if (inGame && !wasPaused) pause(true);
      if (!confirm('Oyunu bırakıp ana menüye dönmek istiyor musun? Puanlar silinir.')) {
        if (inGame && !wasPaused) pause(false);
        return;
      }
    }
    if (state) clearInterval(state.tick);
    releaseAwake();
    const v = $('#video');
    v.pause();
    v.removeAttribute('src');
    try { v.load(); } catch {}
    state = null;
    $('#confetti').innerHTML = '';
    renderClips();
    show('setup');
    window.scrollTo(0, 0);
  }

  /* ---------- Olaylar ---------- */
  $('#startGame').onclick = startGame;
  $('#rulesBtn').onclick = () => openRules('setup');
  $('#readyRules').onclick = () => openRules('ready');
  $('#rulesBack').onclick = () => show(rulesFrom);
  $('#rulesOk').onclick = () => show(rulesFrom);
  $('#goBtn').onclick = startRound;
  $('#nextBtn').onclick = () => mark('ok');
  $('#passBtn').onclick = () => mark('pass');
  $('#foulBtn').onclick = () => mark('foul');
  $('#pauseBtn').onclick = () => pause(true);
  $('#resumeBtn').onclick = () => pause(false);
  $('#homeBtn').onclick = () => goHome(true);
  $('#pauseHome').onclick = () => goHome(true);
  $('#readyHome').onclick = () => goHome(true);
  $('#nextTeamBtn').onclick = afterRound;
  $('#finishBtn').onclick = showFinal;
  $('#againBtn').onclick = startGame;
  $('#backBtn').onclick = () => goHome(false);

  // Sekme gizlenirse sayaç sapmasın diye otomatik duraklat
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state && !$('#game').classList.contains('hidden')) pause(true);
  });

  loadClips();
  show('setup');
})();
