/* Settings page. Classic script sharing app.js's global scope: everything lives in
   this IIFE; only renderSettings / stRefresh are exposed. Own listeners use data-st
   attributes so they never collide with app.js's data-act switch. */
(() => {
  "use strict";
  const stOff = () => !!(window.Offline && window.Offline.supported);
  const stById = (id) => document.getElementById(id);
  const stSet = (id, html) => { const el = stById(id); if (el) el.innerHTML = html; };
  const stText = (id, t) => { const el = stById(id); if (el) el.textContent = t; };

  function stBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    if (n < 1024 ** 3) return (n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0) + " MB";
    return (n / 1024 ** 3).toFixed(2) + " GB";
  }
  const stPlural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

  /* prefs with defaults (app.js may not define them) */
  const stOfflineMode = () => !!(prefs.offlineMode ?? false);
  const stConc = () => { const n = Number(prefs.dlConcurrency ?? 2); return n >= 1 && n <= 3 ? Math.round(n) : 2; };
  const stAutoSets = () => !!(prefs.dlAutoSets ?? true);
  function stPref(key, value) {
    prefs[key] = value;
    savePrefs();
    window.dispatchEvent(new CustomEvent("streamify:prefs", { detail: { key, value } }));
  }

  /* ── markup helpers ───────────────────────────────────── */
  const stRow = (label, sub, control, id) =>
    `<div class="st-row"${id ? ` id="${id}"` : ""}><div class="st-label"><div class="st-title">${label}</div>${sub ? `<div class="st-sub">${sub}</div>` : ""}</div>${control ? `<div class="st-ctl">${control}</div>` : ""}</div>`;
  const stSwitch = (key, on, label) =>
    `<label class="switch"><input type="checkbox" role="switch" data-st="${key}" aria-label="${esc(label)}"${on ? " checked" : ""}><span class="st-knob" aria-hidden="true"></span></label>`;
  const stBtn = (act, text, cls = "", extra = "") => `<button class="btn st-btn ${cls}" data-st="${act}"${extra}>${text}</button>`;
  const stSection = (title, body, id) => `<section class="st-section"${id ? ` id="${id}"` : ""}><h2>${title}</h2>${body}</section>`;

  function stDownloadsHTML() {
    if (!stOff())
      return stSection("Downloads & storage",
        stRow("Downloads aren't available in this browser (storage unavailable)", "Songs can't be saved for offline listening here. Streaming works as usual.") +
        stNotes());
    const seg = [1, 2, 3].map((n) => `<button type="button" data-st="conc" data-v="${n}" aria-pressed="${stConc() === n}">${n}</button>`).join("");
    return stSection("Downloads & storage",
      `<div class="st-usage" id="st-usage"><div class="st-title" id="st-usage-line">Checking storage…</div><div class="st-bar" id="st-bar" hidden><span id="st-bar-fill"></span></div><div class="st-sub" id="st-usage-sub"></div></div>` +
      stRow("Persistent storage", "Asks the browser not to evict your downloads when space runs low. It lowers the chance of losing them, but the browser decides.",
        `<span class="st-badge" id="st-persist-badge">…</span>` + stBtn("persist", "Request persistent storage", "ghost", ' id="st-persist-btn"')) +
      stRow("Offline mode", "Only play downloaded songs and make no network requests.", stSwitch("offlineMode", stOfflineMode(), "Offline mode")) +
      stRow("Simultaneous downloads", "How many songs download at once.", `<div class="seg" role="group" aria-label="Simultaneous downloads">${seg}</div>`) +
      stRow("Auto-download new songs", "Auto-download new songs added to downloaded playlists.", stSwitch("dlAutoSets", stAutoSets(), "Auto-download new songs added to downloaded playlists")) +
      stRow("Downloads", "See and manage the songs saved on this device.", stBtn("view-downloads", "View downloads", "ghost")) +
      stRow("Remove all downloads", "Deletes every saved song from this browser.", stBtn("remove-all", "Remove all downloads", "danger")) +
      stNotes());
  }
  const stNotes = () =>
    `<p class="st-note">Songs are saved in this browser only, for personal offline listening. Audio is sourced from YouTube.</p>` +
    `<p class="st-note">Safari can clear storage of websites you haven't opened for 7 days unless the app is installed to the Home Screen.</p>`;

  function stLibraryHTML() {
    return stSection("Library & data",
      stRow("Clear search history", "Removes your recent searches.", stBtn("clear-searches", "Clear", "ghost")) +
      stRow("Clear recently played", "Empties the recently played list on Home.", stBtn("clear-recent", "Clear", "ghost")) +
      stRow("Reset panel layout", "Restores the default sidebar and queue widths.", stBtn("reset-layout", "Reset", "ghost")) +
      stRow("Export backup", "Saves playlists, library, covers, settings and history as a JSON file. Custom covers can make it large. Audio is not included.", stBtn("export", "Export backup", "ghost")) +
      stRow("Import backup", "Replaces your current playlists, library and settings with a backup file. Nothing changes unless the file passes validation.",
        stBtn("import", "Import backup", "ghost") + `<input type="file" id="st-file" data-st="file" accept="application/json,.json" hidden>`) +
      stRow("Reset everything", "Deletes all Streamify data in this browser (playlists, library, settings, history) and reloads the app.", stBtn("reset-all", "Reset everything", "danger")));
  }

  function stConnectionHTML() {
    const spk = typeof airplay !== "undefined" && airplay ? airplay.name || "AirPlay speaker" : "This computer";
    const secure = window.isSecureContext;
    const ctl = navigator.serviceWorker && navigator.serviceWorker.controller;
    return stSection("Connection",
      stRow("Backend", `<code class="st-code">${esc(API)}</code>`, `<span class="st-badge" id="st-conn-badge">Checking…</span>` + stBtn("recheck", "Re-check", "ghost")) +
      stRow("Secure context (HTTPS or localhost)", "", `<span class="st-badge ${secure ? "ok" : "warn"}">${secure ? "Yes" : "No"}</span>`) +
      stRow("Service worker", "", `<span class="st-badge ${ctl ? "ok" : "warn"}">${ctl ? "Active" : "Not active"}</span>`) +
      stRow("Playing on", "", `<span class="st-value">${esc(spk)}</span>`) +
      `<p class="st-note">Offline app launch needs the installed app over HTTPS or localhost. On a plain http:// address (like your phone on the LAN) downloads still play, but the app itself can't start without a connection — run the backend with --cert/--key (mkcert) or use an HTTPS proxy such as Tailscale Serve.</p>`);
  }

  function stAppHTML() {
    let rows = "";
    if (typeof canInstall === "function" && canInstall()) rows += stRow("Install app", "Add Streamify to your device for a full-screen, app-like experience.", stBtn("install", "Install app", "primary"));
    if (typeof swReg !== "undefined" && swReg) {
      const waiting = !!swReg.waiting;
      rows += stRow("Updates", waiting ? "A new version is ready. Reload to apply it." : "You're on the latest version.", stBtn("update", "Check for updates", "ghost"));
    }
    rows += stRow("Version", "", `<span class="st-value" id="st-version">…</span>`);
    rows += `<p class="st-note">Streamify — a Spotify-style player. Metadata from Deezer, lyrics from LRCLIB, release years from MusicBrainz, audio from YouTube.</p>`;
    return stSection("App", rows);
  }

  /* ── async fills ──────────────────────────────────────── */
  async function stFillUsage() {
    if (!stById("st-usage") || !stOff()) return;
    let u = {};
    try { u = (await Offline.usage()) || {}; } catch {}
    const count = u.count ?? u.songs ?? u.tracks ?? u.n ?? 0;
    const bytes = u.bytes ?? u.size ?? u.audioBytes ?? u.downloadBytes ?? 0;
    stText("st-usage-line", `${stPlural(count, "downloaded song")} · ${stBytes(bytes)}`);
    const usage = Number(u.usage) || 0, quota = Number(u.quota) || 0;
    if (quota > 0) {
      stById("st-bar").hidden = false;
      stById("st-bar-fill").style.width = Math.max(usage > 0 ? 1 : 0, Math.min(100, (usage / quota) * 100)) + "%";
      stText("st-usage-sub", `Browser storage: ${stBytes(usage)} used of ${stBytes(quota)} available`);
    } else {
      const b = stById("st-bar"); if (b) b.hidden = true;
      stText("st-usage-sub", usage ? `Browser storage: ${stBytes(usage)} used` : "Browser storage: size unknown");
    }
    let persisted = u.persisted;
    if (persisted === undefined) { try { persisted = await navigator.storage.persisted(); } catch {} }
    stPersistUI(persisted);
  }
  function stPersistUI(p) {
    const b = stById("st-persist-badge");
    if (!b) return;
    b.textContent = p ? "Granted" : "Not granted";
    b.className = "st-badge " + (p ? "ok" : "warn");
    const btn = stById("st-persist-btn");
    if (btn) btn.hidden = !!p;
  }

  let stProbeToken = 0;
  async function stProbe() {
    const tok = ++stProbeToken;
    const set = (cls, t) => { if (tok !== stProbeToken) return; const b = stById("st-conn-badge"); if (b) { b.className = "st-badge " + cls; b.textContent = t; } };
    set("", "Checking…");
    try {
      const r = await fetch(`${API}/search?q=test&limit=1`, { signal: AbortSignal.timeout(4000) });
      if (r.status === 401) set("warn", "Access expired");
      else if (!r.ok) set("bad", "Unreachable");
      else set("ok", "Reachable");
    } catch { set("bad", "Unreachable"); }
  }

  function stFillVersion() {
    const el = stById("st-version");
    if (!el) return;
    const sw = navigator.serviceWorker;
    if (!sw || !sw.controller) { el.textContent = "Not installed"; return; }
    const onMsg = (e) => {
      if (e.data && e.data.type === "VERSION") { cleanup(); el.textContent = String(e.data.version); }
    };
    const cleanup = () => { sw.removeEventListener("message", onMsg); clearTimeout(t); };
    const t = setTimeout(() => { cleanup(); if (el.textContent === "…") el.textContent = "Unknown"; }, 1500);
    sw.addEventListener("message", onMsg);
    try { sw.controller.postMessage({ type: "GET_VERSION" }); } catch { cleanup(); el.textContent = "Unknown"; }
  }

  /* ── render ───────────────────────────────────────────── */
  function renderSettings() {
    setAccent("#2a2a2a");
    setView(`<div class="st-page" id="st-root"><h1 class="page">Settings</h1>${stDownloadsHTML()}${stLibraryHTML()}${stConnectionHTML()}${stAppHTML()}<div id="st-display"></div></div>`);
    stFillUsage();
    stFillVersion();
    stDisplayInfo();
    if (stOfflineMode()) { const b = stById("st-conn-badge"); if (b) { b.textContent = "Not checked (offline mode)"; } }
    else stProbe();
  }
  // Screen diagnostics: what the browser reports about the window and safe areas (for layout bugs on phones)
  function stDisplayInfo() {
    const box = stById("st-display");
    if (!box) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const inset = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(" / ");
    const fixedBottom = Math.round(probe.getBoundingClientRect().bottom);
    probe.remove();
    const vv = window.visualViewport;
    const rows = [
      ["Installed app", (navigator.standalone || matchMedia("(display-mode: standalone)").matches) ? "yes" : "no (browser tab)"],
      ["Window (inner)", `${innerWidth} × ${innerHeight}`],
      ["Visual viewport", vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)}` : "n/a"],
      ["Screen", `${screen.width} × ${screen.height} @${devicePixelRatio}x`],
      ["Safe area (t / r / b / l)", inset],
      ["html / body height", `${document.documentElement.clientHeight} / ${document.body.offsetHeight}`],
      ["Bottom of fixed layer", `${fixedBottom}px (window is ${innerHeight}px)`],
    ];
    box.innerHTML = stSection("Display info", rows.map(([k, v]) => stRow(k, "", `<span class="st-value">${v}</span>`)).join(""));
  }
  window.renderSettings = renderSettings;
  window.stRefresh = () => { if (stById("st-root")) renderSettings(); };

  /* ── confirm modal ────────────────────────────────────── */
  let stPending = null;
  function stConfirm({ title, body, cta, danger, run }) {
    stPending = run;
    modal(`<h3>${esc(title)}</h3><p class="st-modal-text">${body}</p><div class="btns"><button class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-st="confirm">${esc(cta)}</button></div>`);
    const b = document.querySelector('#modal-box [data-st="confirm"]');
    if (b) setTimeout(() => b.focus(), 40);
  }

  /* ── backup: export ───────────────────────────────────── */
  function stBuildBackup() {
    return { version: 1, exportedAt: new Date().toISOString(), playlists, library, covers: LS.get("covers", {}), prefs, recent, searchHistory };
  }
  function stExport() {
    const json = JSON.stringify(stBuildBackup());
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streamify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(`Backup exported (${stBytes(blob.size)})`);
  }

  /* ── backup: import (strict validation) ───────────────── */
  const ST_MAX_FILE = 40 * 1024 * 1024;
  const ST_CAP = { playlists: 200, tracks: 5000, lib: 2000, recent: 200, searches: 100, covers: 400, coverLen: 6 * 1024 * 1024 };
  const stIsObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  class StErr extends Error {}
  function stClean(v, depth = 0) {
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") { if (!Number.isFinite(v)) throw new StErr("Invalid number"); return v; }
    if (typeof v === "string") { if (v.length > 20000) throw new StErr("A text value is too long"); return v; }
    if (depth > 4) throw new StErr("Data is nested too deeply");
    if (Array.isArray(v)) { if (v.length > 5000) throw new StErr("A list is too long"); return v.map((x) => stClean(x, depth + 1)); }
    if (stIsObj(v)) {
      const o = {};
      for (const k of Object.keys(v)) { if (k === "__proto__" || k === "constructor" || k === "prototype") continue; o[k] = stClean(v[k], depth + 1); }
      return o;
    }
    throw new StErr("Unsupported value");
  }
  const stIdOk = (v) => (typeof v === "string" && v.length > 0 && v.length <= 200) || (typeof v === "number" && Number.isFinite(v));
  function stNum(v, lo, hi, name) { if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw new StErr(`Invalid setting: ${name}`); return v; }

  function stValidate(text, size) {
    if (size > ST_MAX_FILE) throw new StErr("File is too large");
    let d;
    try { d = JSON.parse(text); } catch { throw new StErr("Not a valid JSON file"); }
    if (!stIsObj(d)) throw new StErr("Not a Streamify backup");
    if (d.version !== 1) throw new StErr("Unsupported backup version");
    const out = {};
    // playlists
    if (!Array.isArray(d.playlists) || !d.playlists.length) throw new StErr("Backup has no playlists");
    if (d.playlists.length > ST_CAP.playlists) throw new StErr("Too many playlists");
    if (!stIsObj(d.playlists[0]) || d.playlists[0].id !== "liked") throw new StErr("First playlist must be Liked Songs");
    const seen = new Set();
    out.playlists = d.playlists.map((p) => {
      if (!stIsObj(p) || typeof p.id !== "string" || !p.id || p.id.length > 100) throw new StErr("A playlist is malformed");
      if (typeof p.name !== "string" || p.name.length > 300) throw new StErr("A playlist has an invalid name");
      if (!Array.isArray(p.tracks)) throw new StErr("A playlist has no track list");
      if (p.tracks.length > ST_CAP.tracks) throw new StErr("A playlist has too many songs");
      if (seen.has(p.id)) throw new StErr("Duplicate playlist id");
      seen.add(p.id);
      p.tracks.forEach((t) => { if (!stIsObj(t) || !stIdOk(t.id)) throw new StErr("A song is malformed"); });
      return stClean(p);
    });
    // library
    if (!stIsObj(d.library) || !Array.isArray(d.library.albums) || !Array.isArray(d.library.artists)) throw new StErr("Library is malformed");
    if (d.library.albums.length > ST_CAP.lib || d.library.artists.length > ST_CAP.lib) throw new StErr("Library is too large");
    const libItem = (x) => { if (!stIsObj(x) || !stIdOk(x.id)) throw new StErr("A library item is malformed"); return stClean(x); };
    out.library = { albums: d.library.albums.map(libItem), artists: d.library.artists.map(libItem) };
    // covers
    if (d.covers === undefined) out.covers = {};
    else {
      if (!stIsObj(d.covers)) throw new StErr("Covers are malformed");
      const keys = Object.keys(d.covers);
      if (keys.length > ST_CAP.covers) throw new StErr("Too many covers");
      out.covers = {};
      for (const k of keys) {
        const v = d.covers[k];
        if (typeof v !== "string" || !v.startsWith("data:image/")) throw new StErr("A cover is not an image");
        if (v.length > ST_CAP.coverLen) throw new StErr("A cover is too large");
        if (k === "liked" || k === "__proto__" || !seen.has(k)) continue; // same stale-cover cleanup the app does
        out.covers[k] = v;
      }
    }
    // recent
    if (d.recent === undefined) out.recent = [];
    else {
      if (!Array.isArray(d.recent) || d.recent.length > ST_CAP.recent) throw new StErr("Recently played is malformed or too long");
      d.recent.forEach((t) => { if (!stIsObj(t) || !stIdOk(t.id)) throw new StErr("A recent song is malformed"); });
      out.recent = d.recent.map((t) => stClean(t));
    }
    // search history
    if (d.searchHistory === undefined) out.searchHistory = [];
    else {
      if (!Array.isArray(d.searchHistory) || d.searchHistory.length > ST_CAP.searches) throw new StErr("Search history is malformed or too long");
      if (d.searchHistory.some((s) => typeof s !== "string" || s.length > 300)) throw new StErr("Search history is malformed");
      out.searchHistory = d.searchHistory.slice(0, 12);
    }
    // prefs: whitelist only
    out.prefs = {};
    if (d.prefs !== undefined) {
      if (!stIsObj(d.prefs)) throw new StErr("Settings are malformed");
      const p = d.prefs, o = out.prefs;
      const bool = (k) => { if (p[k] !== undefined) { if (typeof p[k] !== "boolean") throw new StErr(`Invalid setting: ${k}`); o[k] = p[k]; } };
      const num = (k, lo, hi) => { if (p[k] !== undefined) o[k] = stNum(p[k], lo, hi, k); };
      num("volume", 0, 1); bool("muted"); bool("shuffle"); num("repeat", 0, 2);
      num("sbWidth", 0, 2000); num("rpWidth", 0, 2000);
      bool("iosHintDismissed"); bool("offlineMode"); num("dlConcurrency", 1, 3); bool("dlAutoSets");
    }
    out.exportedAt = typeof d.exportedAt === "string" ? d.exportedAt.slice(0, 40) : "";
    return out;
  }

  function stSummary(b) {
    const songs = b.playlists.reduce((n, p) => n + p.tracks.length, 0);
    const parts = [
      stPlural(b.playlists.length, "playlist") + ` (${stPlural(songs, "song")})`,
      stPlural(b.library.albums.length, "saved album"),
      stPlural(b.library.artists.length, "saved artist"),
      stPlural(Object.keys(b.covers).length, "custom cover"),
      stPlural(b.recent.length, "recently played song"),
      stPlural(b.searchHistory.length, "search", "searches"),
    ];
    return parts.join(", ");
  }

  const ST_KEYS = ["playlists", "library", "covers", "recent", "searches", "prefs"];
  function stApplyImport(b) {
    const snap = {};
    ST_KEYS.forEach((k) => { try { snap[k] = localStorage.getItem("streamify." + k); } catch { snap[k] = null; } });
    const pl = typeof isCatalogTrack === "function" ? b.playlists.map((p) => ({ ...p, tracks: p.tracks.filter(isCatalogTrack) })) : b.playlists;
    const rec = typeof isCatalogTrack === "function" ? b.recent.filter(isCatalogTrack) : b.recent;
    const newPrefs = { ...prefs, ...b.prefs };
    const ok =
      LS.setSafe("playlists", pl) && LS.setSafe("library", b.library) && LS.setSafe("covers", b.covers) &&
      LS.setSafe("recent", rec) && LS.setSafe("searches", b.searchHistory) && LS.setSafe("prefs", newPrefs);
    if (!ok) {
      ST_KEYS.forEach((k) => { try { snap[k] === null ? localStorage.removeItem("streamify." + k) : localStorage.setItem("streamify." + k, snap[k]); } catch {} });
      toast("Import failed — not enough browser storage. Nothing was changed");
      return;
    }
    playlists = pl; library = b.library; covers = b.covers; recent = rec; searchHistory = b.searchHistory;
    Object.assign(prefs, b.prefs);
    try { audio.volume = prefs.volume; audio.muted = prefs.muted; } catch {}
    try { applyPanelWidths(); } catch {}
    try { renderLibrary(); } catch {}
    try { if (typeof refreshCovers === "function") refreshCovers(); } catch {}
    try { renderPrefs(); } catch {}
    for (const k of Object.keys(b.prefs)) window.dispatchEvent(new CustomEvent("streamify:prefs", { detail: { key: k, value: prefs[k] } }));
    renderSettings();
    toast("Backup imported");
  }

  async function stOnFile(input) {
    const f = input.files && input.files[0];
    input.value = "";
    if (!f) return;
    let b;
    try {
      if (f.size > ST_MAX_FILE) throw new StErr("File is too large");
      b = stValidate(await f.text(), f.size);
    } catch (err) {
      toast(err instanceof StErr ? "Import failed: " + err.message : "Import failed: couldn't read the file");
      return;
    }
    stConfirm({
      title: "Replace your data?",
      body: `This replaces your current playlists, library and settings with: ${esc(stSummary(b))}.` + (b.exportedAt ? ` Backup made ${esc(b.exportedAt.slice(0, 10))}.` : ""),
      cta: "Replace", danger: true, run: () => stApplyImport(b),
    });
  }

  /* ── actions ──────────────────────────────────────────── */
  async function stResetAll() {
    try { if (stOff()) await Offline.removeAll(); } catch {}
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("streamify.")).forEach((k) => localStorage.removeItem(k));
    } catch {}
    location.reload();
  }

  const stActions = {
    persist: async (el) => {
      if (!stOff()) return;
      el.disabled = true;
      let r;
      try { r = await Offline.persist(); } catch {}
      el.disabled = false;
      const granted = typeof r === "object" && r ? !!r.persisted : !!r;
      stPersistUI(granted);
      toast(granted ? "Persistent storage granted" : "Not granted — the browser declined");
    },
    conc: (el) => {
      const n = +el.dataset.v;
      stPref("dlConcurrency", n);
      try { if (stOff() && Offline.setConcurrency) Offline.setConcurrency(n); } catch {}
      el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
    },
    "view-downloads": () => { try { navigate("downloads"); } catch { toast("Downloads view isn't available"); } },
    "remove-all": () => stConfirm({
      title: "Remove all downloads?", body: "Every downloaded song will be deleted from this browser. You can download them again later.",
      cta: "Delete", danger: true,
      run: async () => {
        try { await Offline.removeAll(); toast("All downloads removed"); } catch { toast("Couldn't remove downloads"); }
        stFillUsage();
      },
    }),
    "clear-searches": () => { searchHistory.length = 0; saveSearchHistory(); toast("Search history cleared"); },
    "clear-recent": () => { recent = []; LS.set("recent", []); toast("Recently played cleared"); },
    "reset-layout": () => { prefs.sbWidth = 300; prefs.rpWidth = 340; savePrefs(); applyPanelWidths(); toast("Panel layout reset"); },
    export: stExport,
    import: () => stById("st-file")?.click(),
    "reset-all": () => stConfirm({
      title: "Reset everything?", body: "This permanently deletes your playlists, library, settings and history from this browser" + (stOff() ? ", and removes all downloads" : "") + ". It can't be undone. Export a backup first if you want to keep them.",
      cta: "Reset everything", danger: true, run: stResetAll,
    }),
    recheck: () => stProbe(),
    install: async () => { try { await installApp(); } catch {} window.stRefresh(); },
    update: async (el) => {
      if (typeof swReg === "undefined" || !swReg) return;
      el.disabled = true;
      try { await swReg.update(); } catch {}
      el.disabled = false;
      toast("Checked");
      window.stRefresh();
    },
    confirm: async () => {
      const run = stPending;
      stPending = null;
      closeModal();
      if (run) await run();
    },
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-st]");
    if (!el || el.tagName === "INPUT") return;
    const fn = stActions[el.dataset.st];
    if (fn) fn(el);
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!el || !el.matches || !el.matches("input[data-st]")) return;
    if (el.type === "file") return void stOnFile(el);
    if (el.dataset.st === "offlineMode") {
      stPref("offlineMode", el.checked);
      stText("st-conn-badge", el.checked ? "Not checked (offline mode)" : "Checking…");
      if (!el.checked) stProbe();
    } else if (el.dataset.st === "dlAutoSets") stPref("dlAutoSets", el.checked);
  });
  /* app.js maps Space to play/pause on every non-input element, which would swallow
     Space on our buttons: stop it at the capture phase (without preventDefault, so the
     browser still activates the focused button) */
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.closest && e.target.closest(".st-page button, #modal-box button")) e.stopPropagation();
  }, true);
  /* closing the modal by any other route (Cancel, overlay click) discards the pending action */
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest('[data-act="modal-cancel"]')) stPending = null;
  });
})();
