/* ─── JavaScript for PotholeAI ─────────────────────────────────────────────── */

// Auto-detect API base URL: if opened via VS Code Live Server (port 5500, 5501, etc.), redirect API calls to Flask at port 5000
const API = (window.location.port === '5000')
  ? ''
  : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : '');

// ─── DOM refs ────────────────────────────────────────────────────────────────
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const browseBtn     = document.getElementById('browse-btn');
const previewWrap   = document.getElementById('preview-wrap');
const previewImg    = document.getElementById('preview-img');
const resetBtn      = document.getElementById('reset-btn');
const predictBtn    = document.getElementById('predict-btn');
const statusInner   = document.getElementById('status-inner');
const statusSpinner = document.getElementById('status-spinner');
const nav           = document.getElementById('nav');
const hamburger     = document.getElementById('hamburger');
const navLinks      = document.querySelector('.nav-links');
const themeToggle   = document.getElementById('theme-toggle');

// Results panels
const resultsEmpty   = document.getElementById('results-empty');
const resultsLoading = document.getElementById('results-loading');
const resultsContent = document.getElementById('results-content');
const resultsError   = document.getElementById('results-error');
const resultBadge    = document.getElementById('result-badge');
const confFill       = document.getElementById('conf-fill');
const confPct        = document.getElementById('conf-pct');
const probGrid       = document.getElementById('prob-grid');
const resultMeta     = document.getElementById('result-meta');
const errorText      = document.getElementById('error-text');

let currentFile = null;
let modelLoaded = false;
let menuOpen    = false;

// ─── Theme toggle ─────────────────────────────────────────────────────────────
(function initTheme() {
  // Prefer saved preference; fall back to system preference
  const saved  = localStorage.getItem('potholeai-theme');
  const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || system);
})();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('potholeai-theme', theme);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// Also follow system changes if user has never overridden
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  if (!localStorage.getItem('potholeai-theme')) {
    applyTheme(e.matches ? 'light' : 'dark');
  }
});

// ─── NAV scroll / active ────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
  updateActiveNavLink();
  if (menuOpen) closeMobileMenu();
});

function updateActiveNavLink() {
  const sections = ['hero', 'detect', 'dashboard', 'model'];
  let current = '';
  for (const id of sections) {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 120) current = id;
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.section === current);
  });
}

// ─── Mobile hamburger (pure class-based, no inline styles) ───────────────────
function openMobileMenu() {
  menuOpen = true;
  navLinks.classList.add('mobile-open');
  hamburger.classList.add('is-open');
  hamburger.setAttribute('aria-expanded', 'true');
}

function closeMobileMenu() {
  menuOpen = false;
  navLinks.classList.remove('mobile-open');
  hamburger.classList.remove('is-open');
  hamburger.setAttribute('aria-expanded', 'false');
}

hamburger.addEventListener('click', e => {
  e.stopPropagation();
  menuOpen ? closeMobileMenu() : openMobileMenu();
});

// Close when tapping outside nav
document.addEventListener('click', e => {
  if (menuOpen && !nav.contains(e.target)) closeMobileMenu();
});

// ─── Smooth scroll for anchor links (accounts for fixed 64 px nav) ───────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      closeMobileMenu();
      const top = target.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ─── Fade-in on scroll ───────────────────────────────────────────────────────
function initFadeObserver() {
  const els = document.querySelectorAll('.card, .section-header, .hero-content > *');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  els.forEach(el => { el.classList.add('fade-in'); obs.observe(el); });
}
document.addEventListener('DOMContentLoaded', initFadeObserver);

// ─── Model status check ──────────────────────────────────────────────────────
async function checkModelStatus() {
  try {
    const res  = await fetch(`${API}/api/status`);
    const data = await res.json();
    modelLoaded = data.model_loaded;
    statusSpinner.style.display = 'none';
    if (data.model_loaded) {
      statusInner.innerHTML = '<span class="status-ok">&#10003;</span> <span>ML model loaded &mdash; live predictions enabled.</span>';
    } else {
      statusInner.innerHTML = `<span class="status-warn">&#9888;</span> <span class="status-warn">${escapeHtml(data.model_error || 'Model not loaded.')} &mdash; <a href="#model" class="status-link">How to activate?</a></span>`;
    }
  } catch {
    statusSpinner.style.display = 'none';
    statusInner.innerHTML = '<span class="status-error">&#10007;</span> <span class="status-error">Cannot reach backend. Is Python server running?</span>';
  }
}
checkModelStatus();

