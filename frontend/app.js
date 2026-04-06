/* ════════════════════════════════════════════
   SYNAPTIC MEMORY BANK — Frontend Application
   ════════════════════════════════════════════ */

const API_BASE = 'http://localhost:8000';

// ─────────────────────────────────────────────
//  Neural Canvas — Brain Network Visualization
// ─────────────────────────────────────────────
(function NeuralCanvas() {
  const canvas  = document.getElementById('neural-canvas');
  const ctx     = canvas.getContext('2d');
  let nodes     = [];
  let mouse     = { x: -1000, y: -1000 };
  let animId    = null;
  let W, H;

  const NODE_COUNT   = 72;
  const CONNECT_DIST = 140;
  const HOVER_RADIUS = 100;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildNodes();
  }

  function buildNodes() {
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      vx:   (Math.random() - 0.5) * 0.25,
      vy:   (Math.random() - 0.5) * 0.25,
      r:    Math.random() * 2.5 + 1.5,
      // Assign each node a "type" for color variation
      type: Math.floor(Math.random() * 3), // 0=teal, 1=purple, 2=blue
      glow: 0,  // hover glow intensity (0-1)
    }));
  }

  const NODE_COLORS = [
    { r: 0,   g: 212, b: 255 },   // teal   — primary
    { r: 181, g: 123, b: 238 },   // purple
    { r: 74,  g: 158, b: 255 },   // blue
  ];

  function nodeColor(node, alpha) {
    const c = NODE_COLORS[node.type];
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Update nodes
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20)  n.x = W + 20;
      if (n.x > W+20) n.x = -20;
      if (n.y < -20)  n.y = H + 20;
      if (n.y > H+20) n.y = -20;

      // Proximity to mouse
      const d = dist(n, mouse);
      const target = d < HOVER_RADIUS ? Math.pow(1 - d / HOVER_RADIUS, 1.5) : 0;
      n.glow += (target - n.glow) * 0.12;
    }

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = dist(a, b);
        if (d > CONNECT_DIST) continue;

        const baseAlpha   = (1 - d / CONNECT_DIST) * 0.06;
        const glowBoost   = (a.glow + b.glow) * 0.5;
        const lineAlpha   = baseAlpha + glowBoost * 0.5;
        const lineWidth   = 0.4 + glowBoost * 1.2;

        // Color: blend both node types
        const ca = NODE_COLORS[a.type];
        const cb = NODE_COLORS[b.type];
        const r  = Math.round((ca.r + cb.r) / 2);
        const g  = Math.round((ca.g + cb.g) / 2);
        const bv = Math.round((ca.b + cb.b) / 2);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${r},${g},${bv},${lineAlpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const n of nodes) {
      const baseAlpha = 0.25 + n.glow * 0.75;
      const radius    = n.r + n.glow * 4;

      // Outer glow halo
      if (n.glow > 0.05) {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 5);
        grad.addColorStop(0, nodeColor(n, n.glow * 0.4));
        grad.addColorStop(1, nodeColor(n, 0));
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor(n, baseAlpha);
      ctx.fill();

      // Bright center
      if (n.glow > 0.1) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(n, n.glow * 0.9);
        ctx.fill();
      }
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -1000; mouse.y = -1000; });

  resize();
  draw();
})();

// ─────────────────────────────────────────────
//  App State & Utilities
// ─────────────────────────────────────────────
function getUserId() {
  return document.getElementById('user-id-input').value.trim() || 'user_123';
}

function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function setApiStatus(online) {
  const dot  = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  if (online) {
    dot.className  = 'status-dot online';
    text.textContent = 'API Online';
  } else {
    dot.className  = 'status-dot offline';
    text.textContent = 'API Offline';
  }
}

async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) });
    setApiStatus(res.ok);
  } catch {
    setApiStatus(false);
  }
}

