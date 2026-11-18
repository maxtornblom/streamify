/* ═══════════════════════════════════════════════════════
   Streamify — app.js
   Native <audio> fed by the yt-dlp backend (see backend.py)
   ═══════════════════════════════════════════════════════ */

// Served by the backend (so a phone can load it too) -> same origin; opened from file:// -> localhost
const API = location.protocol.startsWith("http") ? location.origin : "http://127.0.0.1:5000";
const audio = document.getElementById("audio");
const $ = (id) => document.getElementById(id);

/* ── Icons ─────────────────────────────────────────────── */
// Rounded line icons (Lucide-style, ISC). Names in FILLED render as solid shapes with softened corners.
const LINE = {
  home: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  search: "M21 21l-4.34-4.34M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
  library: "M4 4v16M8 8v12M12 6v14M16 6l4 14",
  shuffle: "M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4",
  repeat: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  volume: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728",
  mute: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM22 9l-6 6M16 9l6 6",
  heart: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z",
  queue: "M21 15V6M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 12H3M16 6H3M12 18H3",
  more: "M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM20 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM6 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0z",
  plus: "M5 12h14M12 5v14",
  close: "M18 6L6 18M6 6l12 12",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6",
  edit: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
  external: "M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 18l6-6-6-6",
  "chevron-up": "M18 15l-6-6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  lyrics: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM7 8h10M7 12h6",
  moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  fullscreen: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  airplay: "M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1M12 15l5 6H7z",
  check: "M20 6L9 17l-5-5",
  settings: "M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  "download-done": "M21.801 10A10 10 0 1 1 17 3.335M9 11l3 3L22 4",
  "dl-warn": "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM12 8v4M12 16h.01",
};
const FILLED = {
  play: "M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z",
  pause: "M8 4H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1H8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM17.5 4H16a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z",
  prev: "M19 20L9 12l10-8zM5 19V5",
  next: "M5 4l10 8-10 8zM19 5v14",
  skip: "M5 4l10 8-10 8zM19 5v14",
  "heart-fill": "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z",
};
function icon(name, size = 24) {
  const solid = name in FILLED;
  return `<svg class="ic${solid ? " fl" : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${solid ? FILLED[name] : LINE[name]}"/></svg>`;
}
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 24);
});

/* ── State & persistence ───────────────────────────────── */
const LS = {
  get(k, d) {
    try {
      const v = JSON.parse(localStorage.getItem("streamify." + k));
      return v ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("streamify." + k, JSON.stringify(v));
    } catch {}
  },
  // like set(), but reports whether the write went through (quota errors, blocked storage)
  setSafe(k, v) {
    try {
      localStorage.setItem("streamify." + k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
};

let playlists = LS.get("playlists", null);
if (!Array.isArray(playlists) || playlists[0]?.id !== "liked")
  playlists = [{ id: "liked", name: "Liked Songs", tracks: [] }];
let recent = LS.get("recent", []);
let searchHistory = LS.get("searches", []);
if (!Array.isArray(searchHistory)) searchHistory = [];
searchHistory = searchHistory.filter((x) => typeof x === "string");
function saveSearchHistory() { LS.set("searches", searchHistory); }
function recordSearch(q) {
  if (isOffline()) return; // offline searches never ran, so they don't belong in the history
  q = String(q || "").trim().replace(/\s+/g, " ");
  if (q.length < 2) return;
  const ql = q.toLowerCase();
  searchHistory = searchHistory.filter((x) => x.toLowerCase() !== ql);
  searchHistory.unshift(q);
  searchHistory = searchHistory.slice(0, 12);
  saveSearchHistory();
}
// Tracks saved before the catalog switch carry YouTube ids and can't be played
const isCatalogTrack = (t) => /^\d+$/.test(t.id) && t.artistId !== undefined;
playlists.forEach((p) => (p.tracks = p.tracks.filter(isCatalogTrack)));
recent = recent.filter(isCatalogTrack);
// Custom playlist covers live under their own key so a failed (too big) write can never corrupt the playlists
const isCoverURL = (v) => typeof v === "string" && v.startsWith("data:image/");
function loadCovers() {
  const raw = LS.get("covers", {});
  const out = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw))
    for (const [k, v] of Object.entries(raw)) if (isCoverURL(v)) out[k] = v;
  return out;
}
let covers = loadCovers();
{
  const stale = Object.keys(covers).filter((id) => id === "liked" || !playlists.some((p) => p.id === id));
  if (stale.length) {
    stale.forEach((id) => delete covers[id]);
    LS.setSafe("covers", covers);
  }
}
let library = LS.get("library", { albums: [], artists: [] });
let libFilter = null; // "playlists" | "albums" | "artists" | null
const prefs = { volume: 0.7, muted: false, shuffle: false, repeat: 0, sbWidth: 300, rpWidth: 340, iosHintDismissed: false, offlineMode: false, dlConcurrency: 2, dlAutoSets: true, ...LS.get("prefs", {}) };

let queue = [];
let qIndex = -1;
let history = []; // indices visited while shuffling
const shufflePlayed = new Set(); // track ids already played in this shuffle round
let current = null;
const lists = {}; // list key -> tracks, so rows can start playback in context

const savePlaylists = () => {
  if (!LS.setSafe("playlists", playlists)) toast("Couldn't save your playlists — browser storage is full");
};
const saveLibrary = () => LS.set("library", library);
const isAlbumSaved = (id) => library.albums.some((a) => a.id === id);
const isArtistSaved = (id) => library.artists.some((a) => a.id === id);
const savePrefs = () => LS.set("prefs", prefs);
const getPl = (id) => playlists.find((p) => p.id === id);
const isLiked = (id) => playlists[0].tracks.some((t) => t.id === id);

/* ── Helpers ───────────────────────────────────────────── */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function fmtTime(s) {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
function fmtLong(s) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const accentFor = (seed) => `hsl(${hue(seed)} 45% 32%)`;
function setAccent(color) {
  $("main").style.setProperty("--accent", color);
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
const thumbFallback =
  "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect fill='#282828' width='1' height='1'/></svg>");
const imgTag = (src, cls = "") =>
  `<img ${cls ? `class="${cls}"` : ""} src="${esc(src)}" alt="" loading="lazy">`;
// one delegated handler (error events don't bubble, so capture) replaces inline onerror attributes
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img?.tagName !== "IMG") return;
  if (img.dataset.cover) {
    // a custom cover that can't be shown: drop it so the derived cover comes back instead of a grey tile
    const id = Object.keys(covers).find((k) => covers[k] === img.getAttribute("src"));
    if (id) commitCovers(() => delete covers[id], true);
    return;
  }
  if (img.dataset.fb) return;
  img.dataset.fb = "1";
  img.src = thumbFallback;
}, true);

/* ── Phone mode ────────────────────────────────────────── */
const phoneMQ = matchMedia("(max-width: 700px)");
const isPhone = () => phoneMQ.matches;
// "touch-first": no hover, or a coarse primary pointer, or the phone layout (also covers DevTools touch emulation)
const touchMQ = matchMedia("(hover: none), (pointer: coarse)");
const isTouchUI = () => touchMQ.matches || phoneMQ.matches;
function syncPhone() {
  document.body.classList.toggle("is-phone", phoneMQ.matches);
  applyPanelWidths();
  if (!phoneMQ.matches) {
    if (!$("np").hidden) closeNP();
    document.body.classList.remove("panel-open");
    if (view.name === "library") return navigate("home", undefined, false); // renders the sidebar too
  } else document.body.classList.toggle("panel-open", !!sidePanel);
  renderLibrary();
}
phoneMQ.addEventListener("change", syncPhone);

/* ── Boot ──────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  audio.volume = prefs.volume;
  audio.muted = prefs.muted;
  restoreAirplay();
  renderPrefs();
  syncPhone();
  renderLibrary();
  navigate("home");
  setupAudio();
  setupSliders();
  setupSortable();
  setupResizers();
  setupMediaSession();
  checkBackend();
  setupPwa();
  openStartView();
  dlBoot();
});

// null = not probed yet, true = answering, false = unreachable (only consulted while downloads are supported)
let backendOk = null;
let offCheckSeq = 0;
let offRecheckTimer = 0;
async function checkBackend() {
  const banner = $("offline-banner");
  const seq = ++offCheckSeq;
  clearTimeout(offRecheckTimer);
  let msg = "";
  let ok = true;
  if (dlOn() && prefs.offlineMode) {
    ok = backendOk; // offline mode: no probing at all
  } else {
    // with downloads available a failed probe takes the app offline, so one slow answer gets a second chance
    for (let attempt = dlOn() && navigator.onLine !== false ? 2 : 1; attempt > 0; attempt--) {
      try {
        const r = await fetch(`${API}/search?q=test&limit=1`, { signal: AbortSignal.timeout(5000) });
        if (r.status === 401) msg = "Access expired \u2014 open the link printed by the backend again (\u2026?t=\u2026).";
        else if (!r.ok) throw 0;
        ok = true;
        break;
      } catch {
        ok = false;
        msg = "Can't reach the Streamify backend. Check that it's running and that you're online.";
      }
    }
    if (seq !== offCheckSeq) return;
    if (ok) msg = msg.startsWith("Access") ? msg : "";
    backendOk = ok;
  }
  if (dlOn()) {
    if (backendOk === false) offRecheckTimer = setTimeout(checkBackend, 15000);
    if (isOffline()) msg = null; // the offline banner below
    dlSyncOffline();
  }
  if (!banner) return;
  if (msg === null) {
    // built from nodes (no innerHTML) so the banner stays as safe as the textContent path
    banner.replaceChildren(document.createTextNode("You\u2019re offline \u2014 playing downloads only. "));
    const a = document.createElement("button");
    a.className = "off-link";
    a.dataset.act = "open-downloads";
    a.textContent = "View downloads";
    banner.append(a);
    banner.hidden = false;
    return;
  }
  banner.textContent = msg; // textContent only: replaces the static markup safely
  banner.hidden = !msg;
}
window.addEventListener("online", () => checkBackend());
window.addEventListener("offline", () => checkBackend());

$("main").addEventListener("scroll", () => {
  $("topbar").style.setProperty("--tb", clamp($("main").scrollTop / 200, 0, 1));
});

// Phone: swipe right to go back, iOS-style. The page slides away with your finger and the
// previous page, kept as a snapshot of its HTML, slides in from the left underneath.
(() => {
  const main = $("main"), app = $("app");
  let x0, y0, t0, dx, mode, peek, pc, dim, snap;
  const busy = () => !$("np").hidden || document.body.classList.contains("panel-open") || !$("modal").hidden || !$("menu").hidden;
  const setX = (x) => {
    main.style.transform = `translateX(${x}px)`;
    const p = clamp(x / innerWidth, 0, 1);
    if (pc) pc.style.transform = `translateX(${(p - 1) * 28}%)`;
    if (dim) dim.style.opacity = 0.5 * (1 - p);
  };
  const buildPeek = () => {
    snap = navStack[navPos - 1]?.snap;
    peek = document.createElement("div");
    peek.className = "peek";
    peek.innerHTML = `<div class="peek-scroll" style="padding-top:calc(env(safe-area-inset-top) + ${snap?.tb ? 60 : 0}px)">
      <div class="peek-content" style="--accent:${snap?.accent || "#2a2a2a"};transform:translateY(${snap ? -snap.top : 0}px)">
        <div class="peek-bg"></div><div class="peek-view">${snap?.html || ""}</div></div></div><div class="peek-dim"></div>`;
    app.prepend(peek);
    pc = peek.querySelector(".peek-scroll");
    dim = peek.querySelector(".peek-dim");
    main.classList.add("swiping");
  };
  const cleanup = () => {
    peek?.remove(); peek = pc = dim = null;
    main.classList.remove("swiping");
    main.style.transform = main.style.transition = "";
  };
  main.addEventListener("touchstart", (e) => {
    mode = !isPhone() || navPos <= 0 || busy() || e.touches.length > 1 ||
      e.target.closest('.slider, input, textarea, select, .q-item, .row.dragging, [draggable="true"]') ? "ignore" : undefined;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = e.timeStamp; dx = 0;
  }, { passive: true });
  main.addEventListener("touchmove", (e) => {
    if (mode === "ignore") return;
    dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if (!mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      mode = dx > 0 && dx > Math.abs(dy) * 1.5 ? "back" : "ignore";
      if (mode === "back") { main.style.transition = "none"; buildPeek(); }
    }
    if (mode !== "back") return;
    e.preventDefault();
    dx = Math.max(0, dx);
    setX(dx);
  }, { passive: false });
  const end = (e) => {
    if (mode !== "back") return;
    mode = "ignore";
    const fast = dx / Math.max(1, e.timeStamp - t0) > 0.45; // px/ms
    const ease = "cubic-bezier(.2,.8,.2,1)";
    peek.style.setProperty("--t", ".26s");
    main.style.transition = `transform .26s ${ease}`;
    pc.style.transition = `transform .26s ${ease}`;
    dim.style.transition = `opacity .26s`;
    if (dx > innerWidth * 0.3 || (fast && dx > 50)) {
      setX(innerWidth);
      setTimeout(() => {
        const top = snap?.top || 0;
        go(-1);
        // keep the old page's snapshot on screen until the real one has rendered, then swap invisibly
        let done = false;
        const finish = () => {
          if (done) return;
          done = true; obs.disconnect();
          main.style.transition = "none";
          cleanup();
          main.scrollTop = top;
        };
        const ready = () => !$("view").querySelector(".skeleton") && $("view").children.length;
        const obs = new MutationObserver(() => ready() && setTimeout(finish, 60));
        obs.observe($("view"), { childList: true });
        setTimeout(finish, 900);
        if (ready()) setTimeout(finish, 60);
      }, 270);
    } else {
      setX(0);
      setTimeout(cleanup, 270);
    }
  };
  main.addEventListener("touchend", end);
  main.addEventListener("touchcancel", end);
})();

/* ── Navigation ────────────────────────────────────────── */
const navStack = [];
let navPos = -1;
let view = { name: "home" };

// What the page looked like when you left it, for the swipe-back peek
function snapView() {
  const cur = navStack[navPos];
  if (!cur || !$("view").children.length || $("view").querySelector(".skeleton")) return;
  cur.snap = {
    html: $("view").innerHTML,
    top: $("main").scrollTop,
    accent: $("main").style.getPropertyValue("--accent"),
    tb: getComputedStyle($("topbar")).display !== "none",
  };
}
function navigate(name, data, push = true) {
  if (push) snapView();
  if (push) {
    navStack.splice(navPos + 1);
    navStack.push({ name, data });
    navPos = navStack.length - 1;
  } else if (navStack[navPos]) {
    navStack[navPos] = { name, data, snap: navStack[navPos].snap }; // typing a new search replaces the entry, so Back returns to these results
  }
  view = { name, data };
  // CSS hooks: the phone layout shows the search box only on the Search tab
  document.body.dataset.view = name;
  document.body.dataset.back = navPos > 0 ? "1" : "0";
  if (!$("np").hidden) closeNP();
  const tab = name === "search" || name === "home" || name === "settings" ? name : "";
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.id === "nav-" + tab));
  const phoneTab = name === "search" || name === "home" ? name : name === "library" || name === "settings" || name === "downloads" ? "library" : "";
  document.querySelectorAll(".tabbar .tab").forEach((b) => b.classList.toggle("active", b.id === "tab-" + phoneTab));
  $("btn-back").disabled = navPos <= 0;
  $("btn-fwd").disabled = navPos >= navStack.length - 1;
  $("main").scrollTop = 0;
  $("view").classList.add("anim"); // phone: fade the new page in (only for navigation, not re-renders)
  clearTimeout(navigate.animT);
  navigate.animT = setTimeout(() => $("view").classList.remove("anim"), 700);
  const fn = { home: renderHome, search: renderSearch, playlist: renderPlaylist, artist: renderArtist, album: renderAlbum, mix: renderMix, library: renderLibraryView, downloads: renderDownloads, settings: dlRenderSettingsView }[name];
  fn(data);
  renderLibrary(name === "library");
}
function go(delta) {
  const p = navPos + delta;
  if (p < 0 || p >= navStack.length) return;
  snapView();
  navPos = p;
  const { name, data } = navStack[p];
  if (name === "search") $("q").value = data?.q || "";
  syncSearchBox();
  navigate(name, data, false);
}

/* ── Search box ────────────────────────────────────────── */
let searchTimer;
function syncSearchBox() {
  $("q").parentElement.classList.toggle("has-text", !!$("q").value);
}
$("q").addEventListener("input", () => {
  syncSearchBox();
  clearTimeout(searchTimer);
  const q = $("q").value.trim();
  if (q) searchTimer = setTimeout(() => navigate("search", { q }, view.name !== "search"), 450);
  else if (view.name === "search") navigate("search", { q: "" }, false);
});
$("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && $("q").value.trim()) {
    clearTimeout(searchTimer);
    recordSearch($("q").value);
    navigate("search", { q: $("q").value.trim() }, view.name !== "search");
  }
});
$("q").addEventListener("focus", () => $("q").select());

function runSearchFor(q) {
  recordSearch(q);
  $("q").value = q;
  syncSearchBox();
  navigate("search", { q });
}

