/* ═══════════════════════════════════════════════
   Hanabi Live — core.js  (shared across all pages)
═══════════════════════════════════════════════ */

/* ─── ANTI-INSPECT ─── */
// (function () {
//   // Disable right-click
//   document.addEventListener('contextmenu', e => e.preventDefault());

//   // Disable F12, Ctrl+Shift+I/J/U/C, Ctrl+U
//   document.addEventListener('keydown', e => {
//     const key = e.key;
//     const ctrl = e.ctrlKey || e.metaKey;
//     if (
//       key === 'F12' ||
//       (ctrl && e.shiftKey && ['I','J','C'].includes(key.toUpperCase())) ||
//       (ctrl && key.toUpperCase() === 'U')
//     ) {
//       e.preventDefault();
//       e.stopPropagation();
//       return false;
//     }
//   });

//   // Devtools detection (basic)
//   let devtools = false;
//   const threshold = 160;
//   setInterval(() => {
//     if (
//       window.outerWidth - window.innerWidth > threshold ||
//       window.outerHeight - window.innerHeight > threshold
//     ) {
//       if (!devtools) {
//         devtools = true;
//         document.body.innerHTML = `
//           <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
//             background:#04050d;color:#e63946;font-family:sans-serif;flex-direction:column;gap:16px;">
//             <div style="font-size:60px">⛩</div>
//             <div style="font-size:24px;font-weight:bold">Hanabi Live</div>
//             <div style="color:#7986cb">DevTools detected. Please close to continue.</div>
//           </div>`;
//       }
//     } else {
//       devtools = false;
//     }
//   }, 1000);
// })();

/* ─── FIREBASE INIT ─── */
// Firebase is initialised inline in each page's <script type="module"> block
// and exposed on window.__firebase*

/* ─── TOAST ─── */
function showToast(msg, icon = '✨') {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-icon').textContent = icon;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}
window.showToast = showToast;

/* ─── FAVORITES (localStorage) ─── */
function getFavs() { return JSON.parse(localStorage.getItem('hbFavs') || '[]'); }
function saveFavs(arr) { localStorage.setItem('hbFavs', JSON.stringify(arr)); }
function isFav(id) { return getFavs().includes(id); }
function toggleFavById(id, btn) {
  if (!window.__currentUser) { openModal('login'); return; }
  let favs = getFavs();
  if (isFav(id)) {
    favs = favs.filter(f => f !== id);
    if (btn) { btn.textContent = '🤍'; btn.classList.remove('favorited'); }
    showToast('Removed from favorites', '💔');
  } else {
    favs.push(id);
    if (btn) { btn.textContent = '❤️'; btn.classList.add('favorited'); }
    showToast('Added to favorites!', '⭐');
  }
  saveFavs(favs);
}
window.getFavs = getFavs;
window.isFav = isFav;
window.toggleFavById = toggleFavById;

/* ─── AUTH MODAL ─── */
function openModal(mode = 'login') {
  const overlay = document.getElementById('authModal');
  if (!overlay) return;
  overlay.classList.add('active');
  const lf = document.getElementById('loginForm');
  const rf = document.getElementById('registerForm');
  if (mode === 'register') { lf.style.display = 'none'; rf.style.display = 'block'; }
  else                      { lf.style.display = 'block'; rf.style.display = 'none'; }
}
function closeModal() {
  document.getElementById('authModal')?.classList.remove('active');
}
function toggleAuthForm() {
  const lf = document.getElementById('loginForm');
  const rf = document.getElementById('registerForm');
  lf.style.display = lf.style.display === 'none' ? 'block' : 'none';
  rf.style.display = rf.style.display === 'none' ? 'block' : 'none';
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg; el.classList.add('visible');
}
function clearError(id) { document.getElementById(id)?.classList.remove('visible'); }
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleAuthForm = toggleAuthForm;

async function doLogin() {
  clearError('loginError');
  const email = document.getElementById('loginEmail').value;
  const pass  = document.getElementById('loginPassword').value;
  if (!email || !pass) { showError('loginError', 'Please fill all fields'); return; }
  try {
    await window.__firebaseOps.signInWithEmailAndPassword(window.__firebaseAuth, email, pass);
    closeModal(); showToast('Welcome back! 🎌', '🎌');
  } catch (e) {
    showError('loginError', e.message.replace('Firebase:', '').trim());
  }
}
async function doRegister() {
  clearError('registerError');
  const name  = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const pass  = document.getElementById('regPassword').value;
  if (!name || !email || !pass) { showError('registerError', 'Please fill all fields'); return; }
  try {
    const { user } = await window.__firebaseOps.createUserWithEmailAndPassword(window.__firebaseAuth, email, pass);
    await window.__firebaseOps.setDoc(
      window.__firebaseOps.doc(window.__firebaseDb, 'users', user.uid),
      { name, email, createdAt: Date.now(), favorites: [], watched: 0 }
    );
    closeModal(); showToast('Account created! Welcome! 🎉', '🎉');
  } catch (e) {
    showError('registerError', e.message.replace('Firebase:', '').trim());
  }
}
async function signInGoogle() {
  try {
    await window.__firebaseOps.signInWithPopup(window.__firebaseAuth, new window.__firebaseOps.GoogleAuthProvider());
    closeModal(); showToast('Welcome! 🎌', '🎌');
  } catch (e) {
    showError('loginError', e.message.replace('Firebase:', '').trim());
  }
}
async function doSignOut() {
  await window.__firebaseOps.signOut(window.__firebaseAuth);
  showToast('Signed out 👋', '👋');
  setTimeout(() => window.location.href = 'index.html', 800);
}
window.doLogin = doLogin;
window.doRegister = doRegister;
window.signInGoogle = signInGoogle;
window.doSignOut = doSignOut;

/* ─── AUTH STATE HANDLER ─── */
document.addEventListener('authStateChanged', (e) => {
  const user = e.detail;
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;
  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const letter = displayName[0].toUpperCase();
    navAuth.innerHTML = `
      <div class="user-menu">
        <button class="user-btn">
          <div class="user-avatar-small">${letter}</div>
          ${displayName} <span>▾</span>
        </button>
        <div class="user-dropdown">
          <a class="dropdown-item" href="profile.html">👤 Profile</a>
          <a class="dropdown-item" href="profile.html">⭐ Favorites</a>
          <button class="dropdown-item danger" onclick="doSignOut()">🚪 Sign Out</button>
        </div>
      </div>`;
    // Update comment avatar if present
    const ca = document.getElementById('commentAvatar');
    if (ca) ca.textContent = letter;
    // Update profile page if present
    const pout = document.getElementById('profileLoggedOut');
    const pin  = document.getElementById('profileLoggedIn');
    if (pout) pout.style.display = 'none';
    if (pin)  pin.style.display  = 'block';
    const pn = document.getElementById('profileName');
    const pe = document.getElementById('profileEmail');
    const pa = document.getElementById('profileAvatarLetter');
    if (pn) pn.textContent = displayName;
    if (pe) pe.textContent = user.email;
    if (pa) pa.textContent = letter;
    if (typeof updateProfileFavs === 'function') updateProfileFavs();
  } else {
    navAuth.innerHTML = `
      <button class="btn btn-outline" onclick="openModal('login')">Log In</button>
      <button class="btn btn-primary" onclick="openModal('register')">Sign Up</button>`;
    const ca = document.getElementById('commentAvatar');
    if (ca) ca.textContent = '?';
    const pout = document.getElementById('profileLoggedOut');
    const pin  = document.getElementById('profileLoggedIn');
    if (pout) pout.style.display = 'flex';
    if (pin)  pin.style.display  = 'none';
  }
});