// ─────────────────────────────────────────────
//  Navigation
// ─────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${view}`).classList.add('active');

    if (view === 'memories') loadAllMemories();
    if (view === 'stats')    loadStats();
  });
});

// ─────────────────────────────────────────────
//  Importance Slider
// ─────────────────────────────────────────────
const slider  = document.getElementById('importance-slider');
const display = document.getElementById('importance-display');
const badge   = document.getElementById('importance-badge');

function updateBadge(v) {
  const val = parseFloat(v);
  display.textContent = val.toFixed(2);
  if (val >= 0.8) {
    badge.textContent = 'Critical';
    badge.className = 'importance-badge critical';
  } else if (val >= 0.5) {
    badge.textContent = 'High';
    badge.className = 'importance-badge high';
  } else if (val >= 0.25) {
    badge.textContent = 'Moderate';
    badge.className = 'importance-badge moderate';
  } else {
    badge.textContent = 'Low';
    badge.className = 'importance-badge';
  }
}

slider.addEventListener('input', e => updateBadge(e.target.value));
updateBadge(slider.value);

// Quick preset tags
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    document.getElementById('memory-text').value = tag.dataset.text;
    slider.value = tag.dataset.imp;
    updateBadge(tag.dataset.imp);
  });
});

// ─────────────────────────────────────────────
//  Ingest Memory
// ─────────────────────────────────────────────
document.getElementById('ingest-btn').addEventListener('click', async () => {
  const text       = document.getElementById('memory-text').value.trim();
  const importance = parseFloat(slider.value);
  const userId     = getUserId();

  if (!text) { showToast('Please enter memory content.', 'error'); return; }

  const btn = document.getElementById('ingest-btn');
  btn.classList.add('loading');
  btn.textContent = 'Consolidating…';

  try {
    const res  = await fetch(`${API_BASE}/memory/ingest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, text, importance }),
    });
    const data = await res.json();

    const area = document.getElementById('ingest-response');
    document.getElementById('ingest-response-body').textContent =
      JSON.stringify(data, null, 2);
    area.hidden = false;
    showToast('Memory consolidated successfully.', 'success');

    // Reset
    document.getElementById('memory-text').value = '';
    slider.value = '0.5';
    updateBadge('0.5');
    setApiStatus(true);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    setApiStatus(false);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Consolidate Memory`;
  }
});

// ─────────────────────────────────────────────
//  Retrieve Memories
// ─────────────────────────────────────────────
document.getElementById('retrieve-btn').addEventListener('click', async () => {
  const query  = document.getElementById('query-text').value.trim();
  const topK   = parseInt(document.getElementById('top-k').value) || 5;
  const userId = getUserId();

  if (!query) { showToast('Please enter a query.', 'error'); return; }

  const btn = document.getElementById('retrieve-btn');
  btn.classList.add('loading');
  btn.textContent = 'Searching…';

  try {
    const res  = await fetch(`${API_BASE}/memory/retrieve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, query, top_k: topK }),
    });
    const data = await res.json();
    renderResults(data);
    setApiStatus(true);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    setApiStatus(false);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Search Memory`;
  }
});

function renderResults(data) {
  const area    = document.getElementById('retrieve-results');
  const list    = document.getElementById('memory-cards');
  const counter = document.getElementById('results-count');

  area.hidden = false;
  list.innerHTML = '';

  const memories = data.memories || [];
  counter.textContent = `${memories.length} memor${memories.length !== 1 ? 'ies' : 'y'} retrieved`;

  if (memories.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No matching memories found.</p></div>';
    return;
  }

  memories.forEach((mem, idx) => {
    const m = mem.metrics || {};
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.style.animationDelay = `${idx * 60}ms`;

    card.innerHTML = `
      <div class="memory-card-header">
        <p class="memory-text">${escapeHtml(Array.isArray(mem.text) ? mem.text[0] : mem.text)}</p>
        <span class="memory-score">${mem.final_score.toFixed(4)}</span>
      </div>
      <div class="memory-metrics">
        ${metricBlock('relevance',  'Relevance',  m.relevance  ?? 0)}
        ${metricBlock('recency',    'Recency',    m.recency    ?? 0)}
        ${metricBlock('importance', 'Importance', m.importance ?? 0)}
      </div>
    `;
    list.appendChild(card);
  });
}

function metricBlock(cls, label, value) {
  const pct = Math.round(value * 100);
  return `
    <div class="metric">
      <div class="metric-bar-wrap">
        <div class="metric-bar ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="metric-label">${label}</span>
      <span class="metric-val">${value.toFixed(3)}</span>
    </div>
  `;
}

// ─────────────────────────────────────────────
//  All Memories
// ─────────────────────────────────────────────
async function loadAllMemories() {
  const userId = getUserId();
  const list   = document.getElementById('all-memories-list');
  list.innerHTML = '<div class="empty-state"><p>Loading…</p></div>';

  try {
    const res  = await fetch(`${API_BASE}/memory/list/${userId}`);
    const data = await res.json();
    renderAllMemories(data.memories || []);
    setApiStatus(true);
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><p>Could not connect to API.</p></div>';
    setApiStatus(false);
  }
}

function renderAllMemories(memories) {
  const list = document.getElementById('all-memories-list');
  list.innerHTML = '';

  if (memories.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
        <p>No memories stored yet.</p>
      </div>`;
    return;
  }

  memories.forEach(mem => {
    const imp     = parseFloat(mem.importance || 0.5);
    const dotCls  = imp >= 0.8 ? 'critical' : imp >= 0.5 ? 'high' : imp >= 0.25 ? 'moderate' : 'low';
    const date    = mem.created_at
      ? new Date(mem.created_at * 1000).toLocaleString()
      : 'Unknown';

    const item = document.createElement('div');
    item.className = 'memory-grid-item';
    item.innerHTML = `
      <span class="importance-dot ${dotCls}" title="Importance: ${imp}"></span>
      <div style="flex:1">
        <div class="memory-grid-text">${escapeHtml(mem.text)}</div>
        <div class="memory-grid-meta">
          importance: ${imp.toFixed(2)} · recency: ${(mem.recency || 0).toFixed(3)} · ${date}
        </div>
      </div>
      <div class="memory-grid-actions">
        <button class="btn btn-danger" data-id="${mem.id}">Delete</button>
      </div>
    `;

    item.querySelector('.btn-danger').addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!confirm('Delete this memory?')) return;
      try {
        await fetch(`${API_BASE}/memory/${id}`, { method: 'DELETE' });
        item.style.opacity = '0';
        item.style.transform = 'scale(0.95)';
        item.style.transition = 'all 0.3s';
        setTimeout(() => item.remove(), 300);
        showToast('Memory deleted.', 'default');
      } catch {
        showToast('Failed to delete memory.', 'error');
      }
    });

    list.appendChild(item);
  });
}

document.getElementById('refresh-memories-btn').addEventListener('click', loadAllMemories);

// ─────────────────────────────────────────────
//  Stats
// ─────────────────────────────────────────────
async function loadStats() {
  const userId = getUserId();
  try {
    const res  = await fetch(`${API_BASE}/stats/${userId}`);
    const data = await res.json();
    document.getElementById('stat-total').textContent     = data.total_memories ?? 0;
    document.getElementById('stat-critical').textContent  = data.critical_memories ?? 0;
    document.getElementById('stat-importance').textContent = (data.avg_importance ?? 0).toFixed(3);
    document.getElementById('stat-recency').textContent   = (data.avg_recency ?? 0).toFixed(3);
    setApiStatus(true);
  } catch {
    setApiStatus(false);
  }
}

document.getElementById('load-stats-btn').addEventListener('click', loadStats);

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────
checkApiHealth();
setInterval(checkApiHealth, 15000);
