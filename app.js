/* ═══════════════════════════════════════════════
   DAILY BRIEF PWA — App Logic  v17
   Supabase-powered · Web Speech API audio
═══════════════════════════════════════════════ */

const App = (() => {

  // ── State ──────────────────────────────────────
  let db = null;
  let state = {
    view: null,
    prevView: null,
    category: 'all',
    articles: [],
    topics: [],
    selectedTopic: null,
    speech: null,
    isPlaying: false,
    searchResults: { articles: [], topics: [] },
    dailySummary: '',
    browseDate: null,           // which day is showing (YYYY-MM-DD)
    isLive: false,
    developingTopicIds: new Set(),
    pinnedTopics: new Set()
  };

  // ── Category config ────────────────────────────
  const CATS = {
    'world':          { label: 'World News',        icon: '🌏', color: '#2563eb', bg: 'rgba(37,99,235,0.10)' },
    'wars':           { label: 'Wars & Conflicts',  icon: '⚔️', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
    'nz':             { label: 'New Zealand',        icon: '🥝', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
    'nz-politics':    { label: 'NZ Politics',        icon: '🏛', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
    'social-justice': { label: 'Social Justice',     icon: '✊', color: '#d97706', bg: 'rgba(217,119,6,0.10)'  },
    'science':        { label: 'Science',            icon: '🔬', color: '#0891b2', bg: 'rgba(8,145,178,0.10)'  }
  };

  // ── Category urgency order ─────────────────────
  const CAT_URGENCY = { wars:6, world:5, 'nz-politics':4, nz:3, 'social-justice':2, science:1 };

  const URGENCY_KW = ['breaking','killed','dead','attack','crisis','emergency','collapse',
    'shooting','explosion','critical','catastrophe','evacuate','massacre'];

  function urgencyScore(a) {
    let s = CAT_URGENCY[a.category] || 0;
    if (isWarArticle && isWarArticle(a)) s = Math.max(s, 6);
    if (a.is_multi_perspective) s += 0.5;
    const txt = ((a.headline||'')+' '+(a.summary||'')).toLowerCase();
    if (URGENCY_KW.some(k => txt.includes(k))) s += 1;
    return s;
  }

  // ── Source lean lookup ─────────────────────────
  function srcLrScore(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('al jazeera') || n.includes('aljazeera')) return -30;
    if (n.includes('guardian'))          return -35;
    if (n.includes('rnz') || n.includes('radio new zealand')) return -20;
    if (n.includes('newsroom'))          return -15;
    if (n.includes('stuff'))             return -10;
    if (n.includes('nz herald') || n.includes('new zealand herald')) return +12;
    if (n.includes('beehive'))           return +18;
    if (n.includes('act nz') || n.includes('act party')) return +38;
    if (n.includes('national party') || n.includes('national')) return +20;
    if (n.includes('fox'))               return +50;
    if (n.includes('breitbart'))         return +75;
    if (n.includes('daily wire'))        return +60;
    if (n.includes('american conservative')) return +45;
    if (n.includes('reuters') || n.includes('ap news') || n.includes('associated press')) return 0;
    if (n.includes('bbc'))               return -5;
    if (n.includes('cnn'))               return -18;
    if (n.includes('msnbc'))             return -30;
    if (n.includes('atlantic'))          return -8;
    if (n.includes('washington post'))   return -18;
    if (n.includes('new york times'))    return -20;
    if (n.includes('nbc'))               return -15;
    if (n.includes('abc'))               return -15;
    if (n.includes('abc australia'))     return -20;
    if (n.includes('abc news'))          return -15;
    if (n.includes('naacp') || n.includes('aclu')) return -30;
    if (n.includes('sciencedaily') || n.includes('nature') || n.includes('science daily')) return 0;
    if (n.includes('wall street journal') || n.includes('wsj')) return +45;
    if (n.includes('new york post') || n.includes('ny post')) return +40;
    if (n.includes('telegraph'))         return +30;
    if (n.includes('the times') || n.includes('sunday times')) return +18;
    if (n.includes('economist'))         return +5;
    if (n.includes('independent'))       return -10;
    if (n.includes('npr'))               return -12;
    if (n.includes('crisis group') || n.includes('crisisgroup')) return -5;
    return null;
  }

  function leanEmoji(score) {
    if (score == null) return '⚪';
    const s = Number(score);
    if (s < -6) return '🔴';
    if (s > 6)  return '🔵';
    return '⚪';
  }

  function lrLabel(score) {
    if (score == null) return 'Neutral';
    const s = Number(score);
    if (s <= -75) return 'Far Left';
    if (s <= -45) return 'Left';
    if (s <= -20) return 'Centre-Left';
    if (s <= -6)  return 'Slight Left';
    if (s <=  6)  return 'Neutral';
    if (s <=  20) return 'Slight Right';
    if (s <=  45) return 'Centre-Right';
    if (s <=  75) return 'Right';
    return 'Far Right';
  }

  function alLabel(score) {
    if (score == null) return 'Neutral';
    const s = Number(score);
    if (s <= -60) return 'Libertarian';
    if (s <= -20) return 'Slight Libertarian';
    if (s <=  20) return 'Neutral';
    if (s <=  60) return 'Slight Authoritarian';
    return 'Authoritarian';
  }

  function lrColor(score) {
    const s = Number(score || 0);
    if (s <= -20) return '#dc2626';
    if (s >=  20) return '#2563eb';
    return '#9ca3af';
  }

  function alColor(score) {
    const s = Number(score || 0);
    if (s <= -20) return '#059669';
    if (s >=  20) return '#d97706';
    return '#9ca3af';
  }

  function compassDotColor(lr, al) {
    const lrN = lr / 100, alN = al / 100;
    if (Math.abs(lrN) < 0.15 && Math.abs(alN) < 0.15) return '#9ca3af';
    if (lrN <= 0 && alN >= 0) return '#dc2626';
    if (lrN >= 0 && alN >= 0) return '#7c3aed';
    if (lrN <= 0 && alN <= 0) return '#059669';
    return '#d97706';
  }

  // ── Political compass (single-source cards only) ──
  function compassHtml(a) {
    const lr = a.lr_score != null ? Number(a.lr_score) : 0;
    const al = a.al_score != null ? Number(a.al_score) : 0;
    const lrPos = ((lr + 100) / 200 * 100).toFixed(1);
    const alTop = ((100 - al) / 200 * 100).toFixed(1);
    const lrc = lrColor(lr), alc = alColor(al);
    const dotColor = compassDotColor(lr, al);
    return `
      <div class="compass-wrap">
        <div class="compass-outer">
          <div class="cx2-axis cx2-axis-h">Auth</div>
          <div class="cx2-mid-row">
            <div class="cx2-axis cx2-axis-v">L</div>
            <div class="compass-grid">
              <div class="cq cq-tl"></div><div class="cq cq-tr"></div>
              <div class="cq cq-bl"></div><div class="cq cq-br"></div>
              <div class="cx2-cross cx2-cross-h"></div>
              <div class="cx2-cross cx2-cross-v"></div>
              <div class="cx2-dot" style="left:${lrPos}%;top:${alTop}%;background:${dotColor}"></div>
            </div>
            <div class="cx2-axis cx2-axis-v">R</div>
          </div>
          <div class="cx2-axis cx2-axis-h">Lib</div>
        </div>
        <div class="cx2-labels">
          <div class="cx2-lr-lbl" style="color:${lrc}">${lrLabel(lr)}</div>
          <div class="cx2-al-lbl" style="color:${alc}">${alLabel(al)}</div>
        </div>
      </div>`;
  }

  // ── Auth/Lib vertical bar (perspective slides) ──
  // Only shows when |al_score| > 15 (meaningful lean)
  // side: 'left' or 'right'
  function alBarHtml(alScore, side) {
    const al = alScore != null ? Number(alScore) : 0;
    if (Math.abs(al) < 15) return '';
    // alTop: +100 (auth) = 0% top, -100 (lib) = 100% bottom
    const pos = ((100 - al) / 200 * 100).toFixed(1);
    const cls = side === 'left' ? 'al-bar al-bar-left' : 'al-bar al-bar-right';
    return `
      <div class="${cls}">
        <div class="al-label al-auth">Auth</div>
        <div class="al-track"><div class="al-dot" style="top:${pos}%"></div></div>
        <div class="al-label al-lib">Lib</div>
      </div>`;
  }

  // ── Category hero gradient ─────────────────────
  function getCategoryGradient(cat) {
    const g = {
      wars:            'linear-gradient(135deg, #1a0000 0%, #5c1a1a 50%, #8b2222 100%)',
      world:           'linear-gradient(135deg, #0c1445 0%, #1e3a6e 50%, #2563eb 100%)',
      nz:              'linear-gradient(135deg, #002b1a 0%, #065f46 50%, #059669 100%)',
      'nz-politics':   'linear-gradient(135deg, #1e0050 0%, #4c1d95 50%, #7c3aed 100%)',
      'social-justice':'linear-gradient(135deg, #451a00 0%, #92400e 50%, #d97706 100%)',
      science:         'linear-gradient(135deg, #001520 0%, #0c4a6e 50%, #0891b2 100%)',
    };
    return g[cat] || 'linear-gradient(135deg, #0f0f1a 0%, #1e1e3a 100%)';
  }

  // ── Category badge HTML ────────────────────────
  function catBadgeHtml(cat) {
    const c = CATS[cat] || { label: cat, icon: '📄', color: '#6b7280', bg: 'rgba(107,114,128,0.10)' };
    return `<span class="card-tag-cat" style="color:${c.color};background:${c.bg}">${c.icon} ${c.label}</span>`;
  }

  // ── DEMO DATA ──────────────────────────────────
  const DEMO_ARTICLES = [
    {
      id: 'demo-1', date: new Date().toISOString().split('T')[0],
      headline: 'FIFA World Cup 2026: Group Stage Deciders',
      summary: 'Scotland fell 3–0 to Brazil and await their fate as a potential third-place qualifier. South Africa secured knockout progression with a 1–0 win over South Korea.',
      category: 'world', source_1_name: 'ESPN', source_1_url: 'https://www.espn.com',
      is_multi_perspective: true, lr_score: -15, al_score: 10,
      full_content: 'The FIFA World Cup 2026 group stage concludes today. Scotland drew with South Africa while Brazil topped Group C with a 3–0 win. South Africa advance as runners-up. Scotland wait to see if their goal difference is enough for a third-place spot.',
      source_2_name: 'CNN', source_2_url: 'https://www.cnn.com',
      source_2_text: 'Morocco finished on 7 points, level with Brazil, but missed top spot on goal difference. Mexico made it three wins from three in Group A.',
      topics: [{ id: 't1', name: 'FIFA World Cup 2026' }, { id: 't2', name: 'Brazil' }]
    },
    {
      id: 'demo-2', date: new Date().toISOString().split('T')[0],
      headline: 'Iran Nuclear Inspections: IAEA Says Access "Will Happen"',
      summary: 'The head of the UN nuclear watchdog stated IAEA inspections of Iran\'s nuclear sites will take place, following US-Iran negotiations. Timing remains unconfirmed.',
      category: 'world', source_1_name: 'CBS News', source_1_url: 'https://www.cbsnews.com',
      lr_score: -12, al_score: 35,
      topics: [{ id: 't3', name: 'Iran Nuclear Deal' }, { id: 't4', name: 'IAEA' }]
    },
    {
      id: 'demo-3', date: new Date().toISOString().split('T')[0],
      headline: 'National Promises Compulsory KiwiSaver with $1,500 Baby Bonus',
      summary: 'At its annual conference, National announced plans to make KiwiSaver compulsory for all workers and to auto-enrol newborns with a $1,500 government contribution.',
      category: 'nz-politics', source_1_name: 'NZ Herald', source_1_url: 'https://www.nzherald.co.nz',
      lr_score: 18, al_score: 20,
      topics: [{ id: 't5', name: 'NZ Election 2026' }, { id: 't6', name: 'KiwiSaver' }]
    },
    {
      id: 'demo-4', date: new Date().toISOString().split('T')[0],
      headline: 'Health & Safety at Work Bill Draws Parliament Rally',
      summary: 'Trade unions rallied at Parliament opposing changes to the Health and Safety at Work Bill. Pike River families warn changes will "undoubtedly lead to more injuries."',
      category: 'nz-politics', source_1_name: 'NZCTU', source_1_url: 'https://union.org.nz',
      is_multi_perspective: true, lr_score: -25, al_score: -10,
      full_content: 'Parliament is debating changes to the Health and Safety at Work Act. Unions and Pike River families oppose the amendments, arguing they weaken protections for workers. The Government says the reforms reduce red tape for small businesses.',
      source_2_name: 'Beehive.govt.nz', source_2_url: 'https://www.beehive.govt.nz',
      source_2_text: 'The Government argues the reforms reduce compliance burden on small businesses while maintaining core safety protections for workers across New Zealand.',
      topics: [{ id: 't7', name: 'Workplace Safety NZ' }]
    },
    {
      id: 'demo-5', date: new Date().toISOString().split('T')[0],
      headline: 'China Business Summit Opens in Auckland; India FTA Details Emerge',
      summary: 'A major Chinese business delegation summit is underway in Auckland today, coinciding with fresh details on New Zealand\'s free-trade agreement with India.',
      category: 'nz', source_1_name: 'NZ Herald', source_1_url: 'https://www.nzherald.co.nz',
      lr_score: 5, al_score: 15,
      topics: [{ id: 't8', name: 'NZ-China Relations' }, { id: 't9', name: 'NZ-India FTA' }]
    },
    {
      id: 'demo-6', date: new Date().toISOString().split('T')[0],
      headline: 'Louisiana Redistricting Ruling Challenged as Attack on Black Voters',
      summary: 'Advocates call the outcome in Louisiana vs. Callais a direct undermining of Black voter representation, arguing redistricting dilutes majority-Black voting communities.',
      category: 'social-justice', source_1_name: 'Public News Service', source_1_url: 'https://www.publicnewsservice.org',
      lr_score: -30, al_score: -20,
      topics: [{ id: 't10', name: 'Voting Rights USA' }]
    },
    {
      id: 'demo-7', date: new Date().toISOString().split('T')[0],
      headline: 'Earliest Human Fire Use Confirmed at 1.79 Million Years Ago',
      summary: 'A peer-reviewed study found burned bones deep inside South Africa\'s Wonderwerk Cave dating to 1.79 million years ago — the oldest confirmed evidence of deliberate fire use by early humans.',
      category: 'science', source_1_name: 'ScienceDaily', source_1_url: 'https://sciencedaily.com',
      lr_score: 0, al_score: 0,
      topics: [{ id: 't11', name: 'Human Evolution' }]
    },
    {
      id: 'demo-8', date: new Date().toISOString().split('T')[0],
      headline: 'Single Amino Acid Change Can Completely Alter Coronavirus Behaviour',
      summary: 'A new study found that one tiny genetic difference dramatically changes how a coronavirus interacts with immune systems across species.',
      category: 'science', source_1_name: 'ScienceDaily', source_1_url: 'https://sciencedaily.com',
      lr_score: 0, al_score: 0,
      topics: [{ id: 't12', name: 'Coronavirus Research' }]
    }
  ];

  const DEMO_SUMMARY = "New Zealand enters the final stretch before its November election, with National announcing compulsory KiwiSaver and Parliament passing significant legislation. Globally, the FIFA World Cup 2026 group stage concludes today. In science, researchers confirmed the earliest-ever evidence of fire use (1.79 million years ago).";

  const DEMO_TOPICS = [
    { id: 't3', name: 'Iran Nuclear Deal', category: 'world', article_count: 1, background_context: 'Iran\'s nuclear programme has been subject to international scrutiny for decades. The Joint Comprehensive Plan of Action (JCPOA), signed in 2015, placed limits on Iran\'s uranium enrichment in exchange for sanctions relief. The US withdrew under the Trump administration in 2018.' },
    { id: 't5', name: 'NZ Election 2026', category: 'nz-politics', article_count: 2, background_context: 'New Zealand\'s next general election is scheduled for 7 November 2026. The current National-led government faces a Labour-led opposition. Key issues include cost of living, housing affordability, public health reform, and Treaty of Waitangi policy.' },
    { id: 't1', name: 'FIFA World Cup 2026', category: 'world', article_count: 1, background_context: 'The 2026 FIFA World Cup is the first to be hosted jointly by the United States, Canada, and Mexico. It is also the first 48-team World Cup.' },
    { id: 't11', name: 'Human Evolution', category: 'science', article_count: 1, background_context: 'Palaeontology and archaeology continue to revise our understanding of early human behaviour. Key sites across Africa have yielded evidence of early tool use, symbolic thinking, and fire use dating back nearly 1.8 million years.' },
    { id: 't10', name: 'Voting Rights USA', category: 'social-justice', article_count: 1, background_context: 'Voting rights in the United States have been contested since Reconstruction. The Voting Rights Act of 1965 prohibited discriminatory voting practices.' },
    { id: 't12', name: 'Coronavirus Research', category: 'science', article_count: 1, background_context: 'Following the COVID-19 pandemic, scientific research into coronaviruses has intensified. Researchers are studying zoonotic transmission, immune evasion, and genetic variation.' }
  ];

  // ── Date helpers ───────────────────────────────
  function todayStr() {
    const d = new Date();
    return dateToStr(d);
  }

  function dateToStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateToStr(d);
  }

  function offsetDate(dateStr, delta) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return dateToStr(d);
  }

  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fmtDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'long' });
  }

  function catIcon(cat) { return CATS[cat]?.icon || '📄'; }
  function catLabel(cat) { return CATS[cat]?.label || cat; }

  // ── Init ───────────────────────────────────────
  function init() {
    // Load pinned topics from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('pinned_topics') || '[]');
      state.pinnedTopics = new Set(saved);
    } catch (e) { state.pinnedTopics = new Set(); }

    const url = localStorage.getItem('sb_url');
    const key = localStorage.getItem('sb_key');

    if (url && key) {
      connectSupabase(url, key);
      show('screen-app');
      navigate('today', true);
    } else {
      show('screen-setup');
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  function connectSupabase(url, key) {
    try {
      db = supabase.createClient(url, key);
    } catch (e) {
      console.warn('Supabase connection failed, using demo data', e);
      db = null;
    }
  }

  function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
  }

  // ── Setup ──────────────────────────────────────
  function saveSetup() {
    const url = document.getElementById('input-url').value.trim();
    const key = document.getElementById('input-key').value.trim();
    if (!url || !key) return alert('Please enter both your Supabase URL and key.');
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    connectSupabase(url, key);
    show('screen-app');
    navigate('today');
  }

  function showSettings() {
    document.getElementById('settings-url').value = localStorage.getItem('sb_url') || '';
    document.getElementById('settings-key').value = localStorage.getItem('sb_key') || '';
    document.getElementById('settings-overlay').classList.remove('hidden');
  }
  function closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
  }
  function saveSettings() {
    const url = document.getElementById('settings-url').value.trim();
    const key = document.getElementById('settings-key').value.trim();
    if (url && key) {
      localStorage.setItem('sb_url', url);
      localStorage.setItem('sb_key', key);
      connectSupabase(url, key);
    }
    closeSettings();
    navigate('today', true);
  }

  // ── Routing ────────────────────────────────────
  function navigate(view, force = false) {
    if (view === state.view && !force) return;
    state.prevView = state.view;
    state.view = view;

    ['today','topics','search'].forEach(v => {
      document.getElementById(`view-${v}`).classList.add('hidden');
      document.getElementById(`nav-${v}`)?.classList.remove('active');
    });
    document.getElementById('view-topic-detail').classList.add('hidden');

    document.getElementById(`view-${view}`)?.classList.remove('hidden');
    document.getElementById(`nav-${view}`)?.classList.add('active');

    if (view === 'today') loadToday();
    if (view === 'topics') loadTopics();
    if (view === 'search') document.getElementById('search-input').focus();
  }

  function goBack() {
    if (state.prevView) navigate(state.prevView);
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
  }

  // ── Date Navigation ────────────────────────────
  function updateDateHeader() {
    // Update the header date + date nav controls
    const today = todayStr();
    const browseDate = state.browseDate || today;
    const isToday = browseDate === today;
    const label = isToday ? 'Today' : fmtDateShort(browseDate);

    // Update the h1 date
    const dateEl = document.getElementById('today-date');
    if (dateEl) {
      const fullDate = new Date(browseDate + 'T12:00:00');
      dateEl.textContent = fullDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    // Inject/update date nav row
    const navRow = document.getElementById('date-nav-row');
    if (navRow) {
      navRow.innerHTML = `
        <button class="date-nav-btn" onclick="App.prevDay()" title="Previous day">‹</button>
        <span class="date-nav-label">${escHtml(label)}</span>
        <button class="date-nav-btn${isToday ? ' date-nav-disabled' : ''}" onclick="App.nextDay()" ${isToday ? 'disabled' : ''} title="Next day">›</button>
      `;
    }
  }

  async function prevDay() {
    const newDate = offsetDate(state.browseDate || todayStr(), -1);
    await loadDate(newDate);
  }

  async function nextDay() {
    const today = todayStr();
    if (state.browseDate >= today) return;
    const newDate = offsetDate(state.browseDate || today, 1);
    await loadDate(newDate, false); // don't fallback when going forward
  }

  // ── TODAY VIEW ────────────────────────────────
  let _loadTodayId = 0;

  async function loadToday() {
    const myLoadId = ++_loadTodayId;

    // Show skeleton/loading while finding data
    const el = document.getElementById('today-content');
    el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';

    // Update live/demo badge
    const badge = document.getElementById('data-source-badge');
    if (badge) {
      badge.textContent = '● Loading';
      badge.className = 'data-source-badge badge-demo';
    }

    if (!db) {
      // No DB — show demo with yesterday's label
      state.browseDate = todayStr();
      state.isLive = false;
      updateDateHeader();
      renderToday(DEMO_ARTICLES, DEMO_SUMMARY);
      return;
    }

    // Try today, then yesterday, then up to 7 days back
    for (let i = 0; i < 7; i++) {
      const dateStr = daysAgo(i);
      const result = await tryFetchDate(dateStr);
      if (myLoadId !== _loadTodayId) return; // stale, abort

      if (result.articles.length) {
        state.browseDate = dateStr;
        state.isLive = true;
        updateDateHeader();
        // Start developing detection in background
        detectDeveloping().then(devIds => {
          state.developingTopicIds = devIds;
          if (state.category === 'all' && state.view === 'today' && myLoadId === _loadTodayId) {
            renderToday(state.articles, state.dailySummary);
          }
        });
        renderToday(result.articles, result.summary || DEMO_SUMMARY);
        return;
      }
    }

    // No data found at all — show demo
    if (myLoadId !== _loadTodayId) return;
    state.browseDate = todayStr();
    state.isLive = false;
    updateDateHeader();
    renderToday(DEMO_ARTICLES, DEMO_SUMMARY);
  }

  // Load a specific date (used by date nav arrows)
  async function loadDate(dateStr, tryFallback = true) {
    const myLoadId = ++_loadTodayId;

    const el = document.getElementById('today-content');
    el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';

    if (!db) {
      state.browseDate = dateStr;
      state.isLive = false;
      updateDateHeader();
      renderToday(DEMO_ARTICLES, DEMO_SUMMARY);
      return;
    }

    const result = await tryFetchDate(dateStr);
    if (myLoadId !== _loadTodayId) return;

    if (result.articles.length) {
      state.browseDate = dateStr;
      state.isLive = true;
      updateDateHeader();
      renderToday(result.articles, result.summary || DEMO_SUMMARY);
    } else if (tryFallback) {
      // Try previous day
      await loadDate(offsetDate(dateStr, -1), false);
    } else {
      // Show what we have (empty state)
      state.browseDate = dateStr;
      state.isLive = false;
      updateDateHeader();
      renderToday([], '');
    }
  }

  // Fetch articles + summary for a date — returns { articles, summary }
  async function tryFetchDate(dateStr) {
    try {
      const [artsRes, sumRes] = await Promise.race([
        Promise.all([
          db.from('articles')
            .select('*, article_topics(topic_id, topics(id, name))')
            .eq('date', dateStr)
            .order('created_at'),
          db.from('daily_summaries')
            .select('summary')
            .eq('date', dateStr)
            .maybeSingle()
        ]),
        timeout(8000).then(() => { throw new Error('timeout'); })
      ]);

      if (artsRes.error) {
        // Fallback: simple query without join
        const { data: simpleArts } = await db
          .from('articles').select('*').eq('date', dateStr).order('created_at');
        const arts = (simpleArts || []).map(a => ({ ...a, topics: [] }));
        state.articles = arts;
        return { articles: arts, summary: sumRes?.data?.summary || '' };
      }

      const arts = (artsRes.data || []).map(a => ({
        ...a,
        topics: a.article_topics?.map(at => at.topics).filter(Boolean) || []
      }));
      state.articles = arts;
      return { articles: arts, summary: sumRes?.data?.summary || '' };
    } catch (e) {
      console.log('[Daily Brief] Fetch failed for', dateStr, e.message);
      return { articles: [], summary: '' };
    }
  }

  // ── Developing topics detection ────────────────
  async function detectDeveloping() {
    if (!db) return new Set();
    try {
      const since = daysAgo(7);
      const { data: arts } = await db.from('articles')
        .select('date, article_topics(topic_id)')
        .gte('date', since)
        .limit(500);

      const topicDates = {};
      (arts || []).forEach(a => {
        (a.article_topics || []).forEach(at => {
          const tid = at.topic_id;
          if (!topicDates[tid]) topicDates[tid] = new Set();
          topicDates[tid].add(a.date);
        });
      });

      return new Set(
        Object.entries(topicDates)
          .filter(([, dates]) => dates.size >= 3)
          .map(([id]) => id)
      );
    } catch (e) {
      console.warn('[Daily Brief] Developing detection failed:', e.message);
      return new Set();
    }
  }

  // ── Wars filter ────────────────────────────────
  const WAR_KWS = ['drc','congo','ukraine','russia','israel','palestine','gaza','iran',
    'ceasefire','m23','rebel','hamas','hezbollah','missile','airstrike','troops',
    'combat','militia','insurgent','conflict','frontline','occupation','siege'];
  const WARS_TOPIC_ID = 'a2660000-0000-0000-0000-000000000001';

  function isWarArticle(a) {
    if (a.category === 'wars') return true;
    if ((a.topics || []).some(t => t.id === WARS_TOPIC_ID)) return true;
    const text = ((a.headline || '') + ' ' + (a.summary || '')).toLowerCase();
    return WAR_KWS.some(kw => text.includes(kw));
  }

  // ── Pinned topics ──────────────────────────────
  function isPinned(topicId) {
    return state.pinnedTopics.has(topicId);
  }

  function togglePin(topicId, evt) {
    if (evt) evt.stopPropagation();
    if (state.pinnedTopics.has(topicId)) {
      state.pinnedTopics.delete(topicId);
    } else {
      state.pinnedTopics.add(topicId);
    }
    localStorage.setItem('pinned_topics', JSON.stringify([...state.pinnedTopics]));
    // Re-render topics list to update pin icon
    renderTopicsList(state.topics);
  }

  // ── Category filter ────────────────────────────
  function filterCategory(cat) {
    state.category = cat;
    document.querySelectorAll('.pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === cat);
    });

    let filtered;
    if (cat === 'for-you') {
      filtered = renderForYou();
      return;
    } else if (cat === 'all') {
      filtered = state.articles;
    } else if (cat === 'wars') {
      filtered = state.articles.filter(isWarArticle);
    } else {
      filtered = state.articles.filter(a => a.category === cat);
    }

    updateSummaryForCategory(cat, filtered);
    const container = document.getElementById('today-content');
    renderArticleList(container, filtered, false);
  }

  function renderForYou() {
    const container = document.getElementById('today-content');
    // Remove article cards but keep summary card
    container.querySelectorAll('.section-head, .article-card, .persp-card, .empty-state, .for-you-empty').forEach(e => e.remove());

    if (state.pinnedTopics.size === 0) {
      container.insertAdjacentHTML('beforeend', `
        <div class="for-you-empty">
          <div class="for-you-empty-icon">📌</div>
          <div class="for-you-empty-title">No pinned topics yet</div>
          <div class="for-you-empty-desc">Go to the <strong>Topics</strong> tab and tap 📌 on any topic to pin it here.</div>
        </div>`);
      return;
    }

    const pinned = state.articles.filter(a =>
      (a.topics || []).some(t => state.pinnedTopics.has(t.id))
    );

    container.insertAdjacentHTML('beforeend', `
      <div class="section-head">
        <span class="section-icon">📌</span>
        <span class="section-title">Pinned Topics</span>
        <div class="section-line"></div>
      </div>`);

    if (!pinned.length) {
      container.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-icon">📭</span><p>No articles from your pinned topics today.</p></div>');
    } else {
      pinned.forEach(a => container.insertAdjacentHTML('beforeend', renderArticleCard(a)));
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      container.querySelectorAll('.persp-slider.center-start').forEach(s => {
        s.scrollLeft = s.offsetWidth;
      });
    }));
  }

  function updateSummaryForCategory(cat, articles) {
    const tagEl = document.querySelector('.summary-tag');
    const textEl = document.getElementById('summary-text');
    if (!tagEl || !textEl) return;

    if (cat === 'all') {
      tagEl.textContent = '📋 Today at a Glance';
      textEl.textContent = state.dailySummary;
    } else {
      const catInfo = CATS[cat] || {};
      tagEl.textContent = (catInfo.icon || '📋') + ' ' + (catInfo.label || cat) + ' Today';
      if (!articles.length) {
        textEl.textContent = 'No ' + (catInfo.label || cat) + ' articles today.';
      } else {
        const top = articles.slice(0, 4);
        const parts = top.map(a => a.summary || a.headline).filter(Boolean);
        const extra = articles.length > 4 ? ' Plus ' + (articles.length - 4) + ' more stories.' : '';
        textEl.textContent = parts.join(' ') + extra;
      }
    }
    textEl.classList.remove('expanded');
    const toggleBtn = textEl.nextElementSibling;
    if (toggleBtn) toggleBtn.textContent = 'Read more';

    const readAllBtn = document.querySelector('.audio-bar button:last-child');
    if (readAllBtn) {
      const catInfo = CATS[cat] || {};
      readAllBtn.textContent = cat === 'all'
        ? '▶ Read All Headlines'
        : '▶ Read ' + (catInfo.label || cat);
    }
  }

  function renderToday(articles, summary) {
    const el = document.getElementById('today-content');
    state.dailySummary = summary;

    const badge = document.getElementById('data-source-badge');
    if (badge) {
      badge.textContent = state.isLive ? '● Live' : '● Demo';
      badge.className = 'data-source-badge ' + (state.isLive ? 'badge-live' : 'badge-demo');
    }

    const summaryHtml = `
      <div class="summary-card">
        <div class="summary-inner">
          <div class="summary-tag">📋 Today at a Glance</div>
          <div class="summary-text" id="summary-text">${escHtml(summary || 'No summary available.')}</div>
          <button class="summary-toggle" onclick="App.toggleSummary()">Read more</button>
        </div>
        <div class="audio-bar">
          <button onclick="App.readSummary()">🔊 Summary</button>
          <button onclick="App.readAll()">▶ Read All Headlines</button>
        </div>
      </div>`;

    el.innerHTML = summaryHtml;
    renderArticleList(el, articles, true);

    if (state.category !== 'all') {
      const filtered = articles.filter(a => a.category === state.category);
      updateSummaryForCategory(state.category, filtered);
    }
  }

  function renderArticleList(container, articles, withSectionHeaders) {
    container.querySelectorAll('.section-head, .article-card, .persp-card, .empty-state, .developing-section, .for-you-empty').forEach(e => e.remove());

    // Deduplicate
    const seen = new Set();
    articles = articles.filter(a => {
      const key = (a.headline || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!articles.length) {
      container.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-icon">📭</span><p>No articles for this category today.</p></div>');
      return;
    }

    if (withSectionHeaders) {
      // ── Developing section (topics appearing 3+ days this week) ──
      const devTopicIds = state.developingTopicIds;
      if (devTopicIds && devTopicIds.size > 0) {
        const devArts = articles.filter(a =>
          (a.topics || []).some(t => devTopicIds.has(t.id))
        );
        if (devArts.length) {
          container.insertAdjacentHTML('beforeend', `
            <div class="section-head developing-head">
              <span class="section-icon dev-pulse">🔴</span>
              <span class="section-title" style="color:#dc2626">Developing</span>
              <div class="section-line" style="background:rgba(220,38,38,0.2)"></div>
            </div>`);
          devArts.slice(0, 3).forEach(a => {
            container.insertAdjacentHTML('beforeend', renderArticleCard(a, true));
          });
        }
      }

      // ── Category sections ──
      const groups = {};
      articles.forEach(a => { (groups[a.category] = groups[a.category] || []).push(a); });
      const catOrder = ['wars','world','nz-politics','nz','social-justice','science'];
      catOrder.forEach(cat => {
        if (!groups[cat]) return;
        container.insertAdjacentHTML('beforeend', `
          <div class="section-head">
            <span class="section-icon">${catIcon(cat)}</span>
            <span class="section-title">${catLabel(cat)}</span>
            <div class="section-line"></div>
          </div>`);
        const sorted = [...groups[cat]].sort((a,b) =>
          (b.is_multi_perspective ? 1 : 0) - (a.is_multi_perspective ? 1 : 0) ||
          new Date(b.created_at||0) - new Date(a.created_at||0));
        sorted.forEach(a => container.insertAdjacentHTML('beforeend', renderArticleCard(a)));
      });
    } else {
      const sorted = [...articles].sort((a, b) => urgencyScore(b) - urgencyScore(a));
      sorted.forEach(a => container.insertAdjacentHTML('beforeend', renderArticleCard(a)));
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      container.querySelectorAll('.persp-slider.center-start').forEach(s => {
        s.scrollLeft = s.offsetWidth;
      });
    }));
  }

  function renderArticleCard(a, isDeveloping = false) {
    const articleLr = a.lr_score != null ? Number(a.lr_score) : 0;
    const s1Score = srcLrScore(a.source_1_name) ?? articleLr;
    const s2Score = srcLrScore(a.source_2_name) ?? articleLr;
    const al = a.al_score != null ? Number(a.al_score) : 0;

    const developingBadge = isDeveloping
      ? '<span class="card-dev-badge">🔴 Developing</span>'
      : '';

    if (a.is_multi_perspective && a.source_2_name) {
      const eff1 = s1Score, eff2 = s2Score;
      const genuineContrast = (eff1 <= -5 && eff2 >= 5) || (eff1 >= 5 && eff2 <= -5);

      if (genuineContrast) {
        let leftSrc, leftScore, leftText, leftUrl;
        let rightSrc, rightScore, rightText, rightUrl;
        if (eff1 <= eff2) {
          leftSrc = a.source_1_name; leftScore = eff1; leftText = a.summary; leftUrl = a.source_1_url;
          rightSrc = a.source_2_name; rightScore = eff2; rightText = a.source_2_text; rightUrl = a.source_2_url;
        } else {
          leftSrc = a.source_2_name; leftScore = eff2; leftText = a.source_2_text; leftUrl = a.source_2_url;
          rightSrc = a.source_1_name; rightScore = eff1; rightText = a.summary; rightUrl = a.source_1_url;
        }

        const topicChips = (a.topics || []).map(t =>
          `<span class="topic-chip" onclick="App.openTopic('${t.id}')">${escHtml(t.name)}</span>`).join('');

        const imgStyle = a.image_url
          ? `background-image:url('${escHtml(a.image_url)}');background-size:cover;background-position:center;`
          : '';
        const heroStyle = `${getCategoryGradient(a.category)};${imgStyle}`;

        // AL bar: show only if al_score is meaningfully non-neutral
        const showAlBar = Math.abs(al) >= 15;
        const leftAlBar  = showAlBar ? alBarHtml(al, 'left')  : '';
        const rightAlBar = showAlBar ? alBarHtml(al, 'right') : '';

        return `
          <div class="persp-card${isDeveloping ? ' persp-card-developing' : ''}" id="card-${a.id}">
            <div class="persp-header">
              <div class="persp-badge-row">
                <div class="persp-swipe-hint">‹ swipe ›</div>
                <div style="display:flex;gap:6px;align-items:center">
                  ${developingBadge}
                  ${catBadgeHtml(a.category)}
                </div>
              </div>
              <div class="persp-headline">${escHtml(a.headline)}</div>
            </div>
            <div class="persp-slider center-start" id="slider-${a.id}" onscroll="App.updateDots('${a.id}', this)">

              <!-- LEFT slide -->
              <div class="persp-slide">
                ${leftAlBar}
                <div class="slide-inner slide-inner-left">
                  <div class="persp-lean" style="color:${lrColor(leftScore)}">${leanEmoji(leftScore)} ${escHtml(lrLabel(leftScore))}</div>
                  <div class="persp-source">${escHtml(leftSrc || '')}</div>
                  <div class="persp-text">${escHtml(leftText || '')}</div>
                  ${leftUrl ? `<div class="persp-link-row">
                    <a class="persp-link" href="${leftUrl}" target="_blank">Read on ${escHtml(leftSrc)} →</a>
                    <a class="persp-link-search" href="https://www.google.com/search?q=${encodeURIComponent((leftSrc||'')+' '+a.headline)}" target="_blank">↗ Search</a>
                  </div>` : ''}
                </div>
              </div>

              <!-- CENTER slide — hero image + facts -->
              <div class="persp-slide persp-slide-center">
                <div class="center-hero" style="background:${getCategoryGradient(a.category)}${a.image_url ? ';background-image:url('+JSON.stringify(a.image_url)+');background-size:cover;background-position:center' : ''}">
                  <div class="center-hero-overlay"></div>
                  <div class="center-hero-footer">
                    <span class="center-hero-label">⚖ The Facts</span>
                    <span class="center-hero-icon">${catIcon(a.category)}</span>
                  </div>
                </div>
                <div class="center-slide-content">
                  <div class="persp-text">${escHtml(a.full_content || a.summary)}</div>
                  <div class="persp-center-hint">← ${escHtml(leftSrc||'Left')} &nbsp;·&nbsp; ${escHtml(rightSrc||'Right')} →</div>
                  ${topicChips ? `<div class="persp-center-chips">${topicChips}</div>` : ''}
                </div>
              </div>

              <!-- RIGHT slide -->
              <div class="persp-slide">
                <div class="slide-inner slide-inner-right">
                  <div class="persp-lean" style="color:${lrColor(rightScore)}">${leanEmoji(rightScore)} ${escHtml(lrLabel(rightScore))}</div>
                  <div class="persp-source">${escHtml(rightSrc || '')}</div>
                  <div class="persp-text">${escHtml(rightText || '')}</div>
                  ${rightUrl ? `<div class="persp-link-row">
                    <a class="persp-link" href="${rightUrl}" target="_blank">Read on ${escHtml(rightSrc)} →</a>
                    <a class="persp-link-search" href="https://www.google.com/search?q=${encodeURIComponent((rightSrc||'')+' '+a.headline)}" target="_blank">↗ Search</a>
                  </div>` : ''}
                </div>
                ${rightAlBar}
              </div>

            </div>
            <div class="persp-dots" id="dots-${a.id}">
              <span class="dot" onclick="App.goToSlide('${a.id}', 0)"></span>
              <span class="dot active" onclick="App.goToSlide('${a.id}', 1)"></span>
              <span class="dot" onclick="App.goToSlide('${a.id}', 2)"></span>
            </div>
          </div>`;
      }
    }

    // ── Single-source card ──
    const topics = (a.topics || []).map(t =>
      `<span class="topic-chip" onclick="App.openTopic('${t.id}')">${escHtml(t.name)}</span>`
    ).join('');

    const singleSrcLr = s1Score;
    const isBiased = Math.abs(singleSrcLr) > 20;
    const biasWarning = isBiased
      ? `<div class="card-bias-warn">${leanEmoji(singleSrcLr)} Single perspective · ${escHtml(lrLabel(singleSrcLr))} source</div>`
      : '';

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent((a.source_1_name||'')+' '+a.headline)}`;

    return `
      <div class="article-card${isDeveloping ? ' article-card-developing' : ''}" id="card-${a.id}">
        <div class="card-body" onclick="App.toggleCard('${a.id}')">
          <div class="card-meta">
            <span class="card-source">${escHtml(a.source_1_name || '')}</span>
            <div style="display:flex;gap:6px;align-items:center">
              ${developingBadge}
              ${catBadgeHtml(a.category)}
            </div>
          </div>
          <div class="card-headline">${escHtml(a.headline)}</div>
          <div class="card-summary">${escHtml(a.summary)}</div>
        </div>
        ${biasWarning}
        <div class="card-full" id="full-${a.id}">
          ${a.full_content ? escHtml(a.full_content) : '<em>No additional content available.</em>'}
        </div>
        <div class="card-footer">
          ${a.source_1_url ? `<div class="card-link-row">
            <a class="card-read-link" href="${a.source_1_url}" target="_blank">Read full article →</a>
            <a class="card-search-link" href="${searchUrl}" target="_blank">↗ Search</a>
          </div>` : '<span></span>'}
          <div class="card-footer-right">
            <div class="card-topic-chips">${topics}</div>
            <button class="card-expand" id="expand-${a.id}" onclick="App.toggleCard('${a.id}')">More ›</button>
          </div>
        </div>
        ${compassHtml(a)}
      </div>`;
  }

  // ── Swipe dots ─────────────────────────────────
  function updateDots(articleId, slider) {
    const dots = document.querySelectorAll(`#card-${articleId} .dot`);
    if (!dots.length) return;
    const idx = Math.round(slider.scrollLeft / slider.offsetWidth);
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function goToSlide(articleId, idx) {
    const slider = document.getElementById(`slider-${articleId}`);
    if (!slider) return;
    slider.scrollTo({ left: idx * slider.offsetWidth, behavior: 'smooth' });
  }

  function toggleCard(id) {
    const full = document.getElementById(`full-${id}`);
    const btn = document.getElementById(`expand-${id}`);
    if (!full || !btn) return;
    const isOpen = full.classList.toggle('open');
    btn.textContent = isOpen ? 'Collapse ‹' : 'More ›';
  }

  function toggleSummary() {
    const t = document.getElementById('summary-text');
    const btn = t.nextElementSibling;
    const exp = t.classList.toggle('expanded');
    btn.textContent = exp ? 'Read less' : 'Read more';
  }

  // ── TOPICS VIEW ───────────────────────────────
  // Topic war-name detection (for topics stored as 'world' that are actually wars)
  const WAR_TOPIC_NAMES = ['ukraine','russia','israel','gaza','hamas','hezbollah',
    'iran','conflict','war','ceasefire','occupation','siege','troops','missile',
    'frontline','combat','m23','congo','rebel','invasion'];

  function getTopicDisplayCategory(t) {
    const n = ((t.name || '') + ' ' + (t.background_context || '')).toLowerCase();
    if (WAR_TOPIC_NAMES.some(kw => n.includes(kw))) return 'wars';
    return t.category || 'general';
  }

  async function loadTopics() {
    const content = document.getElementById('topics-content');
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading topics…</p></div>';

    let topics = [];
    try {
      if (db) {
        const { data } = await Promise.race([
          db.from('topics').select('*').order('article_count', { ascending: false }),
          timeout(6000).then(() => { throw new Error('timeout'); })
        ]);
        topics = data?.length ? data : DEMO_TOPICS;
      } else {
        topics = DEMO_TOPICS;
      }
    } catch (e) {
      topics = DEMO_TOPICS;
    }

    state.topics = topics;
    renderTopicsList(topics);
  }

  function renderTopicsList(topics) {
    const content = document.getElementById('topics-content');
    if (!topics.length) {
      content.innerHTML = '<div class="empty-state"><span class="empty-icon">🏷</span><p>No topics yet. They appear as you read news.</p></div>';
      return;
    }

    const catOrder = ['wars','world','nz','nz-politics','social-justice','science','general'];
    const groups = {};
    topics.forEach(t => {
      const displayCat = getTopicDisplayCategory(t);
      (groups[displayCat] = groups[displayCat] || []).push(t);
    });

    let html = '';
    catOrder.forEach(cat => {
      if (!groups[cat]) return;
      html += `<div class="section-head">
        <span class="section-icon">${catIcon(cat)}</span>
        <span class="section-title">${catLabel(cat)}</span>
        <div class="section-line"></div>
      </div>`;
      groups[cat].forEach(t => {
        const pinned = isPinned(t.id);
        html += `
          <div class="topic-row" onclick="App.openTopic('${t.id}')">
            <div class="topic-row-icon">${catIcon(getTopicDisplayCategory(t))}</div>
            <div class="topic-row-info">
              <div class="topic-row-name">${escHtml(t.name)}</div>
              <div class="topic-row-meta">Last updated ${t.last_seen ? fmtDate(t.last_seen) : 'today'}</div>
            </div>
            <span class="topic-row-count">${t.article_count || 0}</span>
            <button class="pin-btn${pinned ? ' pin-btn-active' : ''}" onclick="App.togglePin('${t.id}', event)" title="${pinned ? 'Unpin' : 'Pin topic'}">
              ${pinned ? '📌' : '⊙'}
            </button>
            <span class="topic-row-arrow">›</span>
          </div>`;
      });
    });

    content.innerHTML = html;
  }

  function filterTopics(query) {
    const q = query.toLowerCase();
    const filtered = q ? state.topics.filter(t => t.name.toLowerCase().includes(q)) : state.topics;
    renderTopicsList(filtered);
  }

  // ── TOPIC DETAIL ──────────────────────────────
  async function openTopic(topicId) {
    const topic = state.topics.find(t => t.id === topicId)
      || DEMO_TOPICS.find(t => t.id === topicId);
    if (!topic) return;

    state.selectedTopic = topic;
    state.prevView = state.view;
    state.view = 'topic-detail';

    ['today','topics','search'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden'));
    document.getElementById('view-topic-detail').classList.remove('hidden');

    const pinned = isPinned(topicId);
    document.getElementById('topic-detail-header').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="topic-detail-name">${escHtml(topic.name)}</div>
        <button class="pin-btn${pinned ? ' pin-btn-active' : ''} pin-btn-detail" onclick="App.togglePinDetail('${topicId}')" title="${pinned ? 'Unpin' : 'Pin topic'}">
          ${pinned ? '📌 Pinned' : '⊙ Pin'}
        </button>
      </div>
      <span class="topic-detail-badge">${catLabel(topic.category)}</span>`;

    const content = document.getElementById('topic-detail-content');
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading topic…</p></div>';

    let articles = [];
    try {
      if (db) {
        const { data: links } = await db.from('article_topics').select('article_id').eq('topic_id', topicId);
        const ids = (links || []).map(r => r.article_id).filter(Boolean);
        if (ids.length) {
          const { data: arts } = await db.from('articles').select('*').in('id', ids).order('date', { ascending: false });
          articles = arts || [];
        }
        if (!articles.length && topic.category && topic.category !== 'general') {
          const { data: catArts } = await db.from('articles').select('*').eq('category', topic.category).order('date', { ascending: false }).limit(20);
          articles = catArts || [];
        }
      } else {
        articles = DEMO_ARTICLES.filter(a => (a.topics || []).some(t => t.id === topicId));
      }
    } catch (e) {
      articles = DEMO_ARTICLES.filter(a => (a.topics || []).some(t => t.id === topicId));
    }

    const noteKey = `notes_${topicId}`;
    const savedNotes = localStorage.getItem(noteKey) || '';

    content.innerHTML = `
      <div class="context-card">
        <div class="context-header" onclick="App.toggleContext()">
          <span class="context-title">📚 Background & Context</span>
          <span class="context-toggle" id="ctx-toggle">⌄</span>
        </div>
        <div class="context-body" id="ctx-body">
          ${topic.background_context
            ? `<p>${escHtml(topic.background_context)}</p>`
            : '<p><em>No background context yet.</em></p>'}
          <button class="context-edit-btn" onclick="App.addContextNote('${topicId}')">+ Add your own context</button>
        </div>
      </div>
      <div class="notes-card">
        <div class="notes-header"><div class="notes-title">📝 Your Notes</div></div>
        <textarea class="notes-textarea" id="notes-${topicId}" placeholder="Add your own notes, context, or analysis here…">${escHtml(savedNotes)}</textarea>
        <button class="notes-save" onclick="App.saveNotes('${topicId}')">Save notes</button>
      </div>
      <div class="timeline-label">${articles.length} Article${articles.length !== 1 ? 's' : ''} on this topic</div>
      ${articles.length ? renderTimeline(articles) : '<div class="empty-state" style="padding:20px"><p>No articles yet.</p></div>'}
    `;
  }

  function togglePinDetail(topicId) {
    if (state.pinnedTopics.has(topicId)) {
      state.pinnedTopics.delete(topicId);
    } else {
      state.pinnedTopics.add(topicId);
    }
    localStorage.setItem('pinned_topics', JSON.stringify([...state.pinnedTopics]));
    // Update the button in topic detail header
    const pinned = isPinned(topicId);
    const btn = document.querySelector('.pin-btn-detail');
    if (btn) {
      btn.className = `pin-btn${pinned ? ' pin-btn-active' : ''} pin-btn-detail`;
      btn.title = pinned ? 'Unpin' : 'Pin topic';
      btn.textContent = pinned ? '📌 Pinned' : '⊙ Pin';
    }
  }

  function renderTimeline(articles) {
    const sorted = [...articles].sort((a,b) => new Date(b.date) - new Date(a.date));
    return sorted.map((a, i) => `
      <div class="timeline-item">
        <div class="timeline-dot-col">
          <div class="timeline-dot"></div>
          ${i < sorted.length - 1 ? '<div class="timeline-line"></div>' : ''}
        </div>
        <div class="timeline-content">
          <div class="timeline-date">${fmtDate(a.date)}</div>
          <div class="timeline-headline">${escHtml(a.headline)}</div>
          <div class="timeline-summary">${escHtml(a.summary)}</div>
          <div class="timeline-source">${escHtml(a.source_1_name || '')}${a.source_1_url ? ` · <a href="${a.source_1_url}" target="_blank" style="color:var(--accent)">Read</a>` : ''}</div>
        </div>
      </div>`).join('');
  }

  function toggleContext() {
    document.getElementById('ctx-body').classList.toggle('open');
    const t = document.getElementById('ctx-toggle');
    t.classList.toggle('open');
    t.textContent = t.classList.contains('open') ? '⌃' : '⌄';
  }

  function saveNotes(topicId) {
    const val = document.getElementById(`notes-${topicId}`)?.value || '';
    localStorage.setItem(`notes_${topicId}`, val);
    if (db) db.from('topics').update({ user_notes: val }).eq('id', topicId).then(() => {});
    const btn = document.querySelector('.notes-save');
    if (btn) { btn.textContent = '✓ Saved'; setTimeout(() => btn.textContent = 'Save notes', 1500); }
  }

  function addContextNote(topicId) {
    document.getElementById('ctx-body').classList.add('open');
    document.getElementById(`notes-${topicId}`)?.focus();
  }

  // ── SEARCH ────────────────────────────────────
  async function search(query) {
    const content = document.getElementById('search-content');
    if (!query || query.length < 2) {
      content.innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span><p>Search across everything you\'ve read</p></div>';
      return;
    }

    const q = query.toLowerCase();
    let matchedArticles = [], matchedTopics = [];

    try {
      if (db) {
        const [{ data: arts }, { data: tops }] = await Promise.all([
          db.from('articles').select('*').ilike('headline', `%${query}%`).limit(20),
          db.from('topics').select('*').ilike('name', `%${query}%`).limit(10)
        ]);
        matchedArticles = arts || [];
        matchedTopics = tops || [];
      } else {
        matchedArticles = DEMO_ARTICLES.filter(a =>
          a.headline.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q));
        matchedTopics = DEMO_TOPICS.filter(t => t.name.toLowerCase().includes(q));
      }
    } catch (e) {
      matchedArticles = DEMO_ARTICLES.filter(a => a.headline.toLowerCase().includes(q));
      matchedTopics = DEMO_TOPICS.filter(t => t.name.toLowerCase().includes(q));
    }

    if (!matchedArticles.length && !matchedTopics.length) {
      content.innerHTML = '<div class="empty-state"><span class="empty-icon">🤷</span><p>No results found</p></div>';
      return;
    }

    let html = '';
    if (matchedTopics.length) {
      html += '<div class="section-head"><span class="section-icon">🏷</span><span class="section-title">Topics</span><div class="section-line"></div></div>';
      matchedTopics.forEach(t => {
        html += `<div class="topic-row" onclick="App.openTopic('${t.id}')">
          <div class="topic-row-icon">${catIcon(t.category)}</div>
          <div class="topic-row-info">
            <div class="topic-row-name">${escHtml(t.name)}</div>
            <div class="topic-row-meta">${t.article_count || 0} articles</div>
          </div>
          <span class="topic-row-arrow">›</span>
        </div>`;
      });
    }
    if (matchedArticles.length) {
      html += '<div class="section-head"><span class="section-icon">📰</span><span class="section-title">Articles</span><div class="section-line"></div></div>';
      matchedArticles.forEach(a => { html += renderArticleCard({...a, topics:[]}); });
    }
    content.innerHTML = html;
  }

  // ── AUDIO ─────────────────────────────────────
  function readSummary() {
    const text = document.getElementById('summary-text')?.textContent || '';
    speak(text);
  }

  function readAll() {
    const filtered = state.category === 'all'
      ? state.articles
      : state.articles.filter(a => a.category === state.category);
    const headlines = filtered.map(a => a.headline + '. ' + a.summary).join('. Next story: ');
    speak(headlines);
  }

  function toggleAudio() {
    if (state.isPlaying) stopSpeech(); else readAll();
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('Audio is not supported in this browser. Try Safari on iPhone.');
      return;
    }
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-NZ';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
      state.isPlaying = true;
      document.getElementById('btn-audio')?.classList.add('playing');
    };
    utterance.onend = utterance.onerror = () => {
      state.isPlaying = false;
      document.getElementById('btn-audio')?.classList.remove('playing');
    };
    state.speech = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    window.speechSynthesis?.cancel();
    state.isPlaying = false;
    document.getElementById('btn-audio')?.classList.remove('playing');
  }

  // ── Utilities ─────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Public API ────────────────────────────────
  return {
    init, saveSetup, saveSettings, showSettings, closeSettings,
    navigate, goBack, filterCategory, filterTopics,
    toggleCard, toggleSummary, toggleContext,
    openTopic, saveNotes, addContextNote,
    search, toggleAudio, readSummary, readAll,
    updateDots, goToSlide,
    prevDay, nextDay,
    togglePin, togglePinDetail
  };

})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