const trackIndex = {};
const apiCache = new Map();
async function api(path) {
  if (apiCache.has(path)) return apiCache.get(path);
  if (isOffline()) throw new OfflineError();
  let res;
  try {
    res = await fetch(API + path);
  } catch (e) {
    if (dlOn()) offProbeSoon(); // a dead backend should flip the app to offline right away
    throw e;
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  (data.tracks || []).forEach((t) => (trackIndex[t.id] = t));
  apiCache.set(path, data);
  return data;
}

/* ── Views ─────────────────────────────────────────────── */
function setView(html) {
  $("view").innerHTML = html;
  // phone: the top bar shows the page title once the heading scrolls out of view
  $("tb-title").textContent = $("view").querySelector(".hero h1, h1.page")?.textContent || "";
  renderPrefs();
}

const trackCard = (t, key, i) => dlOn()
  ? `<div class="card" data-act="play-list" data-list="${key}" data-idx="${i}" data-tid="${esc(t.id)}">
  <div class="art">${imgTag(t.thumb)}<button class="go" tabindex="-1">${icon("play")}</button></div>
  <div class="c-t">${esc(t.title)}</div><div class="c-s dl-sub">${dlIndHTML(t.id)}<span class="dl-sub-t">${esc(t.artist)}</span></div></div>`
  : `<div class="card" data-act="play-list" data-list="${key}" data-idx="${i}">
  <div class="art">${imgTag(t.thumb)}<button class="go" tabindex="-1">${icon("play")}</button></div>
  <div class="c-t">${esc(t.title)}</div><div class="c-s">${esc(t.artist)}</div></div>`;
const artistCard = (a) => (artistThumbs[a.id] = a.thumb, "") + `<div class="card round" data-act="artist" data-id="${esc(a.id)}" data-name="${esc(a.name)}" data-thumb="${esc(a.thumb)}">
  <div class="art">${imgTag(a.thumb)}</div><div class="c-t">${esc(a.name)}</div><div class="c-s">Artist</div></div>`;
const albumCard = (a, sub) => `<div class="card" data-act="album" data-id="${esc(a.id)}" data-artist="${esc(a.artist)}">
  <div class="art">${imgTag(a.thumb)}<button class="go" data-act="play-album" data-id="${esc(a.id)}" tabindex="-1" title="Play">${icon("play")}</button></div>
  <div class="c-t">${esc(a.title)}</div><div class="c-s">${esc(sub ?? [a.year, a.artist].filter(Boolean).join(" · "))}</div></div>`;
const shelf = (title, items) =>
  items.length ? `<section class="section"><div class="section-head"><h2>${title}</h2></div><div class="shelf">${items.join("")}</div></section>` : "";

// Albums of the tracks played, newest first, one card per album
function recentAlbums() {
  const seen = new Set();
  const out = [];
  for (const t of recent) {
    if (!t.albumId || seen.has(t.albumId)) continue;
    seen.add(t.albumId);
    out.push({ id: t.albumId, title: t.album, artist: t.artist, artistId: t.artistId, thumb: t.thumb, year: yearOf.get(t.albumId) || "" });
  }
  return out;
}

const artistThumbs = {};
const artistThumb = (id) => artistThumbs[id] || "";

function renderHome() {
  setAccent("#1f3b2d");
  const h = new Date().getHours();
  const greet = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  if (isOffline()) return dlRenderHomeOffline(greet);

  const shortcuts = playlists
    .filter((p) => p.id === "liked" || p.tracks.length)
    .slice(0, 8)
    .map((p) => ({ cover: coverHTML(p), name: p.name, attrs: `data-act="open-pl" data-id="${esc(p.id)}"` }));
  if (dlOn() && dlMetas.length) shortcuts.splice(1, 0, dlShortcut());
  shortcuts.length = Math.min(shortcuts.length, 8);
  if (shortcuts.length < 8)
    recentAlbums().slice(0, 8 - shortcuts.length).forEach((a) =>
      shortcuts.push({ cover: `<span class="cover">${imgTag(a.thumb)}</span>`, name: a.title, attrs: `data-act="album" data-id="${esc(a.id)}"`, go: `data-act="play-album" data-id="${esc(a.id)}"` }),
    );

  const moods = [
    ["Pop", "pop hits", "#e13300"], ["Chill", "chill lofi", "#477d95"],
    ["Hip-Hop", "hip hop", "#bc5900"], ["Rock", "classic rock", "#e91429"],
    ["Electronic", "electronic dance", "#0d73ec"], ["Jazz", "jazz", "#7d4b32"],
    ["R&B", "r&b soul", "#503750"], ["Indie", "indie", "#608108"],
    ["K-Pop", "kpop", "#8d67ab"], ["Latin", "reggaeton", "#e8115b"],
    ["Metal", "metal", "#5f3b1d"], ["Acoustic", "acoustic", "#1e3264"],
    ["Workout", "workout", "#8c1932"], ["Focus", "focus instrumental", "#006450"],
    ["Party", "party", "#af2896"], ["Sleep", "sleep ambient", "#2d46b9"],
  ];

  setView(`
    <h1 class="page">${greet}</h1>
    <div class="shortcuts">${shortcuts
      .map((s) => `<div class="shortcut" ${s.attrs}>${s.cover}<span class="n">${esc(s.name)}</span><button class="go" ${s.go || ""} tabindex="-1">${icon("play")}</button></div>`)
      .join("")}</div>
    ${shelf("Recently played", recentAlbums().slice(0, 12).map((a) => albumCard(a)))}
    <div id="home-mixes">${mixes.length ? mixShelf() : ""}</div>
    <div id="home-charts"></div>
    <section class="section"><div class="section-head"><h2>Browse all</h2></div>
      <div class="moods">${moods
        .map(([l, q, c]) => `<div class="mood" style="background:${c}" data-act="mood" data-q="${esc(q)}">${esc(l)}</div>`)
        .join("")}</div></section>`);

  fixYears();
  if (!mixes.length || mixes.day !== dayKey())
    (mixPromise ||= buildMixes().finally(() => (mixPromise = null))).then(() => view.name === "home" && $("home-mixes") && ($("home-mixes").innerHTML = mixShelf()));

  api("/home")
    .then((d) => {
      if (view.name !== "home" || !$("home-charts")) return;
      lists.charts = d.tracks;
      $("home-charts").innerHTML =
        shelf("Trending now", d.tracks.slice(0, 12).map((t, i) => trackCard(t, "charts", i))) +
        shelf("Popular artists", d.artists.slice(0, 12).map(artistCard)) +
        shelf("Popular albums", d.albums.slice(0, 12).map((a) => albumCard(a)));
      fixYears();
    })
    .catch(() => {});
}

let searchSeq = 0;
let searchTab = "all", searchData = null;
function paintSearch() {
  const { tracks, artists, albums, top: tp, q } = searchData;
  const tabs = [["all", "All"], ["songs", "Songs"], ["artists", "Artists"], ["albums", "Albums"]]
    .filter(([k]) => k === "all" || (k === "songs" ? tracks : k === "artists" ? artists : albums).length)
    .map(([k, l]) => `<button class="chip${searchTab === k ? " on" : ""}" data-act="search-tab" data-tab="${k}">${l}</button>`)
    .join("");
  const chips = `<div class="chips search-chips">${tabs}</div>`;
  let body = "";
  if (searchTab === "songs") {
    body = `<div id="songs">${tracks.map((t, i) => rowHTML(t, i, "search", null, true)).join("")}</div>`;
  } else if (searchTab === "artists") {
    body = `<div class="grid">${artists.map(artistCard).join("")}</div>`;
  } else if (searchTab === "albums") {
    body = `<div class="grid">${albums.map((a) => albumCard(a)).join("")}</div>`;
  } else {
    let top = "";
    const kind = tp?.type;
    if (kind === "artist") {
      const a = artists.find((x) => x.id === tp.id);
      top = `<div class="top-card round" data-act="artist" data-id="${esc(a.id)}" data-name="${esc(a.name)}" data-thumb="${esc(a.thumb)}">
        ${a.thumb ? imgTag(a.thumb) : `<span class="tc-ph">${icon("music", 40)}</span>`}<div class="tc-t">${esc(a.name)}</div><div class="tc-s"><b>Artist</b></div></div>`;
    } else if (kind === "album") {
      const a = albums.find((x) => x.id === tp.id);
      top = `<div class="top-card" data-act="album" data-id="${esc(a.id)}">
        ${imgTag(a.thumb)}<div class="tc-t">${esc(a.title)}</div><div class="tc-s">${esc(a.artist)}<b>${a.type === "single" ? "Single" : a.type === "ep" ? "EP" : "Album"}</b></div></div>`;
    } else if (tracks[0]) {
      const i = Math.max(0, tracks.findIndex((x) => x.id === tp?.id)), t = tracks[i];
      top = `<div class="top-card" data-act="play-list" data-list="search" data-idx="${i}">
        ${imgTag(t.thumb)}<div class="tc-t">${esc(t.title)}</div><div class="tc-s">${esc(t.artist)}<b>Song</b></div>
        <button class="go" tabindex="-1">${icon("play")}</button></div>`;
    }
    body = `
      <div class="res-grid">
        <section><div class="section-head"><h2>Top result</h2></div>${top}</section>
        <section><div class="section-head"><h2>Songs</h2></div>
          <div id="songs">${tracks.slice(0, 4).map((t, i) => rowHTML(t, i, "search", null, true)).join("")}</div>
          ${tracks.length > 4 ? `<button class="show-more" data-act="search-tab" data-tab="songs">Show more</button>` : ""}
        </section>
      </div>
      ${shelf("Artists", artists.slice(0, 10).map(artistCard))}
      ${shelf("Albums", albums.slice(0, 10).map((a) => albumCard(a)))}`;
  }
  setView(chips + body);
  if (searchTab === "all" && tracks[0]) prefetchTrack(tracks[0]);
  refreshMarks();
  fixYears();
}

async function renderSearch(data) {
  const q = data?.q || "";
  setAccent("#2a2a2a");
  if (isOffline()) {
    ++searchSeq; // a search still in flight must not paint over this
    setView(`<h1 class="page">Search</h1>${dlOfflineEmpty("You’re offline", "Search needs a connection. Your downloads still play.")}`);
    return;
  }
  if (!q) {
    const hist = searchHistory.length
      ? `<div class="section-head"><h2>Recent searches</h2><button class="chip-link" data-act="clear-history">Clear all</button></div><div class="hist">${searchHistory
          .map((h) => `<div class="hist-row"><button class="hist-main" data-act="run-history" data-q="${esc(h)}">${icon("clock", 20)}<span>${esc(h)}</span></button><button class="hist-x" data-act="remove-history" data-q="${esc(h)}" aria-label="Remove ${esc(h)} from history">${icon("close", 18)}</button></div>`)
          .join("")}</div>`
      : `<div class="empty"><b>Find your music</b>Search for songs, artists and albums.</div>`;
    setView(`<h1 class="page">Search</h1>${hist}`);
    $("q").focus();
    return;
  }
  if (searchData?.q !== q) searchTab = "all";
  const seq = ++searchSeq;
  setView(`<div class="skeleton">${skeletonRows(8)}</div>`);
  try {
    const d = await api("/search?q=" + encodeURIComponent(q));
    if (seq !== searchSeq) return;
    const { tracks, artists, albums } = d;
    if (!tracks.length && !artists.length && !albums.length) {
      // don't keep searches that found nothing in the history
      const qq = q.toLowerCase();
      if (searchHistory.some((x) => x.toLowerCase() === qq)) {
        searchHistory = searchHistory.filter((x) => x.toLowerCase() !== qq);
        saveSearchHistory();
      }
      setView(`<div class="empty"><b>No results found for "${esc(q)}"</b>Please make sure your words are spelled correctly, or use fewer or different keywords.</div>`);
      return;
    }
    lists.search = tracks;
    searchData = { ...d, q };
    paintSearch();
  } catch (e) {
    if (seq === searchSeq && e instanceof OfflineError) renderSearch(data);
    else if (seq === searchSeq)
      setView(`<div class="empty"><b>Search failed</b>${esc(e.message)}<br>Is <code>python backend.py</code> running?</div>`);
  }
}

let discFilter = () => {};
async function renderArtist(data) {
  setAccent(accentFor(data.name));
  setView(`
    <div class="hero round">
      <span class="cover">${data.thumb ? imgTag(data.thumb) : ""}</span>
      <div><div class="type">Artist</div><h1>${esc(data.name)}</h1><div class="meta" id="artist-meta"></div></div>
    </div>
    <div id="artist-body"><div class="skeleton">${skeletonRows(6)}</div></div>`);
  try {
    const d = await api("/artist/" + encodeURIComponent(data.id));
    if (view.name !== "artist" || view.data !== data) return;
    lists.artist = d.tracks;
    const cover = $("view").querySelector(".hero .cover");
    if (cover && !cover.firstElementChild && d.artist.thumb) cover.innerHTML = imgTag(d.artist.thumb);
    lastArtist = { id: d.artist.id, name: d.artist.name, thumb: d.artist.thumb };
    if (d.artist.fans) $("artist-meta").textContent = `${d.artist.fans.toLocaleString()} fans`;
    const groups = [
      ["album", "Albums", d.albums.filter((a) => a.type !== "single" && a.type !== "ep" && a.type !== "compile")],
      ["single", "Singles & EPs", d.albums.filter((a) => a.type === "single" || a.type === "ep")],
      ["compile", "Compilations", d.albums.filter((a) => a.type === "compile")],
    ].filter((g) => g[2].length);
    const showGroup = (key) => {
      const g = groups.find((x) => x[0] === key);
      document.querySelectorAll("#disc-chips .chip").forEach((c) => c.classList.toggle("on", c.dataset.f === key));
      $("disc-grid").innerHTML = g[2]
        .map((a) => albumCard(a, [a.year, a.type === "single" ? "Single" : a.type === "ep" ? "EP" : a.type === "compile" ? "Compilation" : "Album"].filter(Boolean).join(" · ")))
        .join("");
      fixYears();
    };
    discFilter = (key) => showGroup(key);
    $("artist-body").innerHTML = `
      <div class="actions">
        <button class="big-play" data-act="play-list" data-list="artist" data-start="1" title="Play">${icon("play", 28)}</button>
        <button class="ghost-ic pg-shuffle" data-act="shuffle" title="Shuffle">${icon("shuffle", 32)}</button>
        <button class="pill-btn" data-act="follow-artist">Follow</button>
      </div>
      <h2 style="font-size:24px;font-weight:800;margin:16px 0">Popular</h2>
      ${d.tracks.slice(0, 10).map((t, i) => rowHTML(t, i, "artist")).join("")}
      ${
        groups.length
          ? `<section class="section"><div class="section-head"><h2>Discography</h2></div>
              <div class="chips" id="disc-chips">${groups.map(([k, l, items]) => `<button class="chip" data-act="disc-filter" data-f="${k}">${l} <span>${items.length}</span></button>`).join("")}</div>
              <div class="shelf wrap" id="disc-grid"></div></section>`
          : ""
      }`;
    if (groups.length) showGroup(groups[0][0]);
    refreshMarks();
    refreshSaveButtons();
    renderPrefs();
  } catch (e) {
    if (view.name !== "artist" || view.data !== data) return;
    if (e instanceof OfflineError) $("artist-body").innerHTML = dlNeedsConnection();
    else $("artist-body").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function renderAlbum(id) {
  setView(`<div class="skeleton">${skeletonRows(8)}</div>`);
  try {
    const d = await api("/album/" + encodeURIComponent(id));
    if (view.name !== "album" || view.data !== id) return;
    const a = d.album;
    setAccent(accentFor(a.title));
    lastAlbum = a;
    lists.album = d.tracks;
    const total = d.tracks.reduce((x, t) => x + (t.duration || 0), 0);
    const kind = a.type === "single" ? "Single" : a.type === "ep" ? "EP" : "Album";
    setView(`
      <div class="hero"><span class="cover">${imgTag(a.thumb)}</span>
        <div><div class="type">${kind}</div><h1>${esc(a.title)}</h1>
          <div class="meta"><a class="artist-link" data-act="artist" data-id="${esc(a.artistId)}" data-name="${esc(a.artist)}"><b>${esc(a.artist)}</b></a>${a.year ? ` · <span class="yr" data-id="${esc(a.id)}">${esc(a.year)}</span>` : ""} · ${d.tracks.length} song${d.tracks.length === 1 ? "" : "s"}, ${fmtLong(total)}</div>
        </div></div>
      <div class="actions"><button class="big-play" data-act="play-list" data-list="album" data-start="1" title="Play">${icon("play", 28)}</button>
        <button class="ghost-ic pg-shuffle" data-act="shuffle" title="Shuffle">${icon("shuffle", 32)}</button>
        <button class="ghost-ic save-toggle" data-act="save-album" title="Save to Your Library"><span class="off">${icon("heart", 32)}</span><span class="on">${icon("heart-fill", 32)}</span></button>${dlToggleHTML("album:" + a.id, "album")}</div>
      <div class="thead compact"><span>#</span><span>Title</span><span></span><span class="r">${icon("clock", 16)}</span><span></span></div>
      ${d.tracks.map((t, i) => rowHTML(t, i, "album", null, true, true)).join("")}`);
    refreshMarks();
    refreshSaveButtons();
    fixYears();
  } catch (e) {
    if (view.name !== "album" || view.data !== id) return;
    if (e instanceof OfflineError) dlRenderAlbumOffline(id);
    else setView(`<div class="empty"><b>Couldn't load album</b>${esc(e.message)}</div>`);
  }
}

function renderPlaylist(id) {
  const pl = getPl(id);
  if (!pl) return navigate("home");
  setAccent(pl.id === "liked" ? "#4a3ca8" : accentFor(pl.id));
  lists["pl:" + pl.id] = pl.tracks;
  const total = pl.tracks.reduce((a, t) => a + (t.duration || 0), 0);
  const custom = pl.id !== "liked";
  setView(`
    <div class="hero">
      ${custom ? coverEditButton(coverHTML(pl)) : coverHTML(pl)}
      <div><div class="type">Playlist</div>
        <h1 ${custom ? 'class="editable" data-act="edit-pl"' : ""}>${esc(pl.name)}</h1>
        <div class="meta"><b>You</b> · ${pl.tracks.length} song${pl.tracks.length === 1 ? "" : "s"}${total ? `, ${fmtLong(total)}` : ""}</div>
      </div>
    </div>
    <div class="actions">
      <button class="big-play" data-act="play-list" data-list="pl:${esc(pl.id)}" data-start="1" title="Play" ${pl.tracks.length ? "" : "disabled style='opacity:.5'"}>${icon("play", 28)}</button>
      <button class="ghost-ic pg-shuffle" data-act="shuffle" title="Shuffle">${icon("shuffle", 32)}</button>
      ${pl.tracks.length ? dlToggleHTML(custom ? "pl:" + pl.id : "liked", "pl:" + pl.id) : ""}${custom ? `<button class="ghost-ic" data-act="edit-pl" title="Edit playlist" aria-label="Edit playlist">${icon("edit", 28)}</button><button class="ghost-ic" data-act="del-pl" title="Delete playlist">${icon("trash", 28)}</button>` : ""}
    </div>
    ${
      pl.tracks.length
        ? `<div class="thead"><span>#</span><span>Title</span><span class="h-album">Album</span><span></span><span class="r">${icon("clock", 16)}</span><span></span></div>
           <div ${custom ? `data-sortable="playlist" data-pl="${esc(pl.id)}"` : ""}>${pl.tracks.map((t, i) => rowHTML(t, i, "pl:" + pl.id, pl.id)).join("")}</div>`
        : `<div class="empty"><b>Let's find something for your playlist</b>Search for songs and use the ⋯ menu to add them here.</div>`
    }`);
  refreshMarks();
}

/* ── Made for you: Daily Mixes ─────────────────────────── */
// Seeds come from what you follow, save, like and play; each seed artist's
// radio is shuffled with a per-day RNG so a mix is stable all day and fresh
// tomorrow.
let mixes = [];
let mixPromise = null;
const MIX_COLORS = ["#1ed760", "#f573a0", "#509bf5", "#ffc864", "#cf87fa", "#ff6437"];
const dayKey = () => new Date().toISOString().slice(0, 10);
function rng(seedStr) {
  let a = 0;
  for (const c of seedStr) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function mixSeeds() {
  const w = new Map();
  const add = (id, name, score) => {
    if (!id) return;
    const e = w.get(id) || { id, name, score: 0 };
    e.score += score;
    w.set(id, e);
  };
  library.artists.forEach((a) => add(a.id, a.name, 3));
  library.albums.forEach((a) => add(a.artistId, a.artist, 2));
  playlists.forEach((p) => p.tracks.forEach((t) => add(t.artistId, t.artist, p.id === "liked" ? 2 : 1)));
  recent.forEach((t, i) => add(t.artistId, t.artist, i < 5 ? 2 : 1));
  const rand = rng(dayKey());
  let seeds = [...w.values()].map((e) => ({ ...e, score: e.score + rand() * 0.9 })).sort((a, b) => b.score - a.score);
  if (seeds.length < 4) {
    // cold start: pad with today's popular artists
    try {
      const chart = (await api("/home")).artists.map((a) => ({ id: a.id, name: a.name, score: 0 }));
      seeds = [...seeds, ...chart.filter((c) => !w.has(c.id))];
    } catch {}
  }
  return seeds.slice(0, 6);
}
async function buildMixes() {
  if (isOffline()) return;
  const day = dayKey();
  const seeds = await mixSeeds();
  const built = await Promise.all(
    seeds.map(async (s, i) => {
      try {
        const d = await api("/mix/" + encodeURIComponent(s.id));
        const rand = rng(day + ":" + s.id);
        const tracks = d.tracks.map((t) => [rand(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, 30);
        if (tracks.length < 5) return null;
        const freq = {};
        tracks.forEach((t) => (freq[t.artist] = (freq[t.artist] || 0) + 1));
        // the seed artist always leads the description
        const names = [s.name, ...Object.keys(freq).sort((a, b) => freq[b] - freq[a]).filter((n) => n !== s.name)].slice(0, 3);
        return { tracks, names };
      } catch {
        return null;
      }
    }),
  );
  if (isOffline()) return; // half-built while the connection dropped: try again once back online
  mixes = built.filter(Boolean).map((m, i) => {
    const id = String(i + 1);
    lists["mix:" + id] = m.tracks;
    return { id, name: `Daily Mix ${i + 1}`, color: MIX_COLORS[i % MIX_COLORS.length], ...m };
  });
  mixes.day = day;
}
function mixCover(m, size) {
  const thumbs = [...new Set(m.tracks.map((t) => t.thumb).filter(Boolean))].slice(0, 4);
  while (thumbs.length && thumbs.length < 4) thumbs.push(thumbs[thumbs.length % thumbs.length]);
  return `<span class="cover mosaic mix-cover">${thumbs.map((t) => imgTag(t)).join("")}<b class="mix-tag" style="--c:${m.color}">${size === "big" ? "Daily Mix" : "Mix " + m.id}</b></span>`;
}
function mixShelf() {
  if (!mixes.length) return "";
  return `<section class="section"><div class="section-head"><h2>Made for you</h2></div><div class="shelf">${mixes
    .map(
      (m) => `<div class="card" data-act="mix" data-id="${m.id}">
        <div class="art">${mixCover(m)}<button class="go" data-act="play-list" data-list="mix:${m.id}" data-start="1" tabindex="-1" title="Play">${icon("play")}</button></div>
        <div class="c-t">${esc(m.name)}</div><div class="c-s">${esc(m.names.join(", "))} and more</div></div>`,
    )
    .join("")}</div></section>`;
}
function renderMix(id) {
  const m = mixes.find((x) => x.id === id);
  if (!m) return navigate("home");
  setAccent(`color-mix(in srgb, ${m.color} 45%, #121212)`);
  const total = m.tracks.reduce((a, t) => a + (t.duration || 0), 0);
  setView(`
    <div class="hero">${mixCover(m, "big")}
      <div><div class="type">Made for you</div><h1>${esc(m.name)}</h1>
        <div class="meta">${esc(m.names.join(", "))} and more<br><b>${m.tracks.length} songs</b>, ${fmtLong(total)}</div></div></div>
    <div class="actions">
      <button class="big-play" data-act="play-list" data-list="mix:${m.id}" data-start="1" title="Play">${icon("play", 28)}</button>
      <button class="ghost-ic pg-shuffle" data-act="shuffle" title="Shuffle">${icon("shuffle", 32)}</button>
      <button class="pill-btn" data-act="save-mix" data-id="${m.id}">Save as playlist</button>${dlToggleHTML(dlMixKey(m), "mix:" + m.id)}
    </div>
    <div class="thead"><span>#</span><span>Title</span><span class="h-album">Album</span><span></span><span class="r">${icon("clock", 16)}</span><span></span></div>
    ${m.tracks.map((t, i) => rowHTML(t, i, "mix:" + m.id)).join("")}`);
  refreshMarks();
}

/* ── Original release years ────────────────────────────── */
// Deezer dates each *edition* (a 2009 remaster says 2015), so the backend
// looks up the original year on MusicBrainz. That's slow, so pages render
// first and the years are patched in as batches arrive.
const yearOf = new Map();
async function fixYears() {
  const v = view;
  const root = $("view");
  const apply = () => {
    root.querySelectorAll('.card[data-act="album"]').forEach((card) => {
      const y = yearOf.get(card.dataset.id);
      const sub = card.querySelector(".c-s");
      if (y && sub) sub.textContent = /^\d{4}/.test(sub.textContent) ? sub.textContent.replace(/^\d{4}/, y) : `${y} · ${sub.textContent}`;
      if (y) card.dataset.year = y;
    });
    root.querySelectorAll(".yr[data-id]").forEach((el) => {
      const y = yearOf.get(el.dataset.id);
      if (y) el.textContent = y;
    });
    const grid = $("disc-grid");
    if (grid) {
      const cards = [...grid.children];
      const sorted = [...cards].sort((a, b) => (+b.dataset.year || 0) - (+a.dataset.year || 0));
      if (sorted.some((c, i) => c !== cards[i])) sorted.forEach((c) => grid.appendChild(c));
    }
  };
  // On an artist page their own albums resolve together from one artist-wide lookup;
  // other artists' albums each cost a separate slow lookup, so they go last.
  const own = v.name === "artist" ? v.data.name : null;
  const els = [...root.querySelectorAll('.card[data-act="album"][data-id], .yr[data-id]')];
  els.sort((x, y) => (y.dataset.artist === own) - (x.dataset.artist === own));
  const ids = els.map((e) => e.dataset.id);
  apply();
  const need = [...new Set(ids)].filter((id) => !yearOf.has(id));
  for (let i = 0; i < need.length; i += 4) {
    if (isOffline()) return;
    try {
      const r = await (await fetch(`${API}/years?ids=${need.slice(i, i + 4).join(",")}`)).json();
      Object.entries(r).forEach(([k, y]) => yearOf.set(k, y));
    } catch {
      return;
    }
    if (view !== v) return; // navigated away; later visits reuse yearOf
    apply();
  }
}

async function playAlbum(id) {
  try {
    const d = await api("/album/" + encodeURIComponent(id));
    playList(d.tracks, 0, true);
  } catch (e) {
    if (!(e instanceof OfflineError)) return toast("Couldn't load album");
    const local = dlAlbumTracks(id);
    if (local.length) playList(local, 0, true);
    else toast("This album isn’t available offline");
  }
}

/* ── Fragments ─────────────────────────────────────────── */
function skeletonRows(n) {
  return Array.from({ length: n }, () => `<div class="row"><span></span><div class="c-title"><div class="sk" style="width:40px;height:40px"></div><div class="tt" style="flex:1"><div class="sk" style="height:14px;width:45%;margin-bottom:6px"></div><div class="sk" style="height:11px;width:25%"></div></div></div><span></span><span></span><span></span><span></span></div>`).join("");
}

// override: undefined = stored custom cover, null = ignore it (derived cover), string = that data URL (edit preview)
function coverHTML(pl, override) {
  if (pl.id === "liked") return `<span class="cover liked">${icon("heart-fill", 40)}</span>`;
  const custom = override === undefined ? covers[pl.id] : override;
  if (isCoverURL(custom)) return `<span class="cover"><img src="${esc(custom)}" alt="" decoding="async" data-cover="1"></span>`;
  const th = pl.tracks.map((t) => t.thumb);
  if (th.length >= 4) return `<span class="cover mosaic">${th.slice(0, 4).map((s) => imgTag(s)).join("")}</span>`;
  if (th.length) return `<span class="cover">${imgTag(th[0])}</span>`;
  return `<span class="cover ph">${icon("music", 48)}</span>`;
}

function rowHTML(t, i, listKey, plId, compact, noimg) {
  const dl = dlOn();
  const unavail = dl && isOffline() && !Offline.has(t.id);
  const artistA = `<a class="artist" data-act="artist" data-id="${esc(t.artistId)}" data-name="${esc(t.artist)}">${esc(t.artist)}</a>`;
  return `<div class="row${compact ? " compact" : ""}${noimg ? " noimg" : ""}${unavail ? " unavail" : ""}" data-id="${esc(t.id)}" data-list="${esc(listKey)}" data-idx="${i}"${plId ? ` data-pl="${esc(plId)}"` : ""}${unavail ? ' aria-disabled="true"' : ""}>
    <div class="c-num"><span class="n">${i + 1}</span><button class="rp" data-act="play-row" tabindex="-1">${icon("play", 16)}</button><span class="eq"><i></i><i></i><i></i><i></i></span></div>
    <div class="c-title">${imgTag(t.thumb)}<div class="tt"><div class="name">${esc(t.title)}</div>${dl ? `<div class="dl-sub">${dlIndHTML(t.id)}${artistA}</div>` : artistA}</div></div>
    <a class="c-album" data-act="album" data-id="${esc(t.albumId)}" title="${esc(t.album)}">${esc(t.album)}</a>
    <div><button class="icon-btn heart" data-act="like" data-id="${esc(t.id)}" title="Save to Liked Songs"><span data-x="a">${icon("heart", 18)}</span><span data-x="b">${icon("heart-fill", 18)}</span></button></div>
    <div class="c-dur">${fmtTime(t.duration)}</div>
    <div class="c-more"><button class="icon-btn" data-act="more" title="More options">${icon("more", 20)}</button></div>
  </div>`;
}

/* Cheap in-place state refresh (playing row, liked hearts) so no re-render is needed */
function refreshMarks() {
  document.querySelectorAll(".row").forEach((r) => r.classList.toggle("playing", !!current && r.dataset.id === current.id));
  document.querySelectorAll(".heart[data-id]").forEach((b) => b.classList.toggle("liked", isLiked(b.dataset.id)));
  $("p-like").classList.toggle("liked", !!current && isLiked(current.id));
  for (const id of ["mini-like", "np-like"]) $(id)?.classList.toggle("liked", !!current && isLiked(current.id));
  document.querySelectorAll(".heart [data-x]").forEach((s) => {
    const liked = s.closest(".heart").classList.contains("liked");
    s.style.display = (s.dataset.x === "b") === liked ? "block" : "none";
  });
  refreshDlMarks();
}

/* ── Library sidebar ───────────────────────────────────── */
// Shared by the desktop sidebar and the phone "Your Library" view
function libraryChipsHTML() {
  return [["playlists", "Playlists"], ["albums", "Albums"], ["artists", "Artists"], ...(dlOn() ? [["downloaded", "Downloaded"]] : [])]
    .map(([f, l]) => `<button class="chip ${libFilter === f ? "on" : ""}" data-act="lib-filter" data-f="${f}">${l}</button>`)
    .join("");
}
function libraryItemsHTML() {
  const item = (cls, attrs, cover, name, meta) => `<div class="lib-item ${cls}" ${attrs} title="${esc(name)}">${cover}
    <div style="min-width:0"><div class="lib-name">${esc(name)}</div><div class="lib-meta">${esc(meta)}</div></div></div>`;
  const rows = [];
  if (libFilter === "downloaded") {
    if (!dlOn()) libFilter = null;
    else return dlLibraryItems(item);
  }
  if (dlOn() && !libFilter && dlMetas.length) rows.push(dlLibraryEntry(item));
  if (!libFilter || libFilter === "playlists")
    playlists.forEach((pl) =>
      rows.push(item(view.name === "playlist" && view.data === pl.id ? "active" : "", `data-act="open-pl" data-id="${esc(pl.id)}"`, coverHTML(pl), pl.name, `Playlist · ${pl.tracks.length} song${pl.tracks.length === 1 ? "" : "s"}`)),
    );
  if (!libFilter || libFilter === "albums")
    library.albums.forEach((a) =>
      rows.push(item(view.name === "album" && view.data === a.id ? "active" : "", `data-act="album" data-id="${esc(a.id)}"`, `<span class="cover">${imgTag(a.thumb)}</span>`, a.title, `Album · ${a.artist}`)),
    );
  if (!libFilter || libFilter === "artists")
    library.artists.forEach((a) =>
      rows.push(item(view.name === "artist" && view.data?.id === a.id ? "active" : "", `data-act="artist" data-id="${esc(a.id)}" data-name="${esc(a.name)}" data-thumb="${esc(a.thumb)}"`, `<span class="cover round">${imgTag(a.thumb)}</span>`, a.name, "Artist")),
    );
  return rows.join("") || `<div class="lib-empty">Nothing here yet. Save albums and follow artists to find them here.</div>`;
}
function renderLibrary(skipView) {
  $("lib-chips").innerHTML = libraryChipsHTML();
  $("playlist-list").innerHTML = libraryItemsHTML();
  if (view.name === "library" && !skipView) renderLibraryView();
}
// Phone "Your Library" tab (also refreshed by renderLibrary while visible)
function renderLibraryView() {
  setAccent("#2a2a2a");
  const main = $("main");
  const top = main.scrollTop;
  setView(`${dlOn() || typeof renderSettings === "function" ? `<div class="off-lib-head"><h1 class="page">Your Library</h1><button class="icon-btn off-gear" data-act="open-settings" title="Settings" aria-label="Settings">${icon("settings", 24)}</button></div>` : `<h1 class="page">Your Library</h1>`}
    <div class="lib-actions"><button class="lib-new" data-act="new-pl">+ New playlist</button>${installRowHTML()}</div>
    ${iosHintHTML()}
    <div class="lib-chips">${libraryChipsHTML()}</div>
    <div class="lib-list">${libraryItemsHTML()}</div>`);
  main.scrollTop = top;
}

let lastAlbum = null;
let lastArtist = null;
function toggleAlbum() {
  const a = lastAlbum;
  if (!a) return;
  if (isAlbumSaved(a.id)) {
    library.albums = library.albums.filter((x) => x.id !== a.id);
    toast("Removed from Your Library");
  } else {
    library.albums.unshift(a);
    toast("Added to Your Library");
  }
  saveLibrary();
  renderLibrary();
  refreshSaveButtons();
}
function toggleArtist() {
  const a = lastArtist;
  if (!a) return;
  if (isArtistSaved(a.id)) {
    library.artists = library.artists.filter((x) => x.id !== a.id);
    toast("Removed from Your Library");
  } else {
    library.artists.unshift(a);
    toast(`Following ${a.name}`);
  }
  saveLibrary();
  renderLibrary();
  refreshSaveButtons();
}
function refreshSaveButtons() {
  document.querySelectorAll("[data-act=save-album]").forEach((b) => b.classList.toggle("saved", !!lastAlbum && isAlbumSaved(lastAlbum.id)));
  document.querySelectorAll("[data-act=follow-artist]").forEach((b) => {
    const on = !!lastArtist && isArtistSaved(lastArtist.id);
    b.classList.toggle("saved", on);
    b.textContent = on ? "Following" : "Follow";
  });
}

/* ── Playback ──────────────────────────────────────────── */
function setupAudio() {
  const fill = $("progress");
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || fill.classList.contains("drag") || $("np-progress").classList.contains("drag")) return;
    setSlider(fill, audio.currentTime / audio.duration);
    $("t-cur").textContent = fmtTime(audio.currentTime);
    syncProgressMirror(audio.currentTime / audio.duration, audio.currentTime);
    syncLyrics();
    syncNpLyrics();
    if ("mediaSession" in navigator && Math.floor(audio.currentTime) % 5 === 0) updatePosition();
  });
  audio.addEventListener("loadedmetadata", () => {
    $("t-dur").textContent = fmtTime(audio.duration);
    $("np-dur").textContent = fmtTime(audio.duration);
  });
  audio.addEventListener("play", () => {
    document.body.classList.add("is-playing");
    try { navigator.mediaSession.playbackState = "playing"; } catch {}
    updatePosition();
    apSync();
  });
  audio.addEventListener("pause", () => {
    document.body.classList.remove("is-playing");
    try { navigator.mediaSession.playbackState = "paused"; } catch {}
    updatePosition();
    apSync();
  });
  audio.addEventListener("seeked", () => { updatePosition(); apSync(); });
  audio.addEventListener("playing", () => { document.body.classList.remove("is-loading"); dlSkipRun = 0; });
  audio.addEventListener("waiting", () => document.body.classList.add("is-loading"));
  audio.addEventListener("ended", () => {
    if (sleep?.mode === "track") {
      clearSleep();
      toast("Sleep timer: stopped after this track");
      return;
    }
    nextTrack(true);
  });
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    document.body.classList.remove("is-loading");
    if (dlOn() && current && dlHandleAudioError()) return;
    toast("Couldn't play this track");
  });
}