/* ─── CLOSE MODAL ON OVERLAY CLICK ─── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('authModal')?.addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // Highlight active nav link
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    if (link.dataset.page === page) link.classList.add('active');
  });

  // Scroll nav effect
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (nav) nav.style.background = window.scrollY > 50 ? 'rgba(4,5,13,0.98)' : 'rgba(4,5,13,0.92)';
  });

  // '/' key → browse
  window.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      window.location.href = 'browse.html';
    }
  });
});

/* ─── CARD BUILDER (used on multiple pages) ─── */
function makeCard(anime) {
  const fav = isFav(anime.id);
  const badges = { hot: '🔥 HOT', new: '🆕 NEW', top: '⭐ TOP', tba: '🚀 TBA' };
  // genre is now always an array; normalise legacy strings just in case
  const genres = Array.isArray(anime.genre) ? anime.genre : [anime.genre];
  const genreTags = genres
    .map(g => `<span class="card-genre">${g}</span>`)
    .join('');
  const _safeData = JSON.stringify(anime).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `
    <div class="anime-card" data-anime="${_safeData}" onclick="location.href='watch.html?id=${anime.id}'">
      <div class="card-poster">
        <img src="${anime.img}" alt="${anime.title}" loading="lazy"
             onerror="this.style.display='none'">
        ${anime.badge ? `<div class="card-badge ${anime.badge}">${badges[anime.badge] || anime.badge}</div>` : ''}
        <div class="card-score">★ ${anime.score}</div>
        <div class="card-play-overlay"><div class="play-btn-card">▶</div></div>
        <button class="card-fav-btn ${fav ? 'favorited' : ''}"
                onclick="event.stopPropagation();toggleFavById('${anime.id}',this)">${fav ? '❤️' : '🤍'}</button>
      </div>
      <div class="card-info">
        <div class="card-title">${anime.title}</div>
        <div class="card-meta">
          <div class="card-genres">${genreTags}</div>
          <span>${anime.ep} Ep</span>
        </div>
      </div>
    </div>`;
}
window.makeCard = makeCard;

