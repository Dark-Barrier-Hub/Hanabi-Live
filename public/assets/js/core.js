/* ═══════════════════════════════════════════════
   Hanabi Live — core.js  (shared across all pages)
═══════════════════════════════════════════════ */

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

/* ─── PROFILE CACHE (localStorage) ─── */
const PROFILE_KEY = 'hbProfile';

function getProfileCache() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }
  catch { return null; }
}
function saveProfileCache(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
}
function clearProfileCache() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem('hbFavs');
}
window.getProfileCache = getProfileCache;
window.saveProfileCache = saveProfileCache;

/* ─── FAVORITES (synced with profile cache) ─── */
function getFavs() {
  const cache = getProfileCache();
  if (cache?.favorites) return cache.favorites;
  return JSON.parse(localStorage.getItem('hbFavs') || '[]');
}
function saveFavs(arr) {
  // Update in profile cache
  const cache = getProfileCache();
  if (cache) {
    cache.favorites = arr;
    saveProfileCache(cache);
  }
  localStorage.setItem('hbFavs', JSON.stringify(arr));
  // Sync to Firestore if logged in
  syncFavsToFirestore(arr);
}
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
  if (typeof updateProfileFavs === 'function') updateProfileFavs();
}
window.getFavs = getFavs;
window.isFav = isFav;
window.toggleFavById = toggleFavById;

async function syncFavsToFirestore(favs) {
  if (!window.__currentUser || !window.__firebaseDb || !window.__firebaseOps) return;
  try {
    const { doc, setDoc } = window.__firebaseOps;
    const ref = doc(window.__firebaseDb, 'users', window.__currentUser.uid);
    await setDoc(ref, { favorites: favs }, { merge: true });
  } catch (e) { console.warn('Firestore sync failed:', e); }
}

/* ─── FIRESTORE: LOAD / CREATE USER DOC ─── */
async function loadOrCreateUserDoc(user) {
  if (!window.__firebaseDb || !window.__firebaseOps) return null;
  const { doc, getDoc, setDoc } = window.__firebaseOps;
  const ref = doc(window.__firebaseDb, 'users', user.uid);
  let snap;
  try { snap = await getDoc(ref); } catch (e) { console.warn('Firestore read error:', e); return null; }

  if (snap.exists()) {
    const data = snap.data();
    // Merge with fresh auth fields (name/email could update via Google)
    const merged = {
      uid: user.uid,
      name: user.displayName || data.name || 'Otaku User',
      email: user.email || data.email || '',
      photoBase64: data.photoBase64 || null,
      favorites: data.favorites || [],
      level: data.level || 1,
      comments: data.comments || 0,
      createdAt: data.createdAt || Date.now(),
    };
    // Re-save merged to keep Firestore name fresh
    try { await setDoc(ref, merged, { merge: true }); } catch (_) {}
    return merged;
  } else {
    // New user — create document
    const newProfile = {
      uid: user.uid,
      name: user.displayName || 'Otaku User',
      email: user.email || '',
      photoBase64: null,
      favorites: [],
      level: 1,
      comments: 0,
      createdAt: Date.now(),
    };
    try { await setDoc(ref, newProfile); } catch (e) { console.warn('Firestore write error:', e); }
    return newProfile;
  }
}
window.loadOrCreateUserDoc = loadOrCreateUserDoc;

/* ─── UPDATE PROFILE PHOTO IN FIRESTORE & CACHE ─── */
async function saveProfilePhoto(base64) {
  if (!window.__currentUser) return;
  const cache = getProfileCache();
  if (cache) { cache.photoBase64 = base64; saveProfileCache(cache); }
  if (window.__firebaseDb && window.__firebaseOps) {
    const { doc, setDoc } = window.__firebaseOps;
    try {
      await setDoc(
        doc(window.__firebaseDb, 'users', window.__currentUser.uid),
        { photoBase64: base64 }, { merge: true }
      );
    } catch (e) { console.warn('Photo save error:', e); }
  }
}
window.saveProfilePhoto = saveProfilePhoto;

/* ─── AUTH MODAL ─── */
function openModal(mode = 'login') {
  const overlay = document.getElementById('authModal');
  if (!overlay) return;
  overlay.classList.add('active');
}
function closeModal() {
  document.getElementById('authModal')?.classList.remove('active');
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg; el.classList.add('visible');
}
function clearError(id) { document.getElementById(id)?.classList.remove('visible'); }
window.openModal = openModal;
window.closeModal = closeModal;

/* ─── GOOGLE SIGN-IN (only provider) ─── */
async function signInGoogle() {
  clearError('loginError');
  try {
    const { signInWithPopup, GoogleAuthProvider } = window.__firebaseOps;
    const result = await signInWithPopup(window.__firebaseAuth, new GoogleAuthProvider());
    const user = result.user;
    // Store UID in localStorage immediately
    localStorage.setItem('hbUid', user.uid);
    closeModal();
    showToast('Welcome! 🎌', '🎌');
  } catch (e) {
    showError('loginError', e.message.replace('Firebase:', '').trim());
  }
}
async function doSignOut() {
  await window.__firebaseOps.signOut(window.__firebaseAuth);
  clearProfileCache();
  localStorage.removeItem('hbUid');
  showToast('Signed out 👋', '👋');
  setTimeout(() => window.location.href = 'index.html', 800);
}
window.signInGoogle = signInGoogle;
window.doSignOut = doSignOut;