let playToken = 0;
// noLocal: skip the downloaded copy (used when that copy turned out to be unplayable)
async function playTrack(track, noLocal) {
  const token = ++playToken;
  current = track;
  shufflePlayed.add(track.id);
  trackIndex[track.id] = track;
  updatePlayerUI();
  document.body.classList.add("is-loading");
  audio.removeAttribute("src");
  audio.load();
  // a downloaded copy wins even online: no network, instant seeking
  let blobURL = null;
  if (!noLocal && dlOn() && Offline.has(track.id)) {
    let blob = null;
    try { blob = await Offline.getBlob(track.id); } catch {}
    if (token !== playToken) return;
    if (blob) blobURL = URL.createObjectURL(blob);
  }
  if (!blobURL && dlOn() && isOffline()) {
    // nothing local to play and no network to ask: move on (capped, so it can't loop)
    dlSetObjectURL(null);
    document.body.classList.remove("is-loading");
    dlAutoSkip();
    return;
  }
  if (blobURL) audio.src = blobURL;
  else audio.src = `${API}/audio?id=${encodeURIComponent(track.id)}`;
  dlSetObjectURL(blobURL); // revokes the previous track's URL only now that it is no longer the source
  if (dlOn() && isOffline()) dlLocalCovers();
  addRecent(track);
  try {
    await audio.play();
    if (token !== playToken) return;
    prefetchNext();
  } catch (e) {
    if (token !== playToken || e.name === "AbortError") return;
    document.body.classList.remove("is-loading");
    // a source that can't be decoded also fires "error"; that handler owns the corrupt-download / offline paths
    if (dlOn() && e.name === "NotSupportedError" && (blobURL || isOffline())) return;
    toast("Playback failed: " + e.message);
  }
}

function addRecent(t) {
  recent = [t, ...recent.filter((r) => r.id !== t.id)].slice(0, 50);
  LS.set("recent", recent);
}

// Asking the backend for one byte makes it fetch + cache the whole track, so
// the real play later is instant.
const prefetched = new Set();
function prefetchTrack(t) {
  if (!t || prefetched.has(t.id)) return;
  if (dlOn() && (isOffline() || Offline.has(t.id))) return; // nothing to warm: local copy, or no network
  prefetched.add(t.id);
  fetch(`${API}/audio?id=${encodeURIComponent(t.id)}`, { headers: { Range: "bytes=0-0" } }).catch(() => prefetched.delete(t.id));
}
function prefetchNext() {
  if (prefs.shuffle) return;
  prefetchTrack(queue[qIndex + 1]);
  prefetchTrack(queue[qIndex + 2]);
}

function playList(tracks, idx, shuffleStart = false) {
  if (!tracks?.length) return;
  if (dlOn() && isOffline()) {
    // offline: only downloaded songs can start; a click on one that isn't does nothing but explain
    const ok = tracks.map((t, k) => k).filter((k) => dlPlayable(tracks[k]));
    if (!ok.length) return toast(tracks.length === 1 ? "This song isn’t downloaded" : "None of these songs are downloaded");
    if (!shuffleStart && !dlPlayable(tracks[idx])) return toast("This song isn’t downloaded");
    queue = [...tracks];
    history = [];
    shufflePlayed.clear();
    qIndex = shuffleStart && prefs.shuffle ? ok[Math.floor(Math.random() * ok.length)] : shuffleStart ? ok[0] : idx;
    playTrack(queue[qIndex]);
    renderQueue();
    return;
  }
  queue = [...tracks];
  history = [];
  shufflePlayed.clear();
  qIndex = shuffleStart && prefs.shuffle ? Math.floor(Math.random() * queue.length) : idx;
  playTrack(queue[qIndex]);
  renderQueue();
}