/* ─── CARD HOVER POPUP ─── */
(function () {
  let popup = null;
  let hideTimer = null;

  function createPopup() {
    popup = document.createElement('div');
    popup.className = 'card-popup';
    popup.id = 'cardHoverPopup';
    document.body.appendChild(popup);
  }

  function getAnimeById(id) {
    // Try to find from any grid on the page
    const cards = document.querySelectorAll('.anime-card');
    for (const card of cards) {
      const onclick = card.getAttribute('onclick') || '';
      if (onclick.includes(`id=${id}`)) return null; // fallback handled below
    }
    return null;
  }

  function showPopup(card, animeData) {
    clearTimeout(hideTimer);
    if (!popup) createPopup();

    const genres = Array.isArray(animeData.genre) ? animeData.genre : [animeData.genre];
    const yearStr = animeData.year === 0 ? 'TBA' : animeData.year;

    popup.innerHTML = `
      <div class="card-popup-divider"></div>
      <div class="card-popup-img-wrap">
        <img class="card-popup-img" src="${animeData.img}" alt="${animeData.title}"
             onerror="this.parentNode.innerHTML='<div class=\\'card-popup-img-fallback\\'>⛩</div>'">
      </div>
      <div class="card-popup-body">
        <div class="card-popup-title">${animeData.title}</div>
        <div class="card-popup-meta">
          <span class="card-popup-year">${yearStr}</span>
          <span class="card-popup-score">★ ${animeData.score}</span>
          <span style="font-size:11px;color:var(--text-muted);font-weight:600;">${animeData.ep} Ep</span>
        </div>
        <div class="card-popup-genres">
          ${genres.map(g => `<span class="card-popup-genre">${g}</span>`).join('')}
        </div>
        <div class="card-popup-desc">${animeData.desc}</div>
      </div>`;

    positionPopup(card);
    popup.classList.add('visible');
  }

  function positionPopup(card) {
    const rect = card.getBoundingClientRect();
    const popupW = 300;
    const popupH = 380;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer right side, fall back to left
    let left = rect.right + gap;
    if (left + popupW > vw - 8) left = rect.left - popupW - gap;
    if (left < 8) left = 8;

    // Vertical: align to card top, clamp to viewport
    let top = rect.top;
    if (top + popupH > vh - 8) top = vh - popupH - 8;
    if (top < 8) top = 8;

    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  }

  function hidePopup() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (popup) popup.classList.remove('visible');
    }, 120);
  }

  // Event delegation on document — works for dynamically rendered cards
  document.addEventListener('mouseover', function (e) {
    const card = e.target.closest('.anime-card[data-anime]');
    if (!card) return;
    try {
      const raw = card.getAttribute('data-anime').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
      const data = JSON.parse(raw);
      showPopup(card, data);
    } catch (_) {}
  });

  document.addEventListener('mouseout', function (e) {
    const card = e.target.closest('.anime-card[data-anime]');
    if (!card) return;
    const related = e.relatedTarget;
    if (related && card.contains(related)) return;
    hidePopup();
  });

  // Reposition on scroll
  document.addEventListener('scroll', function () {
    if (popup && popup.classList.contains('visible')) {
      const hovered = document.querySelector('.anime-card[data-anime]:hover');
      if (hovered) positionPopup(hovered);
      else hidePopup();
    }
  }, true);
})();


/* ─── SHARED AUTH MODAL HTML ─── */
// Injected by each page via id="authModalMount"
function mountAuthModal() {
  const mount = document.getElementById('authModalMount');
  if (!mount) return;
  mount.innerHTML = `
  <div class="modal-overlay" id="authModal">
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div id="loginForm">
        <div class="modal-title">Welcome Back</div>
        <div class="modal-subtitle">Sign in to your Hanabi Live account</div>
        <div class="error-msg" id="loginError"></div>
        <button class="btn-google" onclick="signInGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
          Continue with Google
        </button>
        <div class="divider">or continue with email</div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="loginEmail" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="loginPassword" placeholder="••••••••">
        </div>
        <button class="btn-submit" onclick="doLogin()">Sign In</button>
        <div class="modal-switch">Don't have an account? <a onclick="toggleAuthForm()">Sign up</a></div>
      </div>
      <div id="registerForm" style="display:none">
        <div class="modal-title">Join Hanabi Live</div>
        <div class="modal-subtitle">Create your account today</div>
        <div class="error-msg" id="registerError"></div>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input type="text" class="form-input" id="regName" placeholder="Otaku Master">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="regEmail" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="regPassword" placeholder="Min 6 characters">
        </div>
        <button class="btn-submit" onclick="doRegister()">Create Account</button>
        <div class="modal-switch">Already have an account? <a onclick="toggleAuthForm()">Sign in</a></div>
      </div>
    </div>
  </div>`;
}
window.mountAuthModal = mountAuthModal;