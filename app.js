/* Duspeakingclub Movies Challenge – 2 takımlı Tabu */
(() => {
  const $ = s => document.querySelector(s);
  const SCREENS = ['setup', 'rules', 'ready', 'game', 'round', 'final'];
  const show = id => SCREENS.forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const video = $('#video');

  /* ---------- Ayarlar ---------- */
  const KEY = 'dsc-settings-v3';
  const DEFAULTS = { teams: ['Takım 1', 'Takım 2'], duration: 60, rounds: 3, points: 1, penalty: 0, foul: 1 };
  let settings = { ...DEFAULTS };
  try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  if (!Array.isArray(settings.teams) || settings.teams.length !== 2) settings.teams = [...DEFAULTS.teams];
  settings.rounds = Math.min(10, Math.max(1, +settings.rounds || DEFAULTS.rounds));
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
      ? 'Sahneler rastgele gelir. Hepsi bitince sıra diğer takıma geçer ve sahneler yeniden karışır.'
      : 'Henüz sahne yok. clips.json dosyasına sahne eklenmeli.';
  }

  async function loadClips() {
    try {
      const r = await fetch('clips.json', { cache: 'no-store' });
      const data = await r.json();
      clips = (Array.isArray(data) ? data : []).filter(c => c && c.file).map(c => {
        const f = String(c.file).trim();
        // Klasör yazılmadıysa (dominik.mp4) önce olduğu gibi, olmazsa clips/ ile denenir
        const bare = !/^(https?:)?\/\//.test(f) && !f.includes('/');
        return { ...c, file: f, _alts: bare ? ['clips/' + f] : [] };
      });
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

  // Karışık sahne havuzu. Yeni havuzun ilk sahnesi, bir önceki havuzun son sahnesi olmasın.
  function freshQueue(avoid) {
    const q = shuffleArr(clips);
    if (avoid && q.length > 1 && q[0] === avoid) {
      const j = 1 + (Math.random() * (q.length - 1) | 0);
      [q[0], q[j]] = [q[j], q[0]];
    }
    return q;
  }

  function startGame() {
    if (!clips.length) return alert('Henüz sahne yok 🎞️');
    const names = [0, 1].map(i => (settings.teams[i] || '').trim() || `Takım ${i + 1}`);
    state = {
      teams: names.map(name => ({ name, score: 0, right: 0, pass: 0, foul: 0 })),
      turn: 0, rounds: settings.rounds, totalTurns: settings.rounds * 2,
      queue: freshQueue(), qi: 0, total: clips.length,
      round: { right: 0, pass: 0, foul: 0 },
      current: null, last: null, exhausted: false,
      paused: false, endAt: 0, pausedLeft: 0, timeLeft: 0, tick: null
    };
    showReady();
  }

  const idx = () => state.turn % 2;
  const cur = () => state.teams[idx()];
  const other = () => state.teams[1 - idx()];
  const isLastTurn = () => state.turn + 1 >= state.totalTurns;

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
    $('#readyTurn').textContent = `Tur ${Math.floor(state.turn / 2) + 1}/${state.rounds} · Kalan sahne: ${state.total - state.qi}`;
    $('#readyName').textContent = cur().name;
    chips($('#readyScores'));
    show('ready');
  }

  function playVideo() { const p = video.play(); if (p && p.catch) p.catch(() => {}); }

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

  /* ---------- Video hataları ---------- */
  const vErr = $('#videoError');
  const showVideoError = msg => { vErr.textContent = msg; vErr.classList.remove('hidden'); };
  const hideVideoError = () => vErr.classList.add('hidden');

  async function diagnose(c) {
    let msg;
    try {
      const r = await fetch(c.file, { method: 'HEAD', cache: 'no-store' });
      msg = r.ok
        ? `⚠️ Video bulundu ama oynatılamıyor:\n${c.file}\nFormat uyumsuz olabilir (H.265/HEVC, .mov). H.264 mp4 olarak yeniden dönüştür.`
        : `⚠️ Video bulunamadı (${r.status}):\n${c.file}\nDosya adı, klasör ve büyük/küçük harf birebir aynı olmalı.`;
    } catch {
      msg = `⚠️ Video yüklenemedi:\n${c.file}\nİnternet bağlantını ve dosya yolunu kontrol et.`;
    }
    if (state && state.current === c) showVideoError(msg + '\nPas ile geçebilirsin.');
  }

  video.addEventListener('error', () => {
    const c = state && state.current;
    if (!c || !video.getAttribute('src')) return;
    if (c._alts && c._alts.length) { c.file = c._alts.shift(); video.src = c.file; playVideo(); return; }
    diagnose(c);
  });

  // Sıradaki sahne. Sahneler bittiyse tur biter ve sıra diğer takıma geçer.
  function advance() {
    hideVideoError();
    if (state.qi >= state.queue.length) {
      state.current = null;
      state.exhausted = true;
      endRound();
      return false;
    }
    const clip = state.queue[state.qi++];
    state.current = clip;
    state.last = clip;
    video.muted = true;
    video.src = clip.file;
    playVideo();
    renderBanned(clip);
    $('#clipTitle').textContent = '🎬 ' + titleOf(clip);
    updateMeta();
    return true;
  }

  video.addEventListener('loadedmetadata', () => {
    const c = state && state.current;
    if (!c) return;
    if (!video.videoWidth) {
      showVideoError(`⚠️ Video görüntüsü açılamıyor (görüntü yok):\n${c.file}\nBüyük ihtimalle H.265/HEVC. H.264 mp4 olarak yeniden dönüştür.\nPas ile geçebilirsin.`);
      return;
    }
    if (c.start) video.currentTime = c.start;   // start/end desteği (saniye)
  });
  video.addEventListener('loadeddata', () => { if (video.videoWidth) hideVideoError(); });
  video.addEventListener('timeupdate', () => {
    const c = state && state.current;
    if (c && c.end && video.currentTime >= c.end) video.currentTime = c.start || 0;
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
    if (p) { state.pausedLeft = state.timeLeft; video.pause(); }
    else { state.endAt = Date.now() + state.pausedLeft * 1000; playVideo(); }
    $('#pauseOverlay').classList.toggle('hidden', !p);
  }

  function endRound() {
    clearInterval(state.tick);
    releaseAwake();
    video.pause();
    hideVideoError();
    // Süre dolarken yarım kalan sahne, kalan sahneler arasında rastgele bir yere geri döner
    if (!state.exhausted && state.current) {
      const at = state.qi - 1;
      const [c] = state.queue.splice(at, 1);
      const remain = state.queue.length - at;
      state.queue.splice(at + Math.floor(Math.random() * (remain + 1)), 0, c);
      state.qi--;
      state.current = null;
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const last = isLastTurn();
    $('#round').dataset.team = idx();
    $('#roundEmoji').textContent = state.exhausted ? '🎞️' : '⏰';
    $('#roundTitle').textContent = state.exhausted ? 'Sahneler bitti!' : 'Süre doldu!';
    $('#roundWho').textContent = cur().name + (state.exhausted && !last ? ' · sahneler yeniden karışacak' : '');
    const r = state.round;
    $('#roundStats').innerHTML =
      `<div class="stat ok"><b>${r.right}</b>Bildi</div>` +
      `<div class="stat pass"><b>${r.pass}</b>Pas</div>` +
      `<div class="stat foul"><b>${r.foul}</b>İhlal</div>`;
    chips($('#roundScores'));
    $('#nextTeamBtn').textContent = last ? 'Sonuçlar 🏆' : `Sıra: ${other().name} ▶`;
    $('#finishBtn').classList.toggle('hidden', last);
    show('round');
  }

  function afterRound() {
    if (isLastTurn()) return showFinal();
    state.turn++;
    if (state.exhausted) {            // sahneler bittiyse diğer takım için havuz yeniden karışır
      state.queue = freshQueue(state.last);
      state.qi = 0;
      state.exhausted = false;
    }
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
    $('#finalStats').textContent = `Bildi ${sum('right')} · Pas ${sum('pass')} · İhlal ${sum('foul')}`;
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
    state = null;
    hideVideoError();
    video.pause();
    video.removeAttribute('src');
    try { video.load(); } catch {}
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