function nextTrack(auto = false) {
  if (!queue.length) return;
  if (auto && prefs.repeat === 2) {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  if (dlOn() && isOffline()) return dlNextOffline(auto);
  let i;
  if (prefs.shuffle && queue.length > 1) {
    let pool = queue.map((t, k) => k).filter((k) => !shufflePlayed.has(queue[k].id));
    if (!pool.length) {
      // every track has played: stop (repeat off) or start a fresh round
      if (auto && prefs.repeat === 0) {
        document.body.classList.remove("is-playing");
        return;
      }
      shufflePlayed.clear();
      shufflePlayed.add(current.id);
      pool = queue.map((t, k) => k).filter((k) => queue[k].id !== current.id);
    }
    history.push(qIndex);
    i = pool[Math.floor(Math.random() * pool.length)];
  } else {
    i = qIndex + 1;
    if (i >= queue.length) {
      if (auto && prefs.repeat === 0) {
        document.body.classList.remove("is-playing");
        return;
      }
      i = 0;
    }
  }
  qIndex = i;
  playTrack(queue[qIndex]);
  renderQueue();
}

function prevTrack(force = false) {
  if (!queue.length) return;
  if (!force && audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (dlOn() && isOffline()) return dlPrevOffline();
  qIndex = prefs.shuffle && history.length ? history.pop() : (qIndex - 1 + queue.length) % queue.length;
  playTrack(queue[qIndex]);
  renderQueue();
}

function togglePlay() {
  if (!current) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function playNext(t) {
  if (!queue.length) return playList([t], 0); // playList refuses songs that can't play offline
  queue.splice(qIndex + 1, 0, t);
  toast("Will play next");
  renderQueue();
}
function addToQueue(t) {
  if (!queue.length) return playList([t], 0);
  queue.push(t);
  toast("Added to queue");
  renderQueue();
}

function renderPrefs() {
  $("btn-shuffle").classList.toggle("active", prefs.shuffle);
  const rp = $("btn-repeat");
  rp.classList.toggle("active", prefs.repeat > 0);
  rp.classList.toggle("one-on", prefs.repeat === 2);
  const vol = airplay ? airplayVol ?? 0.5 : prefs.volume;
  $("volume")?.classList.toggle("vol-unknown", !!airplay && airplayVol == null);
  const muted = airplay ? airplayMuted : prefs.muted;
  $("np-shuffle")?.classList.toggle("active", prefs.shuffle);
  const nrp = $("np-repeat");
  nrp?.classList.toggle("active", prefs.repeat > 0);
  nrp?.classList.toggle("one-on", prefs.repeat === 2);
  document.body.classList.toggle("is-muted", muted || vol === 0);
  setSlider($("volume"), muted ? 0 : vol);
  document.querySelectorAll(".pg-shuffle").forEach((b) => b.classList.toggle("on", prefs.shuffle));
}

function updatePlayerUI() {
  const t = current;
  $("p-title").textContent = t.title;
  const a = $("p-artist");
  a.textContent = t.artist;
  a.dataset.name = t.artist;
  a.dataset.id = t.artistId;
  $("p-cover").innerHTML = imgTag(t.thumb);
  $("t-dur").textContent = fmtTime(t.duration);
  $("t-cur").textContent = "0:00";
  setSlider($("progress"), 0);
  syncProgressMirror(0, 0);
  syncMini();
  document.title = `${t.title} • ${t.artist}`;
  refreshMarks();
  renderLibrary();
  updateMediaSession();
  if (sidePanel === "lyrics") loadLyrics();
  if (lyricsFull) renderLyricsFull();
}

/* ── Sliders ───────────────────────────────────────────── */
function setSlider(el, ratio) {
  el.style.setProperty("--p", (clamp(ratio, 0, 1) * 100).toFixed(2) + "%");
}
function makeSlider(el, { onMove, onCommit }) {
  const ratio = (e) => {
    const r = el.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  };
  el.addEventListener("pointerdown", (e) => {
    try { el.setPointerCapture(e.pointerId); } catch {}
    el.classList.add("drag");
    setSlider(el, ratio(e));
    onMove(ratio(e));
    const move = (ev) => {
      setSlider(el, ratio(ev));
      onMove(ratio(ev));
    };
    const end = (ev, commit) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      el.classList.remove("drag");
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (commit) onCommit?.(ratio(ev));
    };
    const up = (ev) => end(ev, true);
    const cancel = (ev) => end(ev, false);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
  });
}
function setupSliders() {
  // both progress sliders (desktop bar + phone sheet) share these and mirror each other
  const progress = {
    onMove: (r) => {
      const t = r * (audio.duration || 0);
      $("t-cur").textContent = fmtTime(t);
      setSlider($("progress"), r);
      syncProgressMirror(r, t);
    },
    onCommit: (r) => {
      if (audio.duration) audio.currentTime = r * audio.duration;
    },
  };
  makeSlider($("progress"), progress);
  makeSlider($("np-progress"), progress);
  makeSlider($("volume"), {
    onMove: (r) => {
      if (airplay) {
        airplayVol = r;
        airplayMuted = false;
        apMuteTouched = false;
        $("volume")?.classList.remove("vol-unknown");
        sendAirplayVolume();
      } else {
        prefs.volume = r;
        prefs.muted = false;
        audio.volume = r;
        audio.muted = false;
      }
      document.body.classList.toggle("is-muted", r === 0);
    },
    onCommit: () => !airplay && savePrefs(),
  });
}

/* ── Phone: mini player + Now Playing sheet ──────────────── */
function syncProgressMirror(ratio, t) {
  setSlider($("np-progress"), ratio);
  const f = document.querySelector("#mini-prog .fill");
  if (f) f.style.width = (clamp(ratio, 0, 1) * 100).toFixed(2) + "%";
  $("np-cur").textContent = fmtTime(t);
}
function syncMini() {
  const t = current;
  const mini = $("mini");
  mini.hidden = !t;
  document.body.classList.toggle("has-mini", !!t);
  if (!t) {
    if (!$("np").hidden) closeNP();
    return;
  }
  const fb = thumbFallback;
  for (const id of ["mini-cover", "np-cover"]) {
    const img = $(id);
    img.onerror = () => { img.onerror = null; img.src = fb; };
    if (img.getAttribute("src") !== t.thumb) img.src = t.thumb;
  }
  $("mini-title").textContent = t.title;
  $("mini-artist").textContent = t.artist;
  $("np-title").textContent = t.title;
  const a = $("np-artist");
  a.textContent = t.artist;
  a.dataset.name = t.artist;
  a.dataset.id = t.artistId;
  $("np-dur").textContent = fmtTime(t.duration);
  if (!$("np").hidden) renderNpLyrics();
  $("np").style.setProperty("--np-h", hue(t.album || t.title));
}

// Lyrics card under the player (phone): preview of the synced lines, tap to expand
let npLy = { id: null, lines: [], active: -1 };
async function renderNpLyrics() {
  const t = current, box = $("npl-body");
  if (!t || !box) return;
  npLy = { id: t.id, lines: [], active: -1 };
  $("np").scrollTo?.({ top: 0 });
  box.scrollTop = 0;
  box.innerHTML = `<div class="npl-msg">Loading lyrics…</div>`;
  $("np-ly").classList.remove("npl-none");
  try {
    const d = await getLyrics(t);
    if (current?.id !== t.id) return;
    if (d.synced.length) {
      npLy.lines = d.synced;
      box.innerHTML = d.synced.map((l) => `<div class="npl-line">${esc(l.text || "♪")}</div>`).join("");
      syncNpLyrics(true);
    } else if (d.plain) box.innerHTML = `<div class="npl-plain">${esc(d.plain)}</div>`;
    else { box.innerHTML = `<div class="npl-msg">${d.instrumental ? "Instrumental" : "No lyrics found for this song"}</div>`; $("np-ly").classList.add("npl-none"); }
  } catch (e) {
    if (current?.id === t.id) box.innerHTML = `<div class="npl-msg">${e instanceof OfflineError ? esc(e.message) : "Couldn't load lyrics"}</div>`;
  }
}
function syncNpLyrics(force) {
  if ($("np").hidden || !npLy.lines.length) return;
  const now = audio.currentTime - (airplay ? apLatency : 0) + 0.25;
  let idx = -1;
  for (let i = 0; i < npLy.lines.length && npLy.lines[i].t <= now; i++) idx = i;
  if (idx === npLy.active && !force) return;
  npLy.active = idx;
  const box = $("npl-body"), els = box.children;
  for (let i = 0; i < els.length; i++) {
    els[i].classList.toggle("on", i === idx);
    els[i].classList.toggle("past", i < idx);
  }
  const el = els[Math.max(0, idx)];
  if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: force ? "auto" : "smooth" });
}

