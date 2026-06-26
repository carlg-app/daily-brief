/* ═══════════════════════════════════════════════
   DAILY BRIEF PWA — App Logic
   Supabase-powered · Web Speech API audio
═══════════════════════════════════════════════ */

const App = (() => {

  // ── State ──────────────────────────────────────
  let db = null;
  let state = {
    view: null,  // null so navigate('today') in init() always runs loadToday()
    prevView: null,
    category: 'all',
    articles: [],
    topics: [],
    selectedTopic: null,
    speech: null,
    isPlaying: false,
    searchResults: { articles: [], topics: [] },
    dailySummary: ''
  };

  // ── Category config ────────────────────────────
  const CATS = {
    'world':          { label: 'World News',        icon: '🌏' },
    'wars':           { label: 'Wars & Conflicts',  icon: '⚔️' },
    'nz':             { label: 'New Zealand',        icon: '🥝' },
    'nz-politics':    { label: 'NZ Politics',        icon: '🏛' },
    'social-justice': { label: 'Social Justice',     icon: '✊' },
    'science':        { label: 'Science',            icon: '🔬' }
  };

  // ── DEMO DATA (shown before Supabase is populated) ──
  const DEMO_ARTICLES = [
    {
      id: 'demo-1', date: new Date().toISOString().split('T')[0],
      headline: 'FIFA World Cup 2026: Group Stage Deciders',
      summary: 'Scotland fell 3–0 to Brazil and await their fate as a potential third-place qualifier. South Africa secured knockout progression with a 1–0 win over South Korea.',
      category: 'world', source_1_name: 'ESPN', source_1_url: 'https://www.espn.com',
      is_multi_perspective: true,
      source_2_name: 'CNN', source_2_url: 'https://www.cnn.com',
      source_2_text: 'Morocco finished on 7 points, level with Brazil, but missed top spot on goal difference. Mexico made it three wins from three in Group A.',
      topics: [{ id: 't1', name: 'FIFA World Cup 2026' }, { id: 't2', name: 'Brazil' }]
    },
    {
      id: 'demo-2', date: new Date().toISOString().split('T')[0],
      headline: 'Iran Nuclear Inspections: IAEA Says Access "Will Happen"',
      summary: 'The head of the UN nuclear watchdog stated IAEA inspections of Iran\'s nuclear sites will take place, following US-Iran negotiations. Timing remains unconfirmed.',
      category: 'world', source_1_name: 'CBS News', source_1_url: 'https://www.cbsnews.com',
      topics: [{ id: 't3', name: 'Iran Nuclear Deal' }, { id: 't4', name: 'IAEA' }]
    },
    {
      id: 'demo-3', date: new Date().toISOString().split('T')[0],
      headline: 'National Promises Compulsory KiwiSaver with $1,500 Baby Bonus',
      summary: 'At its annual conference, National announced plans to make KiwiSaver compulsory for all workers and to auto-enrol newborns with a $1,500 government contribution.',
      category: 'nz-politics', source_1_name: 'NZ Herald', source_1_url: 'https://www.nzherald.co.nz',
      topics: [{ id: 't5', name: 'NZ Election 2026' }, { id: 't6', name: 'KiwiSaver' }]
    },
    {
      id: 'demo-4', date: new Date().toISOString().split('T')[0],
      headline: 'Health & Safety at Work Bill Draws Parliament Rally',
      summary: 'Trade unions rallied at Parliament opposing changes to the Health and Safety at Work Bill. Pike River families warn changes will "undoubtedly lead to more injuries."',
      category: 'nz-politics', source_1_name: 'NZCTU', source_1_url: 'https://union.org.nz',
      is_multi_perspective: true,
      source_2_name: 'Beehive.govt.nz', source_2_url: 'https://www.beehive.govt.nz',
      source_2_text: 'The Government argues the reforms reduce compliance burden on small businesses while maintaining core safety protections.',
      topics: [{ id: 't7', name: 'Workplace Safety NZ' }]
    },
    {
      id: 'demo-5', date: new Date().toISOString().split('T')[0],
      headline: 'China Business Summit Opens in Auckland; India FTA Details Emerge',
      summary: 'A major Chinese business delegation summit is underway in Auckland today, coinciding with fresh details on New Zealand\'s free-trade agreement with India.',
      category: 'nz', source_1_name: 'NZ Herald', source_1_url: 'https://www.nzherald.co.nz',
      topics: [{ id: 't8', name: 'NZ-China Relations' }, { id: 't9', name: 'NZ-India FTA' }]
    },
    {
      id: 'demo-6', date: new Date().toISOString().split('T')[0],
      headline: 'Louisiana Redistricting Ruling Challenged as Attack on Black Voters',
      summary: 'Advocates call the outcome in Louisiana vs. Callais a direct undermining of Black voter representation, arguing redistricting dilutes majority-Black voting communities.',
      category: 'social-justice', source_1_name: 'Public News Service', source_1_url: 'https://www.publicnewsservice.org',
      topics: [{ id: 't10', name: 'Voting Rights USA' }]
    },
    {
      id: 'demo-7', date: new Date().toISOString().split('T')[0],
      headline: 'Earliest Human Fire Use Confirmed at 1.79 Million Years Ago',
      summary: 'A peer-reviewed study found burned bones deep inside South Africa\'s Wonderwerk Cave dating to 1.79 million years ago — the oldest confirmed evidence of deliberate fire use by early humans.',
      category: 'science', source_1_name: 'ScienceDaily', source_1_url: 'https://sciencedaily.com',
      topics: [{ id: 't11', name: 'Human Evolution' }]
    },
    {
      id: 'demo-8', date: new Date().toISOString().split('T')[0],
      headline: 'Single Amino Acid Change Can Completely Alter Coronavirus Behaviour',
      summary: 'A new study comparing SARS-CoV-2 with a bat-only coronavirus found that one tiny genetic difference dramatically changes how the virus interacts with immune systems across species.',
      category: 'science', source_1_name: 'ScienceDaily', source_1_url: 'https://sciencedaily.com',
      topics: [{ id: 't12', name: 'Coronavirus Research' }]
    }
  ];

  const DEMO_SUMMARY = "New Zealand enters the final stretch before its November election, with National announcing compulsory KiwiSaver and Parliament passing significant legislation. Globally, the FIFA World Cup 2026 group stage concludes today. In science, researchers confirmed the earliest-ever evidence of fire use (1.79 million years ago) and made breakthroughs in coronavirus behaviour research.";

  const DEMO_TOPICS = [
    { id: 't3', name: 'Iran Nuclear Deal', category: 'world', article_count: 1, background_context: 'Iran\'s nuclear programme has been subject to international scrutiny for decades. The Joint Comprehensive Plan of Action (JCPOA), signed in 2015 between Iran and the P5+1 nations, placed limits on Iran\'s uranium enrichment in exchange for sanctions relief. The US withdrew under the Trump administration in 2018. Subsequent rounds of negotiations have sought to revive or replace the deal, with the IAEA playing a central monitoring role.' },
    { id: 't5', name: 'NZ Election 2026', category: 'nz-politics', article_count: 2, background_context: 'New Zealand\'s next general election is scheduled for 7 November 2026. The current National-led government (with ACT and NZ First) faces a Labour-led opposition. Key issues include cost of living, housing affordability, public health and education reform, and Treaty of Waitangi policy. Early polling suggests a competitive race.' },
    { id: 't1', name: 'FIFA World Cup 2026', category: 'world', article_count: 1, background_context: 'The 2026 FIFA World Cup is the first to be hosted jointly by three nations: the United States, Canada, and Mexico. It is also the first 48-team World Cup. The tournament marks a significant expansion of global football, with more teams from Africa, Asia, and smaller confederations. Group stage matches are taking place across multiple host cities in June-July 2026.' },
    { id: 't11', name: 'Human Evolution', category: 'science', article_count: 1, background_context: 'Palaeontology and archaeology continue to revise our understanding of early human behaviour. Key sites across Africa — including Blombos Cave and Wonderwerk Cave in South Africa — have yielded evidence of early tool use, symbolic thinking, and now confirmed fire use dating back nearly 1.8 million years. These findings push back the timeline of complex human behaviour significantly.' },
    { id: 't10', name: 'Voting Rights USA', category: 'social-justice', article_count: 1, background_context: 'Voting rights in the United States have been contested since Reconstruction. The Voting Rights Act of 1965 prohibited discriminatory voting practices. Subsequent Supreme Court decisions (notably Shelby County v. Holder, 2013) have weakened federal oversight. Ongoing redistricting battles — particularly in Southern states — continue to be challenged in court as methods of voter dilution.' },
    { id: 't12', name: 'Coronavirus Research', category: 'science', article_count: 1, background_context: 'Following the COVID-19 pandemic (2020–2022), scientific research into coronaviruses has intensified. Researchers are studying zoonotic transmission, immune evasion, and genetic variation across the coronavirus family to improve pandemic preparedness. SARS-CoV-2 variants continue to be monitored globally by the WHO.' }
  ];

  // ── Init ───────────────────────────────────────
  function init() {
    const url = localStorage.getItem('sb_url');
    const key = localStorage.getItem('sb_key');

    if (url && key) {
      connectSupabase(url, key);
      show('screen-app');
      navigate('today', true); // force=true — always run loadToday() on app open
    } else {
      show('screen-setup');
    }

    // Register service worker
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

  // Rejects after ms milliseconds — used to race against Supabase queries
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

  // ── Helpers ────────────────────────────────────
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
  }

  function todayStr() {
    // Use LOCAL date (not UTC) so NZ timezone is correct
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function catIcon(cat) { return CATS[cat]?.icon || '📄'; }
  function catLabel(cat) { return CATS[cat]?.label || cat; }

  // ── TODAY VIEW ────────────────────────────────
  let _loadTodayId = 0; // guard against concurrent loads causing duplicates

  async function loadToday() {
    const myLoadId = ++_loadTodayId;

    const el = document.getElementById('today-date');
    const today = new Date();
    el.textContent = today.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });

    // Show demo data immediately — no blank spinner on load
    state.articles = DEMO_ARTICLES;
    state.isLive = false;
    renderToday(DEMO_ARTICLES, DEMO_SUMMARY);

    if (!db) {
      console.log('[Daily Brief] No Supabase connection');
      return;
    }

    // Load live data in background and update when ready
    try {
      const dateStr = todayStr();
      console.log('[Daily Brief] Loading date:', dateStr);

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

      if (artsRes.error) console.error('[Daily Brief] Join query error:', artsRes.error);

      if (artsRes.data?.length) {
        const liveArticles = artsRes.data.map(a => ({
          ...a,
          topics: a.article_topics?.map(at => at.topics).filter(Boolean) || []
        }));
        if (myLoadId !== _loadTodayId) return; // stale load, discard
        state.articles = liveArticles;
        state.isLive = true;
        renderToday(liveArticles, sumRes.data?.summary || DEMO_SUMMARY);
      } else {
        // Fallback: simple query without join
        console.log('[Daily Brief] Join returned empty — trying simple query');
        const { data: simpleArts, error: simpleErr } = await db
          .from('articles').select('*').eq('date', dateStr).order('created_at');

        if (simpleErr) console.error('[Daily Brief] Simple query error:', simpleErr);
        else if (simpleArts?.length) {
          if (myLoadId !== _loadTodayId) return; // stale load, discard
          state.articles = simpleArts.map(a => ({ ...a, topics: [] }));
          state.isLive = true;
          renderToday(state.articles, sumRes.data?.summary || DEMO_SUMMARY);
        } else {
          console.log('[Daily Brief] No articles for', dateStr, '— showing demo');
        }
      }
    } catch (e) {
      console.error('[Daily Brief] Load failed:', e.message);
      // Already showing demo, nothing to do
    }
  }

  function filterCategory(cat) {
    state.category = cat;
    document.querySelectorAll('.pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === cat);
    });
    const filtered = cat === 'all' ? state.articles : state.articles.filter(a => a.category === cat);
    updateSummaryForCategory(cat, filtered);
    renderArticleList(document.getElementById('today-content'), filtered, false);
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
    // Reset expand/collapse state
    textEl.classList.remove('expanded');
    const toggleBtn = textEl.nextElementSibling;
    if (toggleBtn) toggleBtn.textContent = 'Read more';

    // Update audio button label
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

    // Update live/demo badge in header
    const badge = document.getElementById('data-source-badge');
    if (badge) {
      badge.textContent = state.isLive ? '● Live' : '● Demo';
      badge.className = 'data-source-badge ' + (state.isLive ? 'badge-live' : 'badge-demo');
    }

    const summaryHtml = `
      <div class="summary-card">
        <div class="summary-inner">
          <div class="summary-tag">📋 Today at a Glance</div>
          <div class="summary-text" id="summary-text">${escHtml(summary)}</div>
          <button class="summary-toggle" onclick="App.toggleSummary()">Read more</button>
        </div>
        <div class="audio-bar">
          <button onclick="App.readSummary()">🔊 Read Summary Aloud</button>
          <button onclick="App.readAll()">▶ Read All Headlines</button>
        </div>
      </div>`;

    el.innerHTML = summaryHtml;
    renderArticleList(el, articles, true);
    // If user is in a filtered category, update the summary for that view
    if (state.category !== 'all') {
      const filtered = articles.filter(a => a.category === state.category);
      updateSummaryForCategory(state.category, filtered);
    }
  }

  function renderArticleList(container, articles, withSectionHeaders) {
    // Remove existing article sections and empty-state (keep summary card)
    container.querySelectorAll('.section-head, .article-card, .persp-card, .empty-state').forEach(e => e.remove());

    if (!articles.length) {
      container.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-icon">📭</span><p>No articles for this category today.</p></div>');
      return;
    }

    if (withSectionHeaders) {
      const groups = {};
      articles.forEach(a => { (groups[a.category] = groups[a.category] || []).push(a); });
      const catOrder = ['world','wars','nz','nz-politics','social-justice','science'];
      catOrder.forEach(cat => {
        if (!groups[cat]) return;
        container.insertAdjacentHTML('beforeend', `
          <div class="section-head">
            <span class="section-icon">${catIcon(cat)}</span>
            <span class="section-title">${catLabel(cat)}</span>
            <div class="section-line"></div>
          </div>`);
        groups[cat].forEach(a => container.insertAdjacentHTML('beforeend', renderArticleCard(a)));
      });
    } else {
      articles.forEach(a => container.insertAdjacentHTML('beforeend', renderArticleCard(a)));
    }
  }

  function renderArticleCard(a) {
    if (a.is_multi_perspective && a.source_2_name) {
      return `
        <div class="persp-card" id="card-${a.id}">
          <div class="persp-header">
            <div class="persp-badge">⚖ Two Perspectives <span class="persp-badge-hint">· swipe</span></div>
            <div class="persp-headline">${escHtml(a.headline)}</div>
          </div>
          <div class="persp-slider" id="slider-${a.id}" onscroll="App.updateDots('${a.id}', this)">
            <div class="persp-slide">
              <div class="persp-lean persp-lean-left">🔴 Left-leaning</div>
              <div class="persp-source">${escHtml(a.source_1_name || '')}</div>
              <div class="persp-text">${escHtml(a.summary)}</div>
              ${a.source_1_url ? `<a class="persp-link" href="${a.source_1_url}" target="_blank">Read full article on ${escHtml(a.source_1_name)} →</a>` : ''}
            </div>
            <div class="persp-slide">
              <div class="persp-lean persp-lean-right">🔵 Right-leaning</div>
              <div class="persp-source">${escHtml(a.source_2_name)}</div>
              <div class="persp-text">${escHtml(a.source_2_text || '')}</div>
              ${a.source_2_url ? `<a class="persp-link" href="${a.source_2_url}" target="_blank">Read full article on ${escHtml(a.source_2_name)} →</a>` : ''}
            </div>
          </div>
          <div class="persp-dots">
            <span class="dot active" onclick="App.goToSlide('${a.id}', 0)"></span>
            <span class="dot" onclick="App.goToSlide('${a.id}', 1)"></span>
          </div>
        </div>`;
    }

    const topics = (a.topics || []).map(t =>
      `<span class="topic-chip" onclick="App.openTopic('${t.id}')">${escHtml(t.name)}</span>`
    ).join('');

    return `
      <div class="article-card" id="card-${a.id}">
        <div class="card-body" onclick="App.toggleCard('${a.id}')">
          <div class="card-meta">
            <span class="card-source">${escHtml(a.source_1_name || '')}</span>
            <span class="card-tag">${catLabel(a.category)}</span>
          </div>
          <div class="card-headline">${escHtml(a.headline)}</div>
          <div class="card-summary">${escHtml(a.summary)}</div>
        </div>
        <div class="card-full" id="full-${a.id}">
          ${a.full_content ? escHtml(a.full_content) : '<em>No additional content available.</em>'}
        </div>
        <div class="card-footer">
          ${a.source_1_url ? `<a class="card-read-link" href="${a.source_1_url}" target="_blank">Read full article →</a>` : '<span></span>'}
          <div class="card-footer-right">
            <div class="card-topic-chips">${topics}</div>
            <button class="card-expand" id="expand-${a.id}" onclick="App.toggleCard('${a.id}')">More ›</button>
          </div>
        </div>
      </div>`;
  }

  // ── PERSPECTIVES SWIPE ────────────────────────
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
    btn.textContent = isOpen ? 'Collapse ‹' : 'Expand ›';
  }

  function toggleSummary() {
    const t = document.getElementById('summary-text');
    const btn = t.nextElementSibling;
    const exp = t.classList.toggle('expanded');
    btn.textContent = exp ? 'Read less' : 'Read more';
  }

  // ── TOPICS VIEW ───────────────────────────────
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

    // Group by category
    const catOrder = ['world','wars','nz','nz-politics','social-justice','science','general'];
    const groups = {};
    topics.forEach(t => { (groups[t.category || 'general'] = groups[t.category || 'general'] || []).push(t); });

    let html = '';
    catOrder.forEach(cat => {
      if (!groups[cat]) return;
      html += `<div class="section-head">
        <span class="section-icon">${catIcon(cat)}</span>
        <span class="section-title">${catLabel(cat)}</span>
        <div class="section-line"></div>
      </div>`;
      groups[cat].forEach(t => {
        html += `
          <div class="topic-row" onclick="App.openTopic('${t.id}')">
            <div class="topic-row-icon">${catIcon(t.category || 'general')}</div>
            <div class="topic-row-info">
              <div class="topic-row-name">${escHtml(t.name)}</div>
              <div class="topic-row-meta">Last updated ${t.last_seen ? fmtDate(t.last_seen) : 'today'}</div>
            </div>
            <span class="topic-row-count">${t.article_count || 0}</span>
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

    // Header
    document.getElementById('topic-detail-header').innerHTML = `
      <div class="topic-detail-name">${escHtml(topic.name)}</div>
      <span class="topic-detail-badge">${catLabel(topic.category)}</span>`;

    // Content
    const content = document.getElementById('topic-detail-content');
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading topic…</p></div>';

    let articles = [];
    try {
      if (db) {
        // Step 1: get article IDs linked to this topic
        const { data: links } = await db
          .from('article_topics')
          .select('article_id')
          .eq('topic_id', topicId);
        const ids = (links || []).map(r => r.article_id).filter(Boolean);
        // Step 2: fetch those articles, sorted newest-first
        if (ids.length) {
          const { data: arts } = await db
            .from('articles')
            .select('*')
            .in('id', ids)
            .order('date', { ascending: false });
          articles = arts || [];
        }
        // Fallback: if no linked articles, query by the topic's category (shows today's relevant articles)
        if (!articles.length && topic.category && topic.category !== 'general') {
          const { data: catArts } = await db
            .from('articles')
            .select('*')
            .eq('category', topic.category)
            .order('date', { ascending: false })
            .limit(20);
          articles = catArts || [];
        }
      } else {
        articles = DEMO_ARTICLES.filter(a => (a.topics || []).some(t => t.id === topicId));
      }
    } catch (e) {
      articles = DEMO_ARTICLES.filter(a => (a.topics || []).some(t => t.id === topicId));
    }

    // Load user notes
    const noteKey = `notes_${topicId}`;
    const savedNotes = localStorage.getItem(noteKey) || '';

    content.innerHTML = `
      <!-- Background context -->
      <div class="context-card">
        <div class="context-header" onclick="App.toggleContext()">
          <span class="context-title">📚 Background & Context</span>
          <span class="context-toggle" id="ctx-toggle">⌄</span>
        </div>
        <div class="context-body" id="ctx-body">
          ${topic.background_context
            ? `<p>${escHtml(topic.background_context)}</p>`
            : '<p><em>No background context yet. This is auto-generated when the topic first appears in your brief.</em></p>'}
          <button class="context-edit-btn" onclick="App.addContextNote('${topicId}')">+ Add your own context</button>
        </div>
      </div>

      <!-- User notes -->
      <div class="notes-card">
        <div class="notes-header">
          <div class="notes-title">📝 Your Notes</div>
        </div>
        <textarea class="notes-textarea" id="notes-${topicId}" placeholder="Add your own notes, context, or analysis here…">${escHtml(savedNotes)}</textarea>
        <button class="notes-save" onclick="App.saveNotes('${topicId}')">Save notes</button>
      </div>

      <!-- Timeline -->
      <div class="timeline-label">${articles.length} Article${articles.length !== 1 ? 's' : ''} on this topic</div>
      ${articles.length ? renderTimeline(articles) : '<div class="empty-state" style="padding:20px"><p>No articles yet.</p></div>'}
    `;
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
    // Also try to save to Supabase
    if (db) {
      db.from('topics').update({ user_notes: val }).eq('id', topicId).then(() => {});
    }
    const btn = document.querySelector('.notes-save');
    if (btn) { btn.textContent = '✓ Saved'; setTimeout(() => btn.textContent = 'Save notes', 1500); }
  }

  function addContextNote(topicId) {
    const ctx = document.getElementById('ctx-body');
    ctx.classList.add('open');
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
    if (state.isPlaying) {
      stopSpeech();
    } else {
      readAll();
    }
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
    updateDots, goToSlide
  };

})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