// ─── File upload / drag-drop / tap ───────────────────────────────────────────
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showError('Unsupported file type. Please upload JPG, PNG, BMP or WEBP.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('File too large. Maximum size is 10 MB.');
    return;
  }
  currentFile            = file;
  previewImg.src         = URL.createObjectURL(file);
  dropZone.style.display = 'none';
  previewWrap.style.display = 'flex';
  resetResults();
  // On mobile auto-scroll so results panel is visible
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      document.getElementById('results-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  }
}

resetBtn.addEventListener('click', () => {
  currentFile               = null;
  fileInput.value           = '';
  previewImg.src            = '';
  dropZone.style.display    = 'flex';
  previewWrap.style.display = 'none';
  resetResults();
});

predictBtn.addEventListener('click', runPrediction);

// ─── Prediction ──────────────────────────────────────────────────────────────
async function runPrediction() {
  if (!currentFile) return;
  showState('loading');
  predictBtn.disabled = true;

  const formData = new FormData();
  formData.append('image', currentFile);

  try {
    const res  = await fetch(`${API}/api/predict`, { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || data.error) {
      if (!data.model_used && data.error) {
        showError(`${data.error}\n\nPlace your trained model file in the model/ folder and restart the server. See "Model Info" below.`);
      } else {
        showError(data.error || 'Prediction failed. Check the server logs.');
      }
      return;
    }

    renderResult(data);
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        document.getElementById('results-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  } catch (err) {
    if (err.message && (err.message.includes('Unexpected end of JSON') || err.message.includes('Failed to fetch'))) {
      showError('Cannot connect to backend server at ' + (API || window.location.origin) + '.\n\nPlease ensure Python backend is running:\nRun "python app.py" in your terminal,\nthen open http://localhost:5000');
    } else {
      showError('Network error: ' + err.message);
    }
  } finally {
    predictBtn.disabled = false;
  }
}

function renderResult(data) {
  const isPothole = data.predicted_class === 'Pothole';
  resultBadge.textContent = isPothole ? '\u26a0 Pothole Detected' : '\u2713 Plain Road';
  resultBadge.className   = 'result-badge ' + (isPothole ? 'badge-pothole' : 'badge-plain');

  const pct = data.confidence;
  confFill.style.width      = pct + '%';
  confFill.style.background = isPothole
    ? 'linear-gradient(90deg, var(--red), #cc2200)'
    : 'linear-gradient(90deg, var(--green), #17b05d)';
  confPct.textContent = pct.toFixed(1) + '%';

  if (data.probabilities) {
    probGrid.innerHTML = Object.entries(data.probabilities).map(([cls, prob]) => `
      <div class="prob-item">
        <div class="prob-name">${escapeHtml(cls)}</div>
        <div class="prob-val" style="color:${cls === 'Pothole' ? 'var(--red)' : 'var(--green)'}">${prob.toFixed(1)}%</div>
      </div>`).join('');
  } else {
    probGrid.innerHTML = '';
  }

  resultMeta.textContent = data.model_used
    ? `Live prediction \u00b7 MobileNetV2 \u00b7 ${currentFile?.name || ''}`
    : '(Demo result \u2014 model not loaded)';

  showState('result');
}

// ─── UI state helpers ────────────────────────────────────────────────────────
function resetResults() { showState('empty'); }

function showState(state) {
  const panels = {
    empty:   resultsEmpty,
    loading: resultsLoading,
    result:  resultsContent,
    error:   resultsError,
  };
  Object.entries(panels).forEach(([key, el]) => {
    el.style.display = key === state ? (key === 'result' ? 'block' : 'flex') : 'none';
    if (key !== 'result') {
      el.style.flexDirection = 'column';
      el.style.alignItems    = 'center';
    }
  });
}

function showError(msg) {
  errorText.textContent = msg;
  showState('error');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