/* ─── NAV AVATAR HELPER ─── */
function buildNavAvatar(profile) {
  if (profile.photoBase64) {
    return `<img src="${profile.photoBase64}" alt="avatar"
              style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--accent-red);">`;
  }
  return `<div class="user-avatar-small">${(profile.name || 'U')[0].toUpperCase()}</div>`;
}

/* ─── AUTH STATE HANDLER ─── */
document.addEventListener('authStateChanged', async (e) => {
  const user = e.detail;
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;

  if (user) {
    // Try cache first for instant render
    let profile = getProfileCache();

    if (!profile || profile.uid !== user.uid) {
      // Fetch/create from Firestore
      profile = await loadOrCreateUserDoc(user);
      if (profile) saveProfileCache(profile);
    }

    if (!profile) {
      // Fallback minimal profile
      profile = { uid: user.uid, name: user.displayName || 'User', email: user.email, photoBase64: null, favorites: [], level: 1, comments: 0 };
    }

    // Sync favorites into legacy key too
    localStorage.setItem('hbFavs', JSON.stringify(profile.favorites || []));

    const avatarHTML = buildNavAvatar(profile);
    navAuth.innerHTML = `
      <div class="user-menu">
        <button class="user-btn">
          ${avatarHTML}
          ${profile.name} <span>▾</span>
        </button>
        <div class="user-dropdown">
          <a class="dropdown-item" href="profile.html">👤 Profile</a>
          <a class="dropdown-item" href="profile.html">⭐ Favorites</a>
          <button class="dropdown-item danger" onclick="doSignOut()">🚪 Sign Out</button>
        </div>
      </div>`;

    // Update comment avatar if present
    const ca = document.getElementById('commentAvatar');
    if (ca) {
      if (profile.photoBase64) {
        ca.innerHTML = `<img src="${profile.photoBase64}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        ca.textContent = (profile.name || 'U')[0].toUpperCase();
      }
    }

    if (typeof updateProfileFavs === 'function') updateProfileFavs();
  } else {
    navAuth.innerHTML = `
      <button class="btn btn-outline" onclick="openModal('login')">Log In</button>`;
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

/* ─── CARD BUILDER ─── */
function makeCard(anime) {
  const fav = isFav(anime.id);
  const badges = { hot: '🔥 HOT', new: '🆕 NEW', top: '⭐ TOP', tba: '🚀 TBA' };
  const genres = Array.isArray(anime.genre) ? anime.genre : [anime.genre];
  const genreTags = genres.map(g => `<span class="card-genre">${g}</span>`).join('');
  const _safeData = JSON.stringify(anime).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `
    <div class="anime-card" data-anime="${_safeData}" onclick="location.href='watch.html?id=${anime.id}'">
      <div class="card-poster">
        <img src="${anime.img}" alt="${anime.title}" loading="lazy" onerror="this.style.display='none'">
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
    const popupW = 300, popupH = 380, gap = 12;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = rect.right + gap;
    if (left + popupW > vw - 8) left = rect.left - popupW - gap;
    if (left < 8) left = 8;
    let top = rect.top;
    if (top + popupH > vh - 8) top = vh - popupH - 8;
    if (top < 8) top = 8;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  }

  function hidePopup() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (popup) popup.classList.remove('visible'); }, 120);
  }

  document.addEventListener('mouseover', function (e) {
    const card = e.target.closest('.anime-card[data-anime]');
    if (!card) return;
    try {
      const raw = card.getAttribute('data-anime').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
      showPopup(card, JSON.parse(raw));
    } catch (_) {}
  });
  document.addEventListener('mouseout', function (e) {
    const card = e.target.closest('.anime-card[data-anime]');
    if (!card) return;
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    hidePopup();
  });
  document.addEventListener('scroll', function () {
    if (popup && popup.classList.contains('visible')) {
      const hovered = document.querySelector('.anime-card[data-anime]:hover');
      if (hovered) positionPopup(hovered); else hidePopup();
    }
  }, true);
})();

/* ─── SHARED AUTH MODAL HTML (Google only) ─── */
function mountAuthModal() {
  const mount = document.getElementById('authModalMount');
  if (!mount) return;
  mount.innerHTML = `
  <div class="modal-overlay" id="authModal">
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div id="loginForm">
        <div class="modal-title">Welcome to Hanabi Live</div>
        <div class="modal-subtitle">Sign in to access your profile &amp; favorites</div>
        <div class="error-msg" id="loginError"></div>
        <button class="btn-google" onclick="signInGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Continue with Google
        </button>
        <div style="margin-top:20px;text-align:center;font-size:12px;color:var(--text-muted);line-height:1.6;">
          By signing in you agree to our terms of service.<br>
          Your data is stored securely.
        </div>
      </div>
    </div>
  </div>`;
}
window.mountAuthModal = mountAuthModal;