let npPushed = false;
function openNP() {
  if (!current || !$("np").hidden) return;
  $("np").hidden = false;
  renderNpLyrics();
  document.body.classList.add("np-open");
  window.history.pushState({ np: 1 }, "");
  npPushed = true;
}
function closeNP() {
  if ($("np").hidden) return;
  $("np").hidden = true;
  document.body.classList.remove("np-open");
  if (npPushed) {
    npPushed = false;
    window.history.back();
  }
}
// Swipe down on the Now Playing sheet to close it (the sheet follows the finger).
(() => {
  const np = $("np");
  const art = np.querySelector(".np-art");
  let x0, y0, t0, dx, dy, mode, onArt; // mode: undefined = undecided, "drag" (down), "skip" (sideways), "ignore"
  np.addEventListener("touchstart", (e) => {
    mode = e.touches.length > 1 || np.scrollTop > 0 || e.target.closest(".slider, input, .np-lyrics, [data-act=\"np-menu\"]") ? "ignore" : undefined;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = e.timeStamp; dx = dy = 0;
    onArt = !!e.target.closest(".np-art, .np-meta");
  }, { passive: true });
  np.addEventListener("touchmove", (e) => {
    if (mode === "ignore") return;
    dx = e.touches[0].clientX - x0;
    dy = e.touches[0].clientY - y0;
    if (!mode) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) mode = onArt && queue.length > 1 ? "skip" : "ignore";
      else mode = dy > 0 ? "drag" : "ignore";
      if (mode === "drag") { np.style.animation = "none"; np.style.transition = "none"; }
      if (mode === "skip") art.style.transition = "none";
    }
    if (mode === "skip") {
      e.preventDefault();
      art.style.transform = `translateX(${dx}px)`;
      art.style.opacity = Math.max(0.3, 1 - Math.abs(dx) / (innerWidth * 1.2));
      return;
    }
    if (mode !== "drag") return;
    e.preventDefault();
    dy = Math.max(0, dy);
    np.style.transform = `translateY(${dy}px)`;
    np.style.borderRadius = Math.min(dy / 4, 24) + "px";
  }, { passive: false });
  const endSkip = (e) => {
    mode = "ignore";
    const fast = Math.abs(dx) / Math.max(1, e.timeStamp - t0) > 0.4; // px/ms
    if (Math.abs(dx) > innerWidth * 0.25 || (fast && Math.abs(dx) > 40)) {
      const dir = dx < 0 ? -1 : 1; // left = next, right = previous
      art.style.transition = "transform .16s ease-in, opacity .16s";
      art.style.transform = `translateX(${dir * innerWidth}px)`;
      art.style.opacity = "0";
      setTimeout(() => {
        if (dir < 0) nextTrack(); else prevTrack(true);
        // the new cover slides in from the opposite side
        art.style.transition = "none";
        art.style.transform = `translateX(${-dir * innerWidth * 0.5}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          art.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s";
          art.style.transform = ""; art.style.opacity = "";
          setTimeout(() => { art.style.transition = ""; }, 240);
        }));
      }, 160);
    } else {
      art.style.transition = "transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s";
      art.style.transform = ""; art.style.opacity = "";
      setTimeout(() => { art.style.transition = ""; }, 220);
    }
  };
  const end = (e) => {
    if (mode === "skip") return endSkip(e);
    if (mode !== "drag") return;
    mode = "ignore";
    const fast = dy / Math.max(1, e.timeStamp - t0) > 0.5; // px/ms
    np.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1)";
    if (dy > innerHeight * 0.25 || (fast && dy > 40)) {
      np.style.transform = "translateY(100%)";
      setTimeout(() => { closeNP(); reset(); }, 200);
    } else {
      np.style.transform = "";
      setTimeout(reset, 230);
    }
  };
  const reset = () => { np.style.transform = np.style.transition = np.style.animation = np.style.borderRadius = ""; };
  np.addEventListener("touchend", end);
  np.addEventListener("touchcancel", end);
})();

window.addEventListener("popstate", () => {
  if ($("np").hidden) return npPushed = false;
  // back button: peel off the topmost overlay first, keeping the sheet's history entry
  if (lyricsFull || (isPhone() && sidePanel)) {
    if (lyricsFull) toggleLyricsFull(false);
    else openPanel(sidePanel);
    window.history.pushState({ np: 1 }, "");
    return;
  }
  npPushed = false;
  closeNP();
});

/* ── Media session (OS media keys / lock screen) ───────── */
function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch {} };
  h("play", togglePlay);
  h("pause", togglePlay);
  h("previoustrack", prevTrack);
  h("nexttrack", () => nextTrack());
  h("seekto", (d) => { audio.currentTime = d.seekTime; updatePosition(); });
  h("seekbackward", (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d?.seekOffset || 10)); updatePosition(); });
  h("seekforward", (d) => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (d?.seekOffset || 10)); updatePosition(); });
  h("stop", () => { audio.pause(); audio.currentTime = 0; updatePosition(); });
}
function updateMediaSession() {
  if (!("mediaSession" in navigator) || !current) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: current.title,
    artist: current.artist,
    artwork: ["96x96", "256x256", "512x512"].map((sizes) => ({ src: current.thumb, sizes })),
  });
}
function updatePosition() {
  try {
    if (audio.duration) navigator.mediaSession.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: 1 });
  } catch {}
}

/* ── Side panel (queue / lyrics) ──────────────────────── */
let sidePanel = null; // "queue" | "lyrics" | null
function openPanel(name) {
  sidePanel = sidePanel === name ? null : name;
  const p = $("queue-panel");
  $("app").classList.toggle("queue-open", !!sidePanel);
  p.hidden = !sidePanel;
  applyPanelWidths();
  p.style.background = "";
  p.classList.toggle("lyrics-panel", sidePanel === "lyrics");
  $("btn-queue").classList.toggle("active", sidePanel === "queue");
  $("btn-lyrics").classList.toggle("active", sidePanel === "lyrics");
  $("np-queue")?.classList.toggle("active", sidePanel === "queue");
  $("np-lyrics")?.classList.toggle("active", sidePanel === "lyrics");
  document.body.classList.toggle("panel-open", isPhone() && !!sidePanel);
  if (sidePanel === "queue") renderQueue();
  else if (sidePanel === "lyrics") loadLyrics();
}
const toggleQueue = () => openPanel("queue");
const toggleLyrics = () => openPanel("lyrics");

function renderQueue() {
  if (sidePanel !== "queue") return;
  const dl = dlOn();
  const item = (t, i, cur) => dl
    ? `<div class="q-item ${cur ? "cur" : ""}${!cur && isOffline() && !Offline.has(t.id) ? " unavail" : ""}" data-act="queue-play" data-idx="${i}" data-id="${esc(t.id)}">
      ${imgTag(t.thumb)}<div class="tt"><div class="name">${esc(t.title)}</div><div class="dl-sub">${dlIndHTML(t.id)}<div class="artist">${esc(t.artist)}</div></div></div>
      ${cur ? "" : `<button class="icon-btn" data-act="queue-more" title="More options">${icon("more", 18)}</button><button class="icon-btn" data-act="queue-remove" data-idx="${i}" title="Remove from queue">${icon("close", 18)}</button>`}</div>`
    : `<div class="q-item ${cur ? "cur" : ""}" data-act="queue-play" data-idx="${i}">
      ${imgTag(t.thumb)}<div class="tt"><div class="name">${esc(t.title)}</div><div class="artist">${esc(t.artist)}</div></div>
      ${cur ? "" : `<button class="icon-btn" data-act="queue-more" title="More options">${icon("more", 18)}</button><button class="icon-btn" data-act="queue-remove" data-idx="${i}" title="Remove from queue">${icon("close", 18)}</button>`}</div>`;
  const next = queue.slice(qIndex + 1);
  $("queue-panel").innerHTML = `<h3>Queue <button class="icon-btn panel-close" data-act="toggle-queue">${icon("close", 18)}</button></h3>
    ${current ? `<h4>Now playing</h4>${item(current, qIndex, true)}` : '<div class="empty" style="padding:40px 8px">Nothing playing yet</div>'}
    ${next.length ? `<h4>Next in queue <button data-act="queue-clear">Clear queue</button></h4><div data-sortable="queue" data-base="${qIndex + 1}">${next.map((t, k) => item(t, qIndex + 1 + k, false)).join("")}</div>` : ""}`;
}

/* ── Lyrics (synced when LRCLIB has timestamps) ───────── */
const lyricsCache = new Map();
let lyr = { id: null, lines: [], active: -1 };
const lyricsHead = () => `<h3>Lyrics <span><button class="icon-btn" data-act="lyrics-full" title="Full screen (F)">${icon("expand", 16)}</button><button class="icon-btn panel-close" data-act="toggle-lyrics" title="Close">${icon("close", 18)}</button></span></h3>`;

async function getLyrics(t) {
  let d = lyricsCache.get(t.id);
  if (!d && dlOn() && Offline.has(t.id)) {
    // a download carries its lyrics, so they work offline too
    let l = null;
    try { l = (await Offline.getMeta(t.id))?.lyrics; } catch {}
    if (l && typeof l === "object") {
      d = { synced: Array.isArray(l.synced) ? l.synced : [], plain: l.plain || "", instrumental: !!l.instrumental };
      lyricsCache.set(t.id, d);
    }
  }
  if (!d && isOffline()) throw new OfflineError("Lyrics aren’t available offline");
  if (!d) {
    d = await (await fetch(`${API}/lyrics?id=${encodeURIComponent(t.id)}`)).json();
    if (d.error) throw new Error(d.error);
    lyricsCache.set(t.id, d);
  }
  return d;
}

async function loadLyrics() {
  const panel = $("queue-panel");
  const t = current;
  lyr = { id: t?.id ?? null, lines: [], active: -1 };
  if (!t) {
    panel.innerHTML = lyricsHead() + `<div class="ly-msg">Play a song to see its lyrics</div>`;
    return;
  }
  const h = hue(t.album || t.title);
  panel.style.background = `linear-gradient(hsl(${h} 38% 34%), hsl(${h} 38% 13%) 70%)`;
  const head = `${lyricsHead()}<div class="ly-title">${esc(t.title)}<span>${esc(t.artist)}</span></div>`;
  panel.innerHTML = head + `<div class="ly-msg">Loading lyrics…</div>`;
  try {
    const d = await getLyrics(t);
    if (current?.id !== t.id || sidePanel !== "lyrics") return;
    if (d.synced.length) {
      lyr.lines = d.synced;
      panel.innerHTML = head + `<div class="ly-body">${d.synced
        .map((l, i) => `<div class="ly-line" data-act="ly-seek" data-i="${i}">${esc(l.text || "♪")}</div>`)
        .join("")}</div>`;
      syncLyrics(true);
    } else if (d.plain) {
      panel.innerHTML = head + `<div class="ly-body ly-plain">${esc(d.plain)}</div>`;
    } else {
      panel.innerHTML = head + `<div class="ly-msg">${d.instrumental ? "Instrumental" : "No lyrics found for this song"}</div>`;
    }
  } catch (e) {
    if (current?.id === t.id && sidePanel === "lyrics") panel.innerHTML = head + `<div class="ly-msg">${e instanceof OfflineError ? esc(e.message) : "Couldn't load lyrics"}</div>`;
  }
}

function syncLyrics(force) {
  const host = lyricsFull ? $("ly-full") : sidePanel === "lyrics" ? $("queue-panel") : null;
  if (!host || !lyr.lines.length) return;
  const now = audio.currentTime - (airplay ? apLatency : 0) + 0.25;
  let idx = -1;
  for (let i = 0; i < lyr.lines.length && lyr.lines[i].t <= now; i++) idx = i;
  if (idx === lyr.active && !force) return;
  lyr.active = idx;
  const els = host.querySelectorAll(".ly-line");
  els.forEach((el, i) => {
    el.classList.toggle("on", i === idx);
    el.classList.toggle("past", i < idx);
  });
  els[idx]?.scrollIntoView({ block: "center", behavior: force ? "auto" : "smooth" });
}

/* ── Full-screen lyrics ────────────────────────────────── */
let lyricsFull = false;
function toggleLyricsFull(force) {
  lyricsFull = force ?? !lyricsFull;
  $("ly-full").hidden = !lyricsFull;
  if (lyricsFull) renderLyricsFull();
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function toggleBrowserFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => toast("Full screen isn't available here"));
}
async function renderLyricsFull() {
  const el = $("ly-full");
  const t = current;
  const buttons = `<div class="ly-top"><button class="icon-btn" data-act="browser-fullscreen" title="Toggle browser full screen">${icon("fullscreen", 22)}</button><button class="icon-btn" data-act="lyrics-full" title="Close (Esc)">${icon("close", 24)}</button></div>`;
  if (!t) {
    el.style.setProperty("--h", 220);
    el.innerHTML = `${buttons}<div class="ly-wrap one"><div class="ly-scroll"><div class="ly-msg">Play a song to see its lyrics</div></div></div>`;
    return;
  }
  el.style.setProperty("--h", hue(t.album || t.title));
  const shell = `${imgTag(t.thumb, "ly-bg")}${buttons}<div class="ly-wrap">
    <div class="ly-side">${imgTag(t.thumb, "ly-cover")}<div class="ly-meta"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div></div>
    <div class="ly-scroll" id="ly-scroll">`;
  el.innerHTML = shell + `<div class="ly-msg">Loading lyrics…</div></div></div>`;
  lyr = { id: t.id, lines: [], active: -1 };
  try {
    const d = await getLyrics(t);
    if (current?.id !== t.id || !lyricsFull) return;
    const box = $("ly-scroll");
    if (d.synced.length) {
      lyr.lines = d.synced;
      box.innerHTML = d.synced.map((l, i) => `<div class="ly-line" data-act="ly-seek" data-i="${i}">${esc(l.text || "♪")}</div>`).join("");
      syncLyrics(true);
    } else if (d.plain) box.innerHTML = `<div class="ly-plain">${esc(d.plain)}</div>`;
    else box.innerHTML = `<div class="ly-msg">${d.instrumental ? "Instrumental" : "No lyrics found for this song"}</div>`;
  } catch (e) {
    if (current?.id === t.id && lyricsFull) $("ly-scroll").innerHTML = `<div class="ly-msg">${e instanceof OfflineError ? esc(e.message) : "Couldn't load lyrics"}</div>`;
  }
}

/* ── Sleep timer ───────────────────────────────────────── */
let sleep = null; // { mode: "time", at } | { mode: "track" }
let sleepTick = null;
function clearSleep() {
  clearInterval(sleepTick);
  sleep = null;
  updateSleepUI();
}
function setSleep(mode, mins) {
  clearInterval(sleepTick);
  sleep = mode === "time" ? { mode, at: Date.now() + mins * 60000, mins } : { mode };
  updateSleepUI();
  if (mode === "time") sleepTick = setInterval(tickSleep, 1000);
  toast(mode === "time" ? `Sleep timer set for ${mins} minutes` : "Playback will stop after this track");
}
function tickSleep() {
  if (!sleep || sleep.mode !== "time") return;
  if (sleep.at - Date.now() <= 0) return sleepFade();
  updateSleepUI();
}
// Ease the volume out over ~4s, then pause and restore it
function sleepFade() {
  clearSleep();
  if (airplay) {
    if (airplay.kind === "sonos") {
      clearTimeout(apVolTimer);
      apDirty = false;
      apLastPlay = Date.now(); // the device is fading out on purpose; not a dead stream
      airplayCall("/airplay/stop", { fade: 4 }).catch(() => {});
      setTimeout(() => { audio.pause(); }, 4000);
    } else audio.pause();
    toast("Sleep timer: playback paused");
    return;
  }
  const v0 = audio.volume;
  let step = 0;
  const fade = setInterval(() => {
    step++;
    audio.volume = Math.max(0, v0 * (1 - step / 20));
    if (step >= 20) {
      clearInterval(fade);
      audio.pause();
      audio.volume = prefs.volume;
      toast("Sleep timer: playback paused");
    }
  }, 200);
}
function updateSleepUI() {
  $("btn-sleep").classList.toggle("active", !!sleep);
  $("np-sleep")?.classList.toggle("active", !!sleep);
  let label = "";
  if (sleep?.mode === "time") {
    const left = Math.max(0, Math.ceil((sleep.at - Date.now()) / 1000));
    label = fmtTime(left);
  } else if (sleep?.mode === "track") label = "end";
  const sl = $("sleep-left");
  if (sl) sl.textContent = label;
  const cap = $("np-sleep-cap");
  if (cap) cap.textContent = sleep ? (sleep.mode === "track" ? "End of track" : label) : "Sleep";
  $("np-sleep")?.setAttribute("aria-label", sleep ? `Sleep timer: ${sleep.mode === "track" ? "end of track" : label + " left"}` : "Sleep timer");
}
updateSleepUI();
// Anchor to the clicked button; on phones the desktop one is display:none (zero rect)
function anchorRect(el, fallbackId) {
  const r = el?.getBoundingClientRect();
  return r && (r.width || r.height) ? r : $(fallbackId).getBoundingClientRect();
}
function sleepMenu(el) {
  const r = anchorRect(el, "btn-sleep");
  const items = [];
  if (sleep) items.push({ label: "Turn off timer", icon: "close", fn: () => { clearSleep(); toast("Sleep timer off"); } }, "-");
  [5, 10, 15, 30, 45, 60].forEach((m) => items.push({ label: `${m} minutes`, icon: "moon", active: sleep?.mode === "time" && sleep.mins === m, fn: () => setSleep("time", m) }));
  items.push("-", { label: "End of track", icon: "moon", active: sleep?.mode === "track", fn: () => setSleep("track") });
  openMenu(r.right - 220, r.top - 4, items, null, true);
}

/* ── AirPlay ───────────────────────────────────────────── */
// Browsers can't speak AirPlay (outside Safari), so the backend streams to the
// device (pyatv). The local <audio> keeps playing, muted, as the clock: progress,
// lyrics, auto-next and the sleep timer all keep working. Devices can't pause or
// seek, so the backend restarts the stream from the local position instead.
let apLatency = 2.3; // seconds between "played" locally and heard on the device (from the backend status)
let airplay = null; // { id, name, kind } while routed to a device
let airplayVol = null; // 0..1, or null while the device's volume is unknown
let airplayMuted = false;
let apDevices = [];
let apBusy = false;
let apDirty = false;
let apVolTimer;
let apLastPlay = 0; // when we last asked the device to play (grace period for the watchdog)
let apWatchTimer = null;
let apErrSeq = 0;
let apFails = 0;
let apDead = 0;
let apPolling = false;

async function airplayCall(path, body) {
  const res = await fetch(API + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let d;
  try { d = await res.json(); } catch { d = {}; }
  if (!res.ok || d.error) throw Object.assign(new Error(d.error || res.statusText), { hint: d.hint, status: res.status, code: d.code });
  return d;
}

function apFriendly(code, msg) {
  switch (code) {
    case "not_fetched": return `${airplay?.name || "The speaker"} couldn't reach this computer to fetch the audio (network/firewall)`;
    case "load_failed": return `${airplay?.name || "The speaker"} couldn't play this track`;
    case "grouped": return "This speaker is part of a group; control the group's main speaker";
    case "no_audio": return "Couldn't get the audio for this track";
    case "no_lan_ip":
    case "media_server": return "Streamify couldn't open its audio server for the speaker";
    default: return msg || "Playback on the device failed";
  }
}

function applyApStatus(st) {
  apLatency = typeof st.latency === "number" ? st.latency : 2.3;
  airplayVol = st.volume_known && st.volume != null ? st.volume / 100 : null;
  airplayMuted = false;
  if (typeof st.error_seq === "number") apErrSeq = st.error_seq;
}

function updateAirplayUI() {
  const b = $("btn-airplay");
  if (b) {
    b.classList.toggle("active", !!airplay || nativeCastOn);
    b.title = airplay ? `Playing on ${airplay.name}` : "Connect to an AirPlay device";
  }
  $("np-airplay")?.classList.toggle("active", !!airplay || nativeCastOn);
  audio.muted = !!airplay || prefs.muted; // the local element is only a clock while routed
}

// Reconcile the device with what the local player is doing, coalescing bursts
// of play / pause / seek events into the latest state.
async function apSync() {
  if (!airplay) return;
  if (apBusy) {
    apDirty = true;
    return;
  }
  apBusy = true;
  try {
    do {
      apDirty = false;
      if (!audio.paused && current) {
        apLastPlay = Date.now();
        await airplayCall("/airplay/play", { id: current.id, position: audio.currentTime });
        apLastPlay = Date.now();
      } else await airplayCall("/airplay/stop", {});
    } while (apDirty && airplay);
  } catch (e) {
    if (airplay) {
      toast(apFriendly(e.code, e.message));
      selectLocal(true);
    }
  } finally {
    apBusy = false;
  }
}

function sendAirplayVolume() {
  clearTimeout(apVolTimer);
  apVolTimer = setTimeout(() => {
    if (!airplay) return;
    // volume stays unknown (nothing sent) until the user has moved the slider
    const body = apMuteTouched ? { muted: airplayMuted } : airplayVol == null ? null : { value: Math.round(airplayVol * 100) };
    apMuteTouched = false;
    if (body) airplayCall("/airplay/volume", body).catch(() => {});
  }, 120);
}
let apMuteTouched = false;

function apStartWatch() {
  apStopWatch();
  apFails = apDead = 0;
  apWatchTimer = setInterval(apWatch, 4000);
}
function apStopWatch() {
  clearInterval(apWatchTimer);
  apWatchTimer = null;
}

async function apWatch() {
  if (!airplay || apPolling) return;
  apPolling = true;
  const dev = airplay;
  let st;
  try {
    st = await airplayCall("/airplay/status");
    apFails = 0;
  } catch {
    apPolling = false;
    if (airplay === dev && ++apFails >= 3) {
      toast(`Lost contact with ${dev.name}`);
      selectLocal(true);
    }
    return;
  }
  apPolling = false;
  if (airplay !== dev) return;
  if (!st.connected) {
    toast(`Lost contact with ${dev.name}`);
    selectLocal(true);
    return;
  }
  if (typeof st.latency === "number") apLatency = st.latency;
  if (typeof st.error_seq === "number" && st.error_seq !== apErrSeq) {
    apErrSeq = st.error_seq;
    if (st.last_error) toast(apFriendly(st.code || st.error_code, st.last_error));
  }
  if (st.owner === false) {
    toast(`${dev.name} is playing something else`);
    audio.pause();
    selectLocal(true);
    return;
  }
  const dur = audio.duration;
  const nearEnd = isFinite(dur) && dur - audio.currentTime < 3;
  const grace = apBusy || Date.now() - apLastPlay < 6000 || nearEnd || st.state === "loading";
  if (!audio.paused && st.state !== "playing" && st.state !== "loading" && !grace) {
    if (++apDead >= 2) {
      toast(`No sound from ${dev.name} — playing on this computer instead`);
      selectLocal(true);
    }
  } else apDead = 0;
}

async function selectDevice(dev) {
  toast(`Connecting to ${dev.name}…`);
  try {
    const st = await airplayCall("/airplay/connect", { id: dev.id });
    airplay = { id: dev.id, name: st.device?.name || dev.name, kind: st.kind || dev.kind || "airplay" };
    applyApStatus(st);
    apLastPlay = 0;
    updateAirplayUI();
    renderPrefs();
    apStartWatch();
    toast(`Playing on ${airplay.name}`);
    if (current && !audio.paused) apSync();
  } catch (e) {
    toast(e.code ? `Couldn't connect: ${apFriendly(e.code, e.message)}` : `Couldn't connect: ${e.message}`);
  }
}

async function selectLocal(silent) {
  if (!airplay) return;
  airplay = null;
  apStopWatch();
  clearTimeout(apVolTimer);
  apDirty = false;
  try {
    await airplayCall("/airplay/disconnect", {});
  } catch {}
  updateAirplayUI();
  renderPrefs();
  if (!silent) toast("Playing on this computer");
}

// A backend that outlives the page may still be connected / streaming
async function restoreAirplay() {
  try {
    const st = await airplayCall("/airplay/status");
    if (st.hosted) return initNativeCast();
    if (!st.connected || !st.device) return;
    airplay = { id: st.device.id, name: st.device.name, kind: st.kind || st.device.kind || "airplay" };
    applyApStatus(st);
    updateAirplayUI();
    renderPrefs();
    apStartWatch();
    airplayCall("/airplay/stop", {}).catch(() => {});
  } catch {}
}

// A hosted server can't see anyone's speakers, so each device casts from its own browser:
// Safari's AirPlay picker, or Chrome's Cast picker (Remote Playback API). The speaker
// then fetches /audio itself, and the <audio> element's position keeps tracking it.
let nativeCast = false;
let nativeCastOn = false;
const castApi = () => (audio.webkitShowPlaybackTargetPicker ? "webkit" : audio.remote?.prompt ? "remote" : null);

function setNativeCastOn(on) {
  nativeCastOn = on;
  $("btn-airplay")?.classList.toggle("active", on);
  $("np-airplay")?.classList.toggle("active", on);
}

function initNativeCast() {
  nativeCast = true;
  const api = castApi();
  const b = $("btn-airplay");
  if (b) b.title = api === "webkit" ? "AirPlay" : api === "remote" ? "Cast to a device" : "Casting isn't supported in this browser";
  audio.setAttribute("x-webkit-airplay", "allow");
  audio.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", () => setNativeCastOn(!!audio.webkitCurrentPlaybackTargetIsWireless));
  if (audio.remote) {
    audio.disableRemotePlayback = false;
    audio.remote.addEventListener("connect", () => setNativeCastOn(true));
    audio.remote.addEventListener("disconnect", () => setNativeCastOn(false));
  }
}

async function nativeCastPick() {
  const api = castApi();
  if (!api) return toast("Casting needs Safari (AirPlay) or Chrome (Cast)");
  if (!current) return toast("Play a song first, then choose a device");
  if (isOffline() || /^blob:/.test(audio.currentSrc)) return toast("Downloaded songs can't be cast, only streamed ones");
  try {
    if (api === "webkit") audio.webkitShowPlaybackTargetPicker();
    else await audio.remote.prompt();
  } catch (e) {
    if (e.name === "NotFoundError") toast("No devices found on your network");
    else if (e.name !== "AbortError") toast("Couldn't open the device picker");
  }
}

async function airplayMenu(el) {
  if (nativeCast) return nativeCastPick();
  const r = anchorRect(el, "btn-airplay");
  const x = r.right - 250;
  const y = r.top - 4;
  const draw = (note) =>
    openMenu(
      x,
      y,
      [
        { label: "This computer", icon: airplay ? "music" : "check", fn: () => selectLocal() },
        ...apDevices.map((d) => ({ label: d.kind === "sonos" ? `${d.name} · Sonos` : d.name, icon: airplay?.id === d.id ? "check" : "airplay", fn: () => selectDevice(d) })),
        ...(note ? ["-", { label: note, dim: true, keepOpen: true, fn: () => {} }] : []),
      ],
      null,
      true,
    );
  draw("Searching for AirPlay devices…");
  try {
    const d = await airplayCall("/airplay/devices");
    apDevices = d.devices;
    if (!menu.hidden) draw(apDevices.length ? "" : "No AirPlay devices found");
  } catch (e) {
    if (!menu.hidden)
      draw(e.code === "pyatv_missing" || e.status === 501 ? "AirPlay needs pyatv: run the backend with .venv/bin/python (see airplay.py)" : `AirPlay unavailable: ${e.message}`);
  }
}

/* ── Adjustable side panels ───────────────────────────── */
const SB = { compact: 72, min: 220, max: 480, snap: 170, def: 300 };
const RP = { min: 280, max: 560, def: 340 };
const MIN_MAIN = 440; // the middle column never gets squeezed below this

// Widths are clamped here rather than when stored, so a smaller window
// never loses your preference
function panelWidths() {
  if (isPhone()) return { sb: SB.def, rp: RP.def };
  const total = $("app").getBoundingClientRect().width - 16;
  const open = !!sidePanel;
  let rp = clamp(prefs.rpWidth, RP.min, RP.max);
  let sb = prefs.sbWidth <= SB.compact ? SB.compact : clamp(prefs.sbWidth, SB.min, SB.max);
  if (sb > SB.compact) sb = Math.max(SB.min, Math.min(sb, total - (open ? rp + 8 : 0) - MIN_MAIN));
  if (open) rp = Math.max(RP.min, Math.min(rp, total - sb - 8 - MIN_MAIN));
  return { sb, rp };
}
function applyPanelWidths() {
  if (isPhone()) {
    const a = $("app");
    a.style.removeProperty("--sb-w");
    a.style.removeProperty("--rp-w");
    a.classList.remove("sb-compact");
    return;
  }
  const { sb, rp } = panelWidths();
  const app = $("app");
  app.style.setProperty("--sb-w", sb + "px");
  app.style.setProperty("--rp-w", rp + "px");
  app.classList.toggle("sb-compact", sb <= SB.compact);
  $("rs-left").setAttribute("aria-valuenow", Math.round(sb));
  $("rs-right").setAttribute("aria-valuenow", Math.round(rp));
}
function setupResizers() {
  applyPanelWidths();
  window.addEventListener("resize", applyPanelWidths);
  for (const handle of [$("rs-left"), $("rs-right")]) {
    const left = handle.dataset.side === "left";
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      document.body.classList.add("is-resizing");
      const box = $("app").getBoundingClientRect();
      const move = (ev) => {
        if (left) {
          const raw = ev.clientX - box.left - 4; // pointer sits in the middle of the 8px gap
          prefs.sbWidth = raw < SB.snap ? SB.compact : clamp(raw, SB.min, SB.max);
        } else {
          prefs.rpWidth = clamp(box.right - ev.clientX - 4, RP.min, RP.max);
        }
        applyPanelWidths();
      };
      // window-level listeners: the pointer routinely leaves the 8px handle mid-drag
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        document.body.classList.remove("is-resizing");
        savePrefs();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });
    handle.addEventListener("dblclick", () => {
      if (left) prefs.sbWidth = prefs.sbWidth <= SB.compact ? SB.def : prefs.sbWidth === SB.def ? SB.compact : SB.def;
      else prefs.rpWidth = RP.def;
      applyPanelWidths();
      savePrefs();
    });
    handle.addEventListener("keydown", (e) => {
      const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      const step = e.shiftKey ? 48 : 16;
      if (left) {
        const w = dir * step + panelWidths().sb;
        prefs.sbWidth = w < SB.snap ? SB.compact : clamp(w, SB.min, SB.max);
      } else prefs.rpWidth = clamp(panelWidths().rp - dir * step, RP.min, RP.max);
      applyPanelWidths();
      savePrefs();
    });
  }
}

/* ── Drag to reorder (queue + custom playlists) ───────── */
// Pointer-based so it can show a lifted row, a drop line and autoscroll. A small
// movement threshold keeps ordinary clicks and double-clicks working.
let drag = null;
let suppressClick = false;

function setupSortable() {
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch" || e.target.closest("button, input")) return;
    const item = e.target.closest("[data-sortable] > *");
    if (!item) return;
    const box = item.parentElement;
    drag = { item, box, kind: box.dataset.sortable, x: e.clientX, y: e.clientY, py: e.clientY, active: false, from: [...box.children].indexOf(item), to: -1 };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      startDrag(e);
    }
    drag.py = e.clientY;
    drag.ghost.style.top = e.clientY - drag.offY + "px";
    updateDropSlot();
  });
  // links and thumbnails would otherwise start the browser's own drag and swallow the pointer
  document.addEventListener("dragstart", (e) => {
    if (e.target.closest?.("[data-sortable]")) e.preventDefault();
  });
  document.addEventListener("pointerup", () => endDrag(true));
  document.addEventListener("pointercancel", () => endDrag(false));
  window.addEventListener("blur", () => endDrag(false));
  // a drag must not also count as a click on the row underneath
  document.addEventListener("click", (e) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

function startDrag(e) {
  const r = drag.item.getBoundingClientRect();
  drag.active = true;
  drag.offY = e.clientY - r.top;
  drag.scroller = drag.kind === "queue" ? $("queue-panel") : $("main");
  const ghost = drag.item.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.removeAttribute("data-act");
  ghost.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.item.classList.add("drag-src");
  document.body.classList.add("is-dragging");
  closeMenu();
  const tick = () => {
    if (!drag?.active) return;
    const b = drag.scroller.getBoundingClientRect();
    const top = b.top + (drag.kind === "queue" ? 0 : 64); // the sticky top bar covers the first 64px
    const bottom = b.bottom;
    let v = 0;
    if (drag.py < top + 56) v = -(top + 56 - drag.py) / 3;
    else if (drag.py > bottom - 56) v = (drag.py - (bottom - 56)) / 3;
    if (v) {
      drag.scroller.scrollTop += clamp(v, -26, 26);
      updateDropSlot();
    }
    drag.raf = requestAnimationFrame(tick);
  };
  drag.raf = requestAnimationFrame(tick);
}

// Where the dragged row would land, shown as a green line on the neighbouring row
function updateDropSlot() {
  const kids = [...drag.box.children];
  let slot = kids.length;
  for (let i = 0; i < kids.length; i++) {
    if (kids[i] === drag.item) continue;
    const r = kids[i].getBoundingClientRect();
    if (drag.py < r.top + r.height / 2) {
      slot = i;
      break;
    }
  }
  drag.to = slot > drag.from ? slot - 1 : slot;
  kids.forEach((k) => k.classList.remove("drop-before", "drop-after"));
  if (drag.to === drag.from) return;
  if (slot < kids.length) kids[slot].classList.add("drop-before");
  else kids[kids.length - 1].classList.add("drop-after");
}

function endDrag(commit) {
  const d = drag;
  drag = null;
  if (!d?.active) return;
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  d.item.classList.remove("drag-src");
  [...d.box.children].forEach((k) => k.classList.remove("drop-before", "drop-after"));
  document.body.classList.remove("is-dragging");
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 0);
  if (!commit || d.to === d.from || d.to < 0) return;
  if (d.kind === "playlist") reorderPlaylist(d.box.dataset.pl, d.from, d.to);
  else reorderQueue(+d.box.dataset.base, d.from, d.to);
}

function reorderPlaylist(id, from, to) {
  const pl = getPl(id);
  if (!pl) return;
  pl.tracks.splice(to, 0, pl.tracks.splice(from, 1)[0]);
  savePlaylists();
  const top = $("main").scrollTop;
  renderPlaylist(id);
  $("main").scrollTop = top;
  renderLibrary();
}

function reorderQueue(base, from, to) {
  queue.splice(base + to, 0, queue.splice(base + from, 1)[0]);
  history = [];
  const top = $("queue-panel").scrollTop;
  renderQueue();
  $("queue-panel").scrollTop = top;
}

/* ── Playlists ─────────────────────────────────────────── */
function modal(html) {
  $("modal-box").innerHTML = html;
  $("modal").hidden = false;
  setTimeout(() => $("modal-box").querySelector("input")?.focus(), 30);
}
function closeModal() {
  $("modal").hidden = true;
  editCtx = null;
}
$("modal").addEventListener("mousedown", (e) => {
  if (e.target === $("modal")) closeModal();
});

function promptName({ title, value = "", cta, onOk }) {
  modal(`<h3>${esc(title)}</h3><input id="name-in" maxlength="60" value="${esc(value)}" placeholder="My playlist #${playlists.length}">
    <div class="btns"><button class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn primary" data-act="modal-ok">${esc(cta)}</button></div>`);
  const inp = $("name-in");
  inp.select();
  inp.onkeydown = (e) => e.key === "Enter" && submit();
  const submit = () => {
    const v = inp.value.trim() || value || `My playlist #${playlists.length}`;
    closeModal();
    onOk(v);
  };
  window._modalOk = submit;
}

/* ── Custom playlist covers ────────────────────────────── */
const COVER_PX = 512;
const COVER_MAX_BYTES = 25 * 1024 * 1024;
const COVER_BG = "#121212"; // --panel
let coverBusy = false;
let editCtx = null; // set while the Edit playlist modal is open (picks are staged there instead of committed)
let coverCb = null; // what to do with the next picked file

const coverEditButton = (inner, cls = "") =>
  `<button class="cover-edit ${cls}" data-act="pick-cover" aria-label="Change playlist photo">${inner}<span class="ov">${icon("edit", 28)}<span>Choose photo</span></span><span class="badge">${icon("edit", 16)}</span></button>`;

// mutate `covers`, persist, and roll the in-memory change back if the browser refuses the write
function commitCovers(mutate, quiet) {
  const before = { ...covers };
  mutate();
  if (!LS.setSafe("covers", covers)) {
    covers = before;
    if (!quiet) toast("Not enough storage for this picture. Remove another cover and retry");
    else LS.setSafe("covers", covers);
    refreshCovers();
    return false;
  }
  refreshCovers();
  return true;
}
const saveCovers = () => commitCovers(() => {});

function refreshCovers() {
  const top = $("main")?.scrollTop || 0;
  renderLibrary();
  if (view.name === "playlist" && getPl(view.data)) renderPlaylist(view.data);
  else if (view.name === "home") renderHome();
  if ($("main")) $("main").scrollTop = top;
}
window.addEventListener("storage", (e) => {
  if (e.key !== "streamify.covers") return;
  covers = loadCovers();
  refreshCovers();
});

async function processCoverFile(file) {
  if (!file) return null;
  if (file.size > COVER_MAX_BYTES) return void toast("Image is too large (max 25 MB)");
  const type = (file.type || "").toLowerCase();
  if (!type || /hei[cf]/.test(type) || /\.hei[cf]$/i.test(file.name || "")) return void toast("HEIC isn't supported by this browser. Export as JPEG or PNG.");
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const big = Math.max(bmp.width, bmp.height);
    if (big > 4096) {
      const k = 4096 / big;
      const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      bmp.close();
      bmp = await createImageBitmap(file, { imageOrientation: "from-image", resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    }
  } catch {
    bmp?.close?.();
    return void toast("That file isn't a valid image.");
  }
  try {
    if (bmp.width < 64 || bmp.height < 64) return void toast("Image is too small (min 64 px)");
    const cv = document.createElement("canvas");
    cv.width = cv.height = COVER_PX;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = COVER_BG;
    ctx.fillRect(0, 0, COVER_PX, COVER_PX);
    const s = Math.min(bmp.width, bmp.height);
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, COVER_PX, COVER_PX);
    const encode = (q) => new Promise((res) => cv.toBlob((b) => {
      if (!b) return res(null);
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    }, "image/jpeg", q));
    let url = await encode(0.82);
    if (url && url.length > 150000) url = (await encode(0.7)) || url;
    if (!isCoverURL(url)) return void toast("That file isn't a valid image.");
    return url;
  } catch {
    return void toast("That file isn't a valid image.");
  } finally {
    bmp.close?.();
  }
}

function getCoverInput() {
  let inp = $("cover-file");
  if (!inp) {
    inp = document.createElement("input");
    inp.type = "file";
    inp.id = "cover-file";
    inp.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
    inp.hidden = true;
    inp.tabIndex = -1;
    inp.addEventListener("change", () => {
      const f = inp.files?.[0];
      inp.value = "";
      if (f) handleCoverFile(f, coverCb);
    });
    document.body.appendChild(inp);
  }
  return inp;
}

// default target: replace the cover of the open playlist right away
function immediateCover(id) {
  return (url) => {
    if (!getPl(id)) return;
    if (commitCovers(() => (covers[id] = url))) toast("Cover updated");
  };
}
function coverTargetFor(el) {
  if (editCtx && el?.closest?.("#modal")) return editCtx.stage;
  if (view.name === "playlist" && view.data !== "liked" && getPl(view.data)) return immediateCover(view.data);
  return null;
}
function pickCover(el) {
  coverCb = coverTargetFor(el);
  if (coverCb) getCoverInput().click();
}
async function handleCoverFile(file, cb) {
  cb = cb || coverTargetFor(null);
  if (coverBusy || !cb) return;
  coverBusy = true;
  const spots = [...document.querySelectorAll(".cover-edit .cover")];
  spots.forEach((c) => c.classList.add("busy"));
  try {
    const url = await processCoverFile(file);
    if (url) cb(url);
  } finally {
    coverBusy = false;
    document.querySelectorAll(".cover-edit .cover.busy").forEach((c) => c.classList.remove("busy"));
  }
}

function editPlaylist(pl) {
  let pendingCover; // string = new cover, null = remove, undefined = unchanged
  const hasCover = () => (pendingCover === undefined ? !!covers[pl.id] : pendingCover !== null);
  modal(`<h3>Edit playlist</h3>
    <div class="edit-pl">
      <div id="ep-prev"></div>
      <div class="ep-side">
        <input id="name-in" maxlength="60" value="${esc(pl.name)}" placeholder="My playlist" aria-label="Playlist name">
        <div class="ep-links"><button class="btn ghost" data-act="pick-cover">Change photo</button><button class="btn ghost" id="ep-rm" data-act="remove-cover">Remove photo</button></div>
      </div>
    </div>
    <div class="btns"><button class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn primary" data-act="modal-ok">Save</button></div>`);
  const sync = () => {
    $("ep-prev").innerHTML = coverEditButton(coverHTML(pl, pendingCover), "prev");
    const rm = $("ep-rm");
    if (rm) rm.hidden = !hasCover();
  };
  sync();
  editCtx = {
    stage: (url) => { pendingCover = url; sync(); },
    remove: () => { pendingCover = null; sync(); },
  };
  const inp = $("name-in");
  inp?.select();
  if (inp) inp.onkeydown = (e) => e.key === "Enter" && submit();
  const submit = () => {
    const v = inp?.value.trim() || pl.name;
    closeModal();
    if (v !== pl.name) { pl.name = v; savePlaylists(); }
    if (pendingCover !== undefined) {
      const id = pl.id;
      commitCovers(() => (pendingCover === null ? delete covers[id] : (covers[id] = pendingCover)));
    } else refreshCovers();
  };
  window._modalOk = submit;
}

function createPlaylist(name, track) {
  const pl = { id: "pl_" + Date.now(), name, tracks: track ? [track] : [] };
  playlists.push(pl);
  savePlaylists();
  renderLibrary();
  toast(track ? `Added to ${name}` : `Created "${name}"`);
  if (!track) navigate("playlist", pl.id);
  return pl;
}

function addToPlaylist(plId, t) {
  const pl = getPl(plId);
  if (!pl) return;
  if (pl.tracks.some((x) => x.id === t.id)) return toast("Already in " + pl.name);
  pl.tracks.push(t);
  savePlaylists();
  renderLibrary();
  refreshMarks();
  toast(`Added to ${pl.name}`);
  dlAutoAdd("pl:" + pl.id, pl.tracks);
}

function toggleLike(t) {
  const pl = playlists[0];
  const i = pl.tracks.findIndex((x) => x.id === t.id);
  if (i >= 0) {
    pl.tracks.splice(i, 1);
    toast("Removed from Liked Songs");
  } else {
    pl.tracks.unshift(t);
    toast("Added to Liked Songs");
    dlAutoAdd("liked", pl.tracks);
  }
  savePlaylists();
  renderLibrary();
  if (view.name === "playlist" && view.data === "liked") renderPlaylist("liked");
  refreshMarks();
}

/* ── Context menu ──────────────────────────────────────── */
const menu = $("menu");
const scrim = $("menu-scrim");
function openMenu(x, y, items, anchorRow, up) {
  menu.innerHTML = "";
  items.forEach((it) => {
    if (it === "-") return menu.appendChild(document.createElement("hr"));
    const b = document.createElement("button");
    b.innerHTML = `${it.icon ? icon(it.icon, 18) : ""}<span class="${it.dim ? "dim" : ""}">${esc(it.label)}</span>`;
    if (it.disabled) {
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
      b.classList.add("off-disabled");
    }
    if (it.active) {
      b.classList.add("on");
      b.insertAdjacentHTML("beforeend", `<span class="chk">${icon("check", 18)}</span>`);
    }
    b.onclick = (e) => {
      e.stopPropagation();
      if (it.keepOpen) return it.fn(x, y);
      closeMenu();
      it.fn();
    };
    menu.appendChild(b);
  });
  menu.hidden = false;
  if (isPhone()) {
    // bottom sheet: CSS positions it; the scrim catches outside taps
    if (scrim) scrim.hidden = false;
  } else {
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 8, innerWidth - r.width - 8) + "px";
    menu.style.top = clamp(up ? y - r.height : y, 8, innerHeight - r.height - 8) + "px";
  }
  document.querySelectorAll(".row.menu-open").forEach((r) => r.classList.remove("menu-open"));
  anchorRow?.classList.add("menu-open");
}
function closeMenu() {
  menu.hidden = true;
  if (scrim) scrim.hidden = true;
  document.querySelectorAll(".row.menu-open").forEach((r) => r.classList.remove("menu-open"));
}

function trackMenu(t, x, y, row) {
  const plId = row?.dataset.pl;
  const items = [
    { label: "Play next", icon: "skip", fn: () => playNext(t) },
    { label: "Add to queue", icon: "queue", fn: () => addToQueue(t) },
    "-",
    { label: "Add to playlist", icon: "plus", keepOpen: true, fn: () => playlistPicker(t, x, y, row) },
    { label: isLiked(t.id) ? "Remove from Liked Songs" : "Save to Liked Songs", icon: isLiked(t.id) ? "heart-fill" : "heart", fn: () => toggleLike(t) },
  ];
  const dlItem = dlMenuItem(t);
  if (dlItem) items.push(dlItem);
  const box = row?.closest('[data-sortable="playlist"]');
  if (box && plId && plId !== "liked") {
    const from = [...box.children].indexOf(row);
    const n = box.children.length;
    if (from > 0) items.push({ label: "Move up", icon: "chevron-up", fn: () => reorderPlaylist(plId, from, from - 1) });
    if (from >= 0 && from < n - 1) items.push({ label: "Move down", icon: "chevron-down", fn: () => reorderPlaylist(plId, from, from + 1) });
  }
  if (plId && plId !== "liked")
    items.push({
      label: "Remove from this playlist", icon: "trash",
      fn: () => {
        const pl = getPl(plId);
        pl.tracks = pl.tracks.filter((x) => x.id !== t.id);
        savePlaylists();
        renderPlaylist(plId);
        renderLibrary();
      },
    });
  items.push("-", { label: "Go to artist", icon: "user", fn: () => navigate("artist", { id: t.artistId, name: t.artist, thumb: artistThumb(t.artistId) }) });
  if (t.albumId) items.push({ label: "Go to album", icon: "music", fn: () => navigate("album", t.albumId) });
  items.push({ label: "Open on YouTube", icon: "external", fn: () => window.open(`https://www.youtube.com/watch?v=${t.id}`, "_blank", "noopener") });
  openMenu(x, y, items, row);
}

function queueMenu(item, x, y) {
  const box = item.closest('[data-sortable="queue"]');
  if (!box) return;
  const base = +box.dataset.base;
  const from = [...box.children].indexOf(item);
  const n = box.children.length;
  const items = [];
  if (from > 0) items.push({ label: "Move up", icon: "chevron-up", fn: () => reorderQueue(base, from, from - 1) });
  if (from < n - 1) items.push({ label: "Move down", icon: "chevron-down", fn: () => reorderQueue(base, from, from + 1) });
  items.push({ label: "Remove from queue", icon: "trash", fn: () => { queue.splice(base + from, 1); renderQueue(); } });
  const dlItem = queue[base + from] && dlMenuItem(queue[base + from]);
  if (dlItem) items.push("-", dlItem);
  openMenu(x, y, items, null);
}

function playlistPicker(t, x, y, row) {
  openMenu(
    x, y,
    [
      { label: "New playlist", icon: "plus", fn: () => promptName({ title: "Create playlist", cta: "Create", onOk: (n) => createPlaylist(n, t) }) },
      "-",
      ...playlists.filter((p) => p.id !== "liked").map((p) => ({ label: p.name, icon: "music", fn: () => addToPlaylist(p.id, t) })),
    ],
    row,
  );
}

document.addEventListener("mousedown", (e) => {
  // the scrim closes on click (so the tap can't fall through to the row underneath)
  if (!menu.hidden && !menu.contains(e.target) && e.target !== scrim) closeMenu();
});
scrim?.addEventListener("click", (e) => {
  e.stopPropagation();
  e.preventDefault();
  // ignore the tail of the gesture that opened the menu (long-press release; lpAt is declared with the long-press code below)
  if (Date.now() - lpAt > 800) closeMenu();
});
$("main").addEventListener("scroll", closeMenu);

/* ── Event delegation ──────────────────────────────────── */
function rowTrack(row) {
  return trackIndex[row.dataset.id] || lists[row.dataset.list]?.[+row.dataset.idx];
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) {
    const row = e.target.closest(".row");
    if (row && isTouchUI()) {
      if (Date.now() - lpAt < 800 || e.target.closest("button, a, input") || !row.dataset.list) return;
      if (view.name === "search" && view.data?.q) recordSearch(view.data.q);
      playList(lists[row.dataset.list], +row.dataset.idx);
      return;
    }
    if (row) {
      document.querySelectorAll(".row.selected").forEach((r) => r.classList.remove("selected"));
      row.classList.add("selected");
    }
    return;
  }
  e.stopPropagation();
  const d = el.dataset;
  const row = el.closest(".row");
  if (view.name === "search" && view.data?.q && /^(play-row|artist|album|play-list|play-album|like|search-tab)$/.test(d.act)) recordSearch(view.data.q);
  switch (d.act) {
    case "nav":
      if (d.view === "search") { navigate("search", { q: $("q").value.trim() }, view.name !== "search"); $("q").focus(); }
      else navigate(d.view);
      break;
    case "install": installApp(); break;
    case "ios-hint-dismiss": prefs.iosHintDismissed = true; savePrefs(); if (view.name === "library") renderLibraryView(); break;
    case "update-reload": applyUpdate(); break;
    case "update-dismiss": $("update-bar")?.remove(); break;
    case "back": go(-1); break;
    case "forward": go(1); break;
    case "clear-search":
      $("q").value = ""; syncSearchBox(); $("q").focus();
      if (view.name === "search") navigate("search", { q: "" }, false);
      break;
    case "open-pl": navigate("playlist", d.id); break;
    case "new-pl": promptName({ title: "Create playlist", cta: "Create", onOk: (n) => createPlaylist(n) }); break;
    case "edit-pl": {
      const pl = getPl(view.data);
      if (pl && pl.id !== "liked") editPlaylist(pl);
      break;
    }
    case "pick-cover": pickCover(el); break;
    case "remove-cover": editCtx?.remove(); break;
    case "del-pl": {
      const pl = getPl(view.data);
      modal(`<h3>Delete "${esc(pl.name)}"?</h3><div style="color:var(--sub)">This can't be undone.</div>
        <div class="btns"><button class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn danger" data-act="modal-del">Delete</button></div>`);
      break;
    }
    case "modal-del":
      playlists = playlists.filter((p) => p.id !== view.data);
      if (covers[view.data]) { delete covers[view.data]; LS.setSafe("covers", covers); }
      savePlaylists(); closeModal(); navigate("home"); toast("Playlist deleted");
      break;
    case "modal-ok": window._modalOk?.(); break;
    case "modal-cancel": closeModal(); break;
    case "mood": runSearchFor(d.q); break;
    case "run-history": runSearchFor(d.q); break;
    case "remove-history": {
      const ql = (d.q || "").toLowerCase();
      searchHistory = searchHistory.filter((x) => x.toLowerCase() !== ql);
      saveSearchHistory();
      renderSearch(view.data);
      break;
    }
    case "clear-history":
      searchHistory = [];
      saveSearchHistory();
      renderSearch(view.data);
      break;
    case "artist":
      if (d.id) {
        if (d.thumb) artistThumbs[d.id] = d.thumb;
        navigate("artist", { id: d.id, name: d.name, thumb: d.thumb || artistThumb(d.id) });
      }
      break;
    case "album":
      if (d.id) navigate("album", d.id);
      break;
    case "search-tab":
      searchTab = d.tab;
      paintSearch();
      break;
    case "play-row": playList(lists[row.dataset.list], +row.dataset.idx); break;
    case "play-list": {
      const tracks = lists[d.list];
      if (d.start) playList(tracks, 0, true);
      else playList(tracks, +d.idx);
      break;
    }
    case "play-album": playAlbum(d.id); break;
    case "play-one": {
      const t = trackIndex[d.id] || recent.find((r) => r.id === d.id);
      if (t) playList([t], 0);
      break;
    }
    case "like": toggleLike(rowTrack(row)); break;
    case "like-current": if (current) toggleLike(current); break;
    case "more": {
      const r = el.getBoundingClientRect();
      trackMenu(rowTrack(row), r.left - 200, r.bottom + 4, row);
      break;
    }
    case "toggle": togglePlay(); break;
    case "next": nextTrack(); break;
    case "prev": prevTrack(); break;
    case "shuffle":
      prefs.shuffle = !prefs.shuffle;
      history = [];
      shufflePlayed.clear();
      if (current) shufflePlayed.add(current.id);
      savePrefs();
      renderPrefs();
      break;
    case "repeat": prefs.repeat = (prefs.repeat + 1) % 3; savePrefs(); renderPrefs(); break;
    case "mute":
      if (airplay) {
        airplayMuted = !airplayMuted;
        apMuteTouched = true;
        sendAirplayVolume();
      } else {
        prefs.muted = !prefs.muted;
        audio.muted = prefs.muted;
        savePrefs();
      }
      renderPrefs();
      break;
    case "airplay": airplayMenu(el); break;
    case "toggle-queue": toggleQueue(); break;
    case "toggle-lyrics": toggleLyrics(); break;
    case "lyrics-full": toggleLyricsFull(); break;
    case "browser-fullscreen": toggleBrowserFullscreen(); break;
    case "mix": navigate("mix", d.id); break;
    case "save-mix": {
      const m = mixes.find((x) => x.id === d.id);
      const pl = { id: "pl_" + Date.now(), name: `${m.name} · ${dayKey()}`, tracks: [...m.tracks] };
      playlists.push(pl);
      savePlaylists();
      renderLibrary();
      toast(`Saved as "${pl.name}"`);
      break;
    }
    case "save-album": toggleAlbum(); break;
    case "follow-artist": toggleArtist(); break;
    case "disc-filter": discFilter(d.f); break;
    case "lib-filter": libFilter = libFilter === d.f ? null : d.f; renderLibrary(); break;
    case "sleep": sleepMenu(el); break;
    case "np-open": openNP(); break;
    case "np-close": closeNP(); break;
    case "np-menu": {
      if (!current) break;
      const r = el.getBoundingClientRect();
      trackMenu(current, r.left - 200, r.bottom + 4);
      break;
    }
    case "panel-close": if (sidePanel) openPanel(sidePanel); break;
    case "ly-seek": if (lyr.lines[+d.i]) audio.currentTime = lyr.lines[+d.i].t; break;
    case "queue-play":
      if (queue[+d.idx] && !dlPlayable(queue[+d.idx])) { toast("This song isn’t downloaded"); break; }
      qIndex = +d.idx; history = []; playTrack(queue[qIndex]); renderQueue(); break;
    case "open-settings": navigate("settings"); break;
    case "open-downloads": navigate("downloads"); break;
    case "dl": dlTrackAction(d.id, row || el.closest(".q-item")); break;
    case "dl-set": dlSetToggle(el); break;
    case "dl-confirm": {
      closeModal();
      const run = window._dlConfirm;
      window._dlConfirm = null;
      if (run) run();
      break;
    }
    case "dl-shuffle":
      if (!prefs.shuffle) { prefs.shuffle = true; history = []; shufflePlayed.clear(); savePrefs(); renderPrefs(); }
      playList(lists.downloads, 0, true);
      break;
    case "dl-cancel": if (dlOn() && d.id) Offline.cancel(d.id); break;
    case "dl-remove-all":
      if (!dlOn()) break;
      modal(`<h3>Remove all downloads?</h3><div style="color:var(--sub)">Songs will need a connection again. Your playlists and likes stay.</div>
        <div class="btns"><button class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn danger" data-act="dl-remove-all-ok">Remove all</button></div>`);
      break;
    case "dl-remove-all-ok":
      closeModal();
      Promise.resolve(Offline.removeAll()).then(() => toast("All downloads removed"), () => toast("Couldn’t remove downloads"));
      break;
    case "queue-more": {
      const r = el.getBoundingClientRect();
      queueMenu(el.closest(".q-item"), r.left - 160, r.bottom + 4);
      break;
    }
    case "queue-remove": queue.splice(+d.idx, 1); renderQueue(); break;
    case "queue-clear": queue = queue.slice(0, qIndex + 1); renderQueue(); break;
  }
});

document.addEventListener("dblclick", (e) => {
  if (isTouchUI()) return; // touch plays on a single tap
  const row = e.target.closest(".row");
  if (row && !e.target.closest("button, a") && row.dataset.list) playList(lists[row.dataset.list], +row.dataset.idx);
});

// iOS never fires contextmenu on long-press, so a timer opens the track menu there
let lpTimer = 0, lpAt = 0, lpX = 0, lpY = 0;
const lpCancel = () => { clearTimeout(lpTimer); lpTimer = 0; };
document.addEventListener("touchstart", (e) => {
  lpCancel();
  const row = e.target.closest?.(".row");
  if (!row || !row.dataset.id || e.touches.length !== 1 || e.target.closest("input")) return;
  lpX = e.touches[0].clientX;
  lpY = e.touches[0].clientY;
  lpTimer = setTimeout(() => {
    lpTimer = 0;
    lpAt = Date.now();
    trackMenu(rowTrack(row), lpX, lpY, row);
  }, 450);
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  const t = e.touches[0];
  if (lpTimer && t && Math.hypot(t.clientX - lpX, t.clientY - lpY) > 8) lpCancel();
}, { passive: true });
document.addEventListener("touchend", (e) => {
  lpCancel();
  if (Date.now() - lpAt < 800 && e.cancelable) e.preventDefault(); // no synthesized click after a long-press
});
document.addEventListener("touchcancel", lpCancel);
window.addEventListener("scroll", lpCancel, true);

document.addEventListener("contextmenu", (e) => {
  const row = e.target.closest(".row");
  if (!row || !row.dataset.id) return;
  e.preventDefault();
  if (Date.now() - lpAt < 1500) return; // long-press timer already opened the menu
  lpAt = Date.now();
  lpCancel();
  trackMenu(rowTrack(row), e.clientX, e.clientY, row);
});

/* ── Drop an image file onto a cover ───────────────────── */
{
  const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const zone = (e) => (isFiles(e) ? e.target.closest?.(".cover-edit") : null);
  const over = (e) => {
    const z = zone(e);
    if (!z) return;
    e.preventDefault();
    z.classList.add("drag");
  };
  document.addEventListener("dragenter", over);
  document.addEventListener("dragover", over);
  document.addEventListener("dragleave", (e) => {
    const z = e.target.closest?.(".cover-edit");
    if (z && !z.contains(e.relatedTarget)) z.classList.remove("drag");
  });
  document.addEventListener("drop", (e) => {
    const z = zone(e);
    if (!z) return;
    e.preventDefault();
    z.classList.remove("drag");
    const f = e.dataTransfer.files[0];
    if (f) handleCoverFile(f, coverTargetFor(z));
  });
}

/* ── Keyboard shortcuts ────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drag?.active) {
    endDrag(false);
    return;
  }
  if (e.key === "Escape") {
    const overlayOnly = menu.hidden && $("modal").hidden;
    closeMenu();
    closeModal();
    if (overlayOnly && lyricsFull) toggleLyricsFull(false);
    else if (overlayOnly && !$("np").hidden && !(isPhone() && sidePanel)) closeNP();
    return;
  }
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); $("q").focus(); }
  else if (e.code === "Space") {
    // a focused button / switch / link handles Space itself (otherwise it would also toggle playback)
    if (e.target.closest?.('button, a[href], select, summary, [role="switch"], [role="button"]')) return;
    e.preventDefault();
    togglePlay();
  }
  else if (e.code === "ArrowRight") e.shiftKey ? nextTrack() : (audio.currentTime += 5);
  else if (e.code === "ArrowLeft") e.shiftKey ? prevTrack() : (audio.currentTime -= 5);
  else if (e.code === "KeyM") $("btn-mute").click();
  else if (e.code === "KeyS") $("btn-shuffle").click();
  else if (e.code === "KeyR") $("btn-repeat").click();
  else if (e.code === "KeyQ") toggleQueue();
  else if (e.code === "KeyL") toggleLyrics();
  else if (e.code === "KeyF") toggleLyricsFull();
});

/* Warm the backend cache for whatever the pointer rests on */
let hoverTimer;
document.addEventListener("mouseover", (e) => {
  clearTimeout(hoverTimer);
  const el = e.target.closest(".row, [data-act='play-list'], [data-act='play-one']");
  if (!el) return;
  hoverTimer = setTimeout(() => {
    let t;
    if (el.classList.contains("row")) t = rowTrack(el);
    else if (el.dataset.act === "play-one") t = trackIndex[el.dataset.id] || recent.find((r) => r.id === el.dataset.id);
    else if (!el.dataset.start) t = lists[el.dataset.list]?.[+el.dataset.idx];
    prefetchTrack(t);
  }, 300);
});

/* ── PWA ───────────────────────────────────────────────── */
let deferredPrompt = null;
let swReg = null;
let reloadingForUpdate = false;
let lastUpdateCheck = Date.now();
const standaloneMQ = matchMedia("(display-mode: standalone)");
const isStandalone = () => standaloneMQ.matches || navigator.standalone === true;
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const showIosHint = () => isIOS() && !isStandalone() && !prefs.iosHintDismissed;
const canInstall = () => !!deferredPrompt && !isStandalone();

function installRowHTML() {
  return canInstall() ? `<button class="lib-new lib-install" data-act="install">${icon("download", 20)}<span>Install app</span></button>` : "";
}
function iosHintHTML() {
  return showIosHint()
    ? `<div class="ios-hint"><span>Install: tap Share, then Add to Home Screen</span><button class="icon-btn" data-act="ios-hint-dismiss" title="Dismiss">${icon("close", 18)}</button></div>`
    : "";
}
function syncInstallUI() {
  const b = $("btn-install");
  if (b) b.hidden = !canInstall();
  if (view.name === "library") renderLibraryView();
}
async function installApp() {
  const p = deferredPrompt;
  if (!p) return;
  try {
    p.prompt();
    const choice = await p.userChoice;
    if (choice?.outcome === "accepted") toast("Installing\u2026");
  } catch {}
  deferredPrompt = null;
  syncInstallUI();
}
function applyUpdate() {
  const w = swReg?.waiting;
  $("update-bar")?.remove();
  if (w) w.postMessage({ type: "SKIP_WAITING" });
  else if (!reloadingForUpdate) location.reload();
}
function showUpdateBar() {
  if ($("update-bar")) return;
  const bar = document.createElement("div");
  bar.id = "update-bar";
  bar.setAttribute("role", "status");
  const span = document.createElement("span");
  span.textContent = "A new version is available \u2014";
  const go = document.createElement("button");
  go.className = "btn primary";
  go.dataset.act = "update-reload";
  go.textContent = "Reload";
  const x = document.createElement("button");
  x.className = "icon-btn";
  x.dataset.act = "update-dismiss";
  x.title = "Dismiss";
  x.innerHTML = icon("close", 18);
  bar.append(span, go, x);
  document.body.appendChild(bar);
}
function watchRegistration(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar();
  reg.addEventListener("updatefound", () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener("statechange", () => {
      if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateBar();
    });
  });
}
function setupPwa() {
  try {
    standaloneMQ.addEventListener("change", syncInstallUI);
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      syncInstallUI();
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      syncInstallUI();
      toast("Streamify installed");
    });
    if (!("serviceWorker" in navigator && window.isSecureContext && location.protocol.startsWith("http"))) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      location.reload();
    });
    const register = async () => {
      try {
        swReg = await navigator.serviceWorker.register("/sw.js");
        watchRegistration(swReg);
      } catch {}
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !swReg || Date.now() - lastUpdateCheck < 30 * 60 * 1000) return;
      lastUpdateCheck = Date.now();
      swReg.update().catch(() => {});
    });
  } catch {}
}
// Manifest shortcuts open /?view=search or /?view=library
function openStartView() {
  try {
    const params = new URLSearchParams(location.search);
    const v = params.get("view");
    if (v === null) return;
    if (v === "search") { navigate("search", { q: "" }); $("q").focus(); }
    else if (v === "library" && isPhone()) navigate("library");
    params.delete("view");
    const qs = params.toString();
    window.history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  } catch {}
}

/* ── Offline downloads ─────────────────────────────────── */
// The data layer is offline.js (window.Offline). Everything here is a no-op when
// it is missing or unsupported, so the app then behaves exactly as before.
class OfflineError extends Error {
  constructor(msg = "You’re offline") {
    super(msg);
    this.name = "OfflineError";
  }
}
function dlOn() {
  return !!(window.Offline && window.Offline.supported);
}
// offline = the user switched on offline mode, or the backend can't be reached
function isOffline() {
  return dlOn() && (!!prefs.offlineMode || backendOk === false);
}
let dlReady = false; // Offline.init() resolved: has()/state() are trustworthy from here on
let offWas = false;
let dlMetas = []; // Offline.list(), newest first
let dlObjURL = null; // object URL of the downloaded file currently in <audio>
let dlSkipRun = 0; // consecutive automatic skips (reset when something actually plays)
let dlPending = null;
let offProbeAt = 0;
const dlHas = (id) => dlReady && Offline.has(id);
const dlPlayable = (t) => !!t && (!isOffline() || dlHas(t.id));
const dlTrackFromMeta = (m) => ({ id: m.id, title: m.title, artist: m.artist, artistId: m.artistId, album: m.album, albumId: m.albumId, thumb: m.thumb, duration: m.duration });
const dlMixKey = (m) => `mix:${mixes.day || dayKey()}:${m.id}`;
function dlFmtBytes(b) {
  b = +b || 0;
  if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b >= 1e6) return Math.round(b / 1e6) + " MB";
  return Math.max(0, Math.round(b / 1e3)) + " KB";
}
function offProbeSoon() {
  if (Date.now() - offProbeAt < 3000) return;
  offProbeAt = Date.now();
  checkBackend();
}

function dlBoot() {
  if (!dlOn()) return;
  try {
    Offline.on("change", (e) => dlQueueMarks(e?.id));
    Offline.on("list", () => dlRefreshList());
    Offline.on("quota", () => toast("Storage is full — free some space in Settings"));
  } catch {}
  Promise.resolve()
    .then(() => Offline.init())
    .then(() => {
      if (!dlOn()) return; // init found storage unusable (private mode, blocked): stay as without downloads
      dlReady = true;
      try { Offline.setConcurrency(prefs.dlConcurrency); } catch {}
      offWas = isOffline();
      try { offWas ? Offline.pause() : Offline.resume(); } catch {}
      refreshDlMarks();
      renderQueue();
      return dlRefreshList();
    })
    .catch((e) => console.warn("Streamify: downloads unavailable", e));
}

// settings.js changes prefs and then announces it
window.addEventListener("streamify:prefs", (e) => {
  const { key, value } = e.detail || {};
  if (!key) return;
  if (key in prefs && value !== undefined && prefs[key] !== value) {
    prefs[key] = value;
    savePrefs();
  }
  if (!dlOn()) return;
  if (key === "offlineMode") checkBackend(); // re-evaluates offline state (no probe while offline mode is on)
  else if (key === "dlConcurrency") { try { Offline.setConcurrency(+value || 2); } catch {} }
});

// called whenever the offline state may have changed
function dlSyncOffline() {
  if (!dlOn()) return;
  const off = isOffline();
  if (off === offWas) return;
  offWas = off;
  if (dlReady) { try { off ? Offline.pause() : Offline.resume(); } catch {} }
  refreshDlMarks();
  renderQueue();
  renderLibrary(true);
  dlRerender();
  if (view.name === "settings") window.stRefresh?.();
}
// re-render the views whose content depends on the connection, keeping the scroll position
function dlRerender() {
  const fn = { home: renderHome, search: renderSearch, album: renderAlbum, artist: renderArtist, downloads: renderDownloads, library: renderLibraryView }[view.name];
  if (!fn) return;
  const top = $("main").scrollTop;
  fn(view.data);
  $("main").scrollTop = top;
}

async function dlRefreshList() {
  if (!dlOn()) return;
  let list = [];
  try { list = (await Offline.list()) || []; } catch {}
  const had = dlMetas.length;
  dlMetas = list;
  lists.downloads = list.map(dlTrackFromMeta);
  lists.downloads.forEach((t) => { if (!trackIndex[t.id]) trackIndex[t.id] = t; });
  renderLibrary(true);
  if (view.name === "downloads") dlRerender();
  else if (view.name === "library") renderLibraryView();
  else if (view.name === "home" && (isOffline() || !had !== !list.length)) dlRerender();
  else if (view.name === "settings") window.stRefresh?.();
  refreshDlMarks();
}

/* per-track indicator (rows, queue items, track cards) */
function dlIndInner(id) {
  const st = (dlReady && Offline.state(id)) || { s: "none" };
  const s = dlHas(id) ? "done" : st.s || "none";
  const p = clamp(Math.round(+st.pct || 0), 0, 100);
  const ring = (cls, attrs) => `<span class="dl-ring ${cls}" ${attrs}><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="bg" cx="12" cy="12" r="9"/><circle class="fg" cx="12" cy="12" r="9" pathLength="100"/></svg></span>`;
  switch (s) {
    case "done": return { sig: "done", html: `<span class="dl-mark" role="img" aria-label="Downloaded" title="Downloaded">${icon("download-done", 14)}</span>` };
    case "queued":
    case "preparing": return { sig: s, html: ring("indet", `role="img" aria-label="Waiting to download" title="Waiting to download"`) };
    case "downloading": return { sig: "downloading", p, html: ring("", `role="progressbar" aria-label="Downloading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" style="--p:${p}"`) };
    case "failed": return { sig: "failed", html: `<button class="dl-fail" data-act="dl" data-id="${esc(id)}" title="${esc(st.err ? "Download failed: " + st.err + " — retry" : "Download failed — retry")}" aria-label="Download failed, retry">${icon("dl-warn", 16)}</button>` };
    default: return { sig: "none", html: "" };
  }
}
function dlIndHTML(id) {
  const r = dlIndInner(id);
  return `<span class="dl-ind" data-sig="${r.sig}">${r.html}</span>`;
}
function dlPaintInd(el, id) {
  const r = dlIndInner(id);
  if (el.dataset.sig === r.sig) {
    if (r.sig === "downloading") {
      const ring = el.querySelector(".dl-ring");
      ring?.style.setProperty("--p", r.p);
      ring?.setAttribute("aria-valuenow", r.p);
    }
    return;
  }
  el.dataset.sig = r.sig;
  el.innerHTML = r.html;
}
function dlQueueMarks(id) {
  if (!dlPending) {
    dlPending = new Set();
    requestAnimationFrame(() => {
      const p = dlPending;
      dlPending = null;
      refreshDlMarks(p.all ? undefined : [...p]);
    });
  }
  if (id == null) dlPending.all = true;
  else dlPending.add(String(id));
}
// in-place update of every download indicator, the offline dimming and the header toggles
function refreshDlMarks(ids) {
  if (!dlOn() || !dlReady) return;
  const want = ids ? new Set(ids.map(String)) : null;
  const off = isOffline();
  document.querySelectorAll(".row[data-id], .q-item[data-id], .card[data-tid]").forEach((el) => {
    const id = el.dataset.tid || el.dataset.id;
    if (want && !want.has(id)) return;
    const ind = el.querySelector(".dl-ind");
    if (ind) dlPaintInd(ind, id);
    if (el.classList.contains("card") || el.classList.contains("cur")) return;
    const un = off && !Offline.has(id);
    el.classList.toggle("unavail", un);
    if (un) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  });
  dlSyncToggles();
  if (!ids && off) dlLocalImgs();
}
// offline the remote thumbnails can't load; downloads carry their own cover
async function dlLocalImgs() {
  for (const el of document.querySelectorAll(".row[data-id], .q-item[data-id], .card[data-tid]")) {
    const id = el.dataset.tid || el.dataset.id;
    const img = el.querySelector("img");
    if (!img || img.dataset.local || !dlHas(id)) continue;
    if (dlMetas.find((m) => m.id === id)?.hasCover === false) continue;
    img.dataset.local = "1";
    let u = null;
    try { u = await Offline.coverURL(id); } catch {}
    if (u && img.isConnected) {
      delete img.dataset.fb;
      img.src = u;
    }
  }
}
async function dlLocalCovers() {
  const t = current;
  if (!t || !dlHas(t.id)) return;
  let u = null;
  try { u = await Offline.coverURL(t.id); } catch {}
  if (!u || current !== t) return;
  const pc = $("p-cover")?.querySelector("img");
  if (pc) pc.src = u;
  for (const id of ["mini-cover", "np-cover"]) {
    const img = $(id);
    if (img) img.src = u;
  }
}

/* collection toggle (album / playlist / Liked Songs / Daily Mix headers) */
function dlToggleHTML(key, listKey) {
  if (!dlOn()) return "";
  return `<button class="dl-toggle is-idle" data-act="dl-set" data-key="${esc(key)}" data-list="${esc(listKey)}" title="Download" aria-label="Download" aria-pressed="false"><span class="dl-t-ic">${icon("download", 20)}</span><span class="dl-t-txt" aria-live="polite"></span></button>`;
}
function dlSetState(b) {
  const tracks = lists[b.dataset.list] || [];
  const key = b.dataset.key;
  let pr = null;
  try { pr = Offline.setProgress(tracks); } catch {}
  pr = pr || { done: 0, total: tracks.length, active: 0 };
  const set = !!Offline.isSet(key);
  const all = pr.total > 0 && pr.done >= pr.total;
  // the toggle mirrors the collection's own switch; songs downloaded one by one don't turn it on
  return { tracks, key, pr, set, all, state: !set ? "idle" : all ? "done" : pr.active > 0 ? "active" : "partial" };
}
function dlSyncToggles() {
  document.querySelectorAll(".dl-toggle[data-key]").forEach((b) => {
    const { pr, state } = dlSetState(b);
    const sig = `${state}:${pr.done}/${pr.total}:${isOffline()}`;
    if (b.dataset.sig === sig) return;
    b.dataset.sig = sig;
    b.className = `dl-toggle is-${state}`;
    const on = state !== "idle";
    const label = on ? "Remove download" : "Download";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-pressed", String(on));
    const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
    const ic = b.querySelector(".dl-t-ic");
    const txt = b.querySelector(".dl-t-txt");
    if (state === "done") ic.innerHTML = icon("download-done", 20);
    else if (state === "active") ic.innerHTML = `<span class="dl-ring big" style="--p:${pct}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="bg" cx="12" cy="12" r="10"/><circle class="fg" cx="12" cy="12" r="10" pathLength="100"/></svg></span>`;
    else ic.innerHTML = icon("download", 20);
    txt.textContent =
      state === "active" ? `Downloading ${pr.done}/${pr.total}`
      : state === "partial" ? `${pr.done}/${pr.total} downloaded${isOffline() ? " · waiting for a connection" : ""}`
      : "";
  });
}
function dlSetToggle(b) {
  if (!dlOn() || !dlReady) return;
  const { tracks, key, set } = dlSetState(b);
  if (!tracks.length) return;
  if (set) {
    const n = tracks.filter((t) => Offline.has(t.id)).length;
    if (n) return dlConfirmOff(b, key, tracks, n);
    Offline.setSet(key, false, tracks);
    toast("Removed download");
  } else {
    Offline.setSet(key, true, tracks);
    if (isOffline()) toast("Downloads will start when you’re back online");
    else dlFirstNotice();
  }
  b.dataset.sig = "";
  dlSyncToggles();
}
// switching a collection off deletes its downloaded songs (including ones downloaded one by one), so confirm
function dlConfirmOff(b, key, tracks, n) {
  modal(`<h3>Remove ${n} downloaded song${n === 1 ? "" : "s"}?</h3>
    <div style="color:var(--sub)">They will be deleted from this device, including songs from this list that you downloaded one by one.</div>
    <div class="btns"><button class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn danger" data-act="dl-confirm">Remove</button></div>`);
  window._dlConfirm = () => {
    Offline.setSet(key, false, tracks);
    toast("Removed downloads");
    b.dataset.sig = "";
    dlSyncToggles();
  };
}
// songs added to a downloaded playlist follow it (the whole list is passed: correct whether setSet merges or replaces)
function dlAutoAdd(key, tracks) {
  if (!dlOn() || !dlReady || !prefs.dlAutoSets) return;
  try {
    if (Offline.isSet(key)) Offline.setSet(key, true, tracks.slice());
  } catch {}
}
function dlFirstNotice() {
  if (LS.get("dlNotice", false)) return;
  LS.set("dlNotice", true);
  toast("Downloads are saved in this browser only");
}

/* single tracks: menus and the retry mark */
function dlMenuItem(t) {
  if (!dlOn() || !dlReady || !t?.id) return null;
  const s = dlHas(t.id) ? "done" : Offline.state(t.id)?.s || "none";
  if (s === "done") return { label: "Remove download", icon: "download", fn: () => dlRemove(t.id) };
  if (s === "queued" || s === "preparing" || s === "downloading") return { label: "Cancel download", icon: "download", fn: () => Offline.cancel(t.id) };
  if (isOffline()) return { label: "Download — needs a connection", icon: "download", disabled: true, dim: true, keepOpen: true, fn: () => {} };
  if (s === "failed") return { label: "Retry download", icon: "download", fn: () => Offline.retry(t.id) };
  return { label: "Download", icon: "download", fn: () => dlStart(t) };
}
function dlStart(t) {
  Offline.download(t);
  dlFirstNotice();
}
function dlRemove(id) {
  Promise.resolve(Offline.remove([id])).then(() => toast("Removed from downloads"), () => toast("Couldn’t remove the download"));
}
function dlTrackAction(id, el) {
  if (!dlOn() || !dlReady || !id) return;
  const s = dlHas(id) ? "done" : Offline.state(id)?.s || "none";
  if (s === "failed") return isOffline() ? toast("Downloads need a connection") : Offline.retry(id);
  if (s === "done") return dlRemove(id);
  if (s !== "none") return Offline.cancel(id);
  const t = trackIndex[id] || (el?.classList.contains("row") ? rowTrack(el) : null) || queue.find((q) => q.id === id);
  if (!t) return;
  if (isOffline()) return toast("Downloads need a connection");
  dlStart(t);
}

/* playback helpers */
function dlSetObjectURL(url) {
  const prev = dlObjURL;
  dlObjURL = url;
  if (prev && prev !== url) URL.revokeObjectURL(prev); // never the one that is playing now
}
// <audio> error while downloads are supported; returns true when handled here
function dlHandleAudioError() {
  const t = current;
  if (dlObjURL && audio.src === dlObjURL) {
    // the stored file won't decode: drop it and stream instead when we can
    Promise.resolve(Offline.remove([t.id])).catch(() => {});
    if (!isOffline()) playTrack(t, true);
    else dlAutoSkip(t.id);
    toast("Download was corrupt — re-download it"); // after the skip, so this message is the one that stays
    return true;
  }
  if (isOffline()) {
    dlAutoSkip(t.id);
    return true;
  }
  offProbeSoon(); // the stream failed: maybe the backend just went away
  return false;
}
// skip to the next playable song, at most once per queue entry in a row
function dlAutoSkip(excludeId) {
  if (++dlSkipRun > Math.max(queue.length, 1)) {
    dlSkipRun = 0;
    audio.pause();
    document.body.classList.remove("is-playing", "is-loading");
    toast("Nothing in the queue can play offline");
    return;
  }
  dlNextOffline(true, excludeId, true);
}
function dlNextOffline(auto, excludeId, quiet) {
  const n = queue.length;
  const ok = (k) => queue[k].id !== excludeId && dlPlayable(queue[k]);
  const stop = (msg) => {
    if (auto) {
      document.body.classList.remove("is-playing", "is-loading");
      if (!audio.paused) audio.pause();
    }
    if (msg) toast(msg);
  };
  let i = -1;
  let skipped = 0;
  if (prefs.shuffle && n > 1) {
    let pool = queue.map((t, k) => k).filter((k) => ok(k) && !shufflePlayed.has(queue[k].id));
    if (!pool.length) {
      if (auto && prefs.repeat === 0) return stop(quiet ? "No more downloaded songs in the queue" : "");
      shufflePlayed.clear();
      if (current) shufflePlayed.add(current.id);
      pool = queue.map((t, k) => k).filter((k) => ok(k) && queue[k].id !== current?.id);
      if (!pool.length) return stop("No other downloaded songs in the queue");
    }
    history.push(qIndex);
    i = pool[Math.floor(Math.random() * pool.length)];
  } else {
    for (let step = 1; step <= n; step++) {
      let k = qIndex + step;
      if (k >= n) {
        if (auto && prefs.repeat === 0) break;
        k -= n;
      }
      if (k === qIndex) break; // went all the way round: nothing else can play
      if (ok(k)) { i = k; break; }
      skipped++;
    }
    if (i < 0) return stop(skipped || !auto || quiet ? "No more downloaded songs in the queue" : "");
  }
  if (skipped) toast(`Skipped ${skipped} song${skipped === 1 ? "" : "s"} not available offline`);
  qIndex = i;
  playTrack(queue[qIndex]);
  renderQueue();
}
function dlPrevOffline() {
  const n = queue.length;
  let i = -1;
  let skipped = 0;
  if (prefs.shuffle) {
    while (history.length) {
      const k = history.pop();
      if (queue[k] && dlPlayable(queue[k])) { i = k; break; }
    }
  }
  if (i < 0) {
    for (let step = 1; step < n; step++) {
      const k = (qIndex - step + n) % n;
      if (dlPlayable(queue[k])) { i = k; break; }
      skipped++;
    }
  }
  if (i < 0) {
    if (current && dlPlayable(current)) audio.currentTime = 0;
    return toast("No other downloaded songs in the queue");
  }
  if (skipped) toast(`Skipped ${skipped} song${skipped === 1 ? "" : "s"} not available offline`);
  qIndex = i;
  playTrack(queue[qIndex]);
  renderQueue();
}

/* views */
function dlOfflineEmpty(title, sub) {
  return `<div class="empty off-empty"><b>${esc(title)}</b>${esc(sub)}<div class="off-empty-btn"><button class="pill-btn" data-act="open-downloads">Go to Downloads</button></div></div>`;
}
const dlNeedsConnection = () => dlOfflineEmpty("This page needs a connection", "You’re offline. Your downloads still play.");
function dlShortcut() {
  return {
    cover: `<span class="cover dl-cover">${icon("download-done", 28)}</span>`,
    name: "Downloads",
    attrs: `data-act="open-downloads"`,
    go: `data-act="play-list" data-list="downloads" data-start="1"`,
  };
}
function dlRenderHomeOffline(greet) {
  const tracks = lists.downloads || [];
  const shortcuts = [dlShortcut(), ...playlists.filter((p) => p.id === "liked" || p.tracks.length).map((p) => ({ cover: coverHTML(p), name: p.name, attrs: `data-act="open-pl" data-id="${esc(p.id)}"` }))].slice(0, 8);
  setView(`
    <h1 class="page">${greet}</h1>
    <div class="shortcuts">${shortcuts
      .map((s) => `<div class="shortcut" ${s.attrs}>${s.cover}<span class="n">${esc(s.name)}</span><button class="go" ${s.go || ""} tabindex="-1">${icon("play")}</button></div>`)
      .join("")}</div>
    ${tracks.length
      ? `<section class="section"><div class="section-head"><h2>Your downloads</h2><button class="chip-link" data-act="open-downloads">Show all</button></div><div class="shelf">${tracks.slice(0, 20).map((t, i) => trackCard(t, "downloads", i)).join("")}</div></section>`
      : `<div class="empty off-empty"><b>You’re offline</b>Songs you download play here without a connection. Download them from the ⋯ menu while you’re online.</div>`}`);
  refreshMarks();
}
function renderDownloads(keepScroll) {
  setAccent("#1d4a33");
  if (!dlOn()) return setView(`<h1 class="page">Downloads</h1><div class="empty"><b>Downloads aren’t available</b>This browser can’t store songs for offline listening.</div>`);
  const tracks = lists.downloads || [];
  const n = tracks.length;
  const total = tracks.reduce((a, t) => a + (t.duration || 0), 0);
  setView(`
    <div class="hero off-dl-hero"><span class="cover dl-cover">${icon("download-done", 72)}</span>
      <div><div class="type">Library</div><h1>Downloads</h1>
        <div class="meta"><b>${n} song${n === 1 ? "" : "s"}</b>${total ? `, ${fmtLong(total)}` : ""}<span id="dl-size"></span></div></div></div>
    ${n
      ? `<div class="actions">
          <button class="big-play" data-act="play-list" data-list="downloads" data-start="1" title="Play" aria-label="Play downloads">${icon("play", 28)}</button>
          <button class="ghost-ic pg-shuffle" data-act="dl-shuffle" title="Shuffle play" aria-label="Shuffle play downloads">${icon("shuffle", 32)}</button>
          <button class="pill-btn off-rm-all" data-act="dl-remove-all">Remove all</button>
        </div>
        <div class="thead"><span>#</span><span>Title</span><span class="h-album">Album</span><span></span><span class="r">${icon("clock", 16)}</span><span></span></div>
        ${tracks.map((t, i) => rowHTML(t, i, "downloads")).join("")}`
      : `<div class="empty off-empty"><b>Songs you download appear here</b>Use the ⋯ menu on any song, or the download button on an album or playlist.</div>`}`);
  refreshMarks();
  if (n) Promise.resolve(Offline.usage()).then((u) => {
    const el = $("dl-size");
    if (el && view.name === "downloads" && u) el.textContent = ` · ${dlFmtBytes(u.bytes)}`;
  }).catch(() => {});
}
function dlRenderSettingsView(data) {
  setAccent("#2a2a2a");
  if (typeof renderSettings === "function") return renderSettings(data);
  setView(`<h1 class="page">Settings</h1><div class="empty"><b>Settings are loading…</b>Try again in a moment.</div>`);
}
function dlAlbumTracks(id) {
  return dlMetas
    .filter((m) => String(m.albumId) === String(id))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .map(dlTrackFromMeta);
}
// offline and not cached: rebuild the album from the songs downloaded from it
function dlRenderAlbumOffline(id) {
  const tracks = dlAlbumTracks(id);
  if (!tracks.length) return setView(dlNeedsConnection());
  const a = tracks[0];
  setAccent(accentFor(a.album || ""));
  lists.album = tracks;
  const total = tracks.reduce((x, t) => x + (t.duration || 0), 0);
  setView(`
    <div class="hero"><span class="cover">${imgTag(a.thumb)}</span>
      <div><div class="type">Album · downloaded</div><h1>${esc(a.album)}</h1>
        <div class="meta"><b>${esc(a.artist)}</b> · ${tracks.length} downloaded song${tracks.length === 1 ? "" : "s"}, ${fmtLong(total)}</div>
      </div></div>
    <div class="actions"><button class="big-play" data-act="play-list" data-list="album" data-start="1" title="Play">${icon("play", 28)}</button>
      <button class="ghost-ic pg-shuffle" data-act="shuffle" title="Shuffle">${icon("shuffle", 32)}</button></div>
    <div class="thead compact"><span>#</span><span>Title</span><span></span><span class="r">${icon("clock", 16)}</span><span></span></div>
    ${tracks.map((t, i) => rowHTML(t, i, "album", null, true, true)).join("")}`);
  refreshMarks();
  (async () => {
    let u = null;
    try { u = await Offline.coverURL(a.id); } catch {}
    const img = $("view").querySelector(".hero .cover img");
    if (u && img && view.name === "album" && view.data === id) img.src = u;
  })();
}

/* library */
function dlLibraryEntry(item) {
  const n = dlMetas.length;
  return item(view.name === "downloads" ? "active" : "", `data-act="open-downloads"`, `<span class="cover dl-cover">${icon("download-done", 24)}</span>`, "Downloaded songs", `Downloads · ${n} song${n === 1 ? "" : "s"}`);
}
function dlLibraryItems(item) {
  const rows = [dlLibraryEntry(item)];
  if (dlReady) {
    playlists.forEach((pl) => {
      if (pl.tracks.length && pl.tracks.every((t) => Offline.has(t.id)))
        rows.push(item(view.name === "playlist" && view.data === pl.id ? "active" : "", `data-act="open-pl" data-id="${esc(pl.id)}"`, coverHTML(pl), pl.name, `Playlist · ${pl.tracks.length} song${pl.tracks.length === 1 ? "" : "s"}`));
    });
    library.albums.forEach((a) => {
      const cached = apiCache.get("/album/" + a.id)?.tracks;
      const local = dlMetas.some((m) => String(m.albumId) === String(a.id));
      const all = cached?.length ? cached.every((t) => Offline.has(t.id)) : local && Offline.isSet("album:" + a.id);
      if (all) rows.push(item(view.name === "album" && view.data === a.id ? "active" : "", `data-act="album" data-id="${esc(a.id)}"`, `<span class="cover">${imgTag(a.thumb)}</span>`, a.title, `Album · ${a.artist}`));
    });
  }
  return rows.join("");
}
