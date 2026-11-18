/* Streamify offline downloads: a self-contained manager exposed as window.Offline.
 *
 * Classic script, loaded before app.js. It touches no app.js globals at load time;
 * `API` (the backend origin) is read lazily when a job starts.
 *
 * Storage
 *   IndexedDB "streamify-offline" v1
 *     meta  {keyPath:id; indexes ts, albumId}  -> Meta (small, listable)
 *     blobs {keyPath:id}                       -> {id, audio:Blob, cover:Blob|null}
 *   A finished download writes both records in ONE transaction, so a half-written
 *   track can never exist. The audio is assembled in memory first (files are 3-8 MB).
 *
 * localStorage
 *   streamify.dlQueue  JSON array of track objects ({id,title,artist,artistId,album,
 *                      albumId,duration,thumb}) for jobs that are queued / running /
 *                      waiting for a retry. Failed jobs are NOT persisted (a reload
 *                      must not silently re-hammer a broken track).
 *   streamify.dlSets   JSON object {"<setKey>": ["<trackId>", ...]}. The key is present
 *                      iff the set is ON; the list is the ids that set needs. It lets
 *                      turn-off decide which downloads are still wanted by another set.
 *                      (A legacy plain array of keys is accepted and read as empty lists.)
 *
 * Pause semantics
 *   pause()/resume() (the app's offline/online switch) only gate STARTING jobs; running
 *   jobs are left to finish or fail on their own. A quota pause is separate and is NOT
 *   lifted by resume(): it clears on retry(id), remove()/removeAll() (space was freed)
 *   or clearQuotaPause().
 *
 * Tunables: Offline.config = {backoff:[ms..], headerTimeout, stallTimeout, progressInterval,
 * coverTimeout, lyricsTimeout}; read at use time (tests shorten them).
 */
(function () {
  "use strict";

  var DB_NAME = "streamify-offline";
  var LS_QUEUE = "streamify.dlQueue";
  var LS_SETS = "streamify.dlSets";
  var STATES = { none: 1, queued: 1, preparing: 1, downloading: 1, done: 1, failed: 1 };
  var COVER_MAX = 300;
  var COVER_CACHE_MAX = 300;

  var config = {
    backoff: [2000, 8000, 30000], // delay before retry 1, 2, 3; then the job fails
    headerTimeout: 90000,         // the backend may need ~3 s (or much more) to fetch from YouTube
    stallTimeout: 20000,          // no body bytes for this long -> abort
    progressInterval: 200,        // ~5 progress events/s per job
    coverTimeout: 15000,
    lyricsTimeout: 15000
  };

  var api = {
    supported: !!(typeof window !== "undefined" && window.indexedDB),
    config: config
  };

  // ---- state ---------------------------------------------------------------
  var db = null;
  var ready = false;
  var initPromise = null;
  var ids = new Set();            // downloaded ids (makes has() synchronous)
  var sizes = new Map();          // id -> bytes, for usage()
  var jobs = new Map();           // id -> job (queued/preparing/downloading/failed)
  var sets = loadSets();          // {key: [ids]}
  var concurrency = 2;
  var userPaused = false;
  var quotaPaused = false;
  var persistTried = false;
  var listeners = { change: new Set(), quota: new Set(), list: new Set() };
  var coverCache = new Map();     // id -> Promise<string|null>; insertion order = LRU order

  // ---- tiny helpers --------------------------------------------------------
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* full / blocked: non-fatal */ } }

  function emit(ev, payload) {
    var set = listeners[ev];
    if (!set) return;
    Array.from(set).forEach(function (cb) {
      try { cb(payload); } catch (e) { /* a bad listener must never break the manager */ }
    });
  }

  function emitChange(job) {
    emit("change", { id: job.id, s: job.s, pct: job.pct, err: job.err });
  }

  function isQuota(e) {
    return !!e && (e.name === "QuotaExceededError" || e.code === 22 ||
      (e.name === "UnknownError" && /quota/i.test(String(e.message))));
  }

  function failure(msg, fatal) {
    var e = new Error(msg);
    e.fatal = !!fatal;
    return e;
  }

  function apiBase() {
    // `API` is app.js's const; resolved at call time only. Same-origin as fallback.
    try { return typeof API === "string" ? API : ""; } catch (e) { return ""; }
  }

  function normTrack(t) {
    if (!t || t.id == null || t.id === "") return null;
    return {
      id: String(t.id),
      title: t.title || "",
      artist: t.artist || "",
      artistId: t.artistId == null ? null : t.artistId,
      album: t.album || "",
      albumId: t.albumId == null ? null : t.albumId,
      duration: Number(t.duration) || 0,
      thumb: t.thumb || ""
    };
  }

  function asArray(x) { return Array.isArray(x) ? x : x == null ? [] : [x]; }

  // ---- IndexedDB -----------------------------------------------------------
  function reqP(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function txP(tx) {
    return new Promise(function (res, rej) {
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { /* the abort handler below carries the reason */ };
      tx.onabort = function () { rej(tx.error || new Error("transaction aborted")); };
    });
  }

  function openDB() {
    return new Promise(function (res, rej) {
      var r;
      try { r = window.indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains("meta")) {
          var m = d.createObjectStore("meta", { keyPath: "id" });
          m.createIndex("ts", "ts");
          m.createIndex("albumId", "albumId");
        }
        if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs", { keyPath: "id" });
      };
      r.onsuccess = function () {
        var d = r.result;
        // Another tab wants to upgrade/delete: get out of the way, reopen lazily on next use.
        d.onversionchange = function () { try { d.close(); } catch (e) { } if (db === d) db = null; };
        d.onclose = function () { if (db === d) db = null; };
        res(d);
      };
      r.onerror = function () { rej(r.error); };
      // 'blocked' only happens on upgrades from another tab's old connection; we stay
      // pending and finish when it closes (nothing useful to do meanwhile).
      r.onblocked = function () { };
    });
  }

  function getDB() {
    return db ? Promise.resolve(db) : openDB().then(function (d) { db = d; return d; });
  }

  // ---- sets ----------------------------------------------------------------
  function loadSets() {
    var out = {};
    try {
      var raw = JSON.parse(lsGet(LS_SETS) || "{}");
      if (Array.isArray(raw)) raw.forEach(function (k) { out[String(k)] = []; });
      else if (raw && typeof raw === "object") {
        Object.keys(raw).forEach(function (k) { out[k] = asArray(raw[k]).map(String); });
      }
    } catch (e) { }
    return out;
  }
  function saveSets() { lsSet(LS_SETS, JSON.stringify(sets)); }

  // ---- queue persistence ---------------------------------------------------
  function persistQueue() {
    // Before init has restored the stored queue we must not overwrite it with a partial one.
    if (!ready) return;
    var list = [];
    jobs.forEach(function (j) { if (j.s !== "failed") list.push(j.track); });
    lsSet(LS_QUEUE, JSON.stringify(list));
  }

  // ---- scheduler -----------------------------------------------------------
  function activeCount() {
    var n = 0;
    jobs.forEach(function (j) { if (j.s === "preparing" || j.s === "downloading") n++; });
    return n;
  }

  function pump() {
    if (!ready || userPaused || quotaPaused) return;
    var active = activeCount();
    var started = [];
    jobs.forEach(function (j) {
      if (active < concurrency && j.s === "queued" && !j.timer) { started.push(j); active++; }
    });
    started.forEach(startJob);
  }

  function setState(job, s, pct, err) {
    job.s = s; job.pct = pct; job.err = err || null;
    emitChange(job);
  }

  function dropJob(job) {
    job.dead = true;
    if (job.timer) { clearTimeout(job.timer); job.timer = null; }
    job.why = "cancel";
    try { if (job.ctrl) job.ctrl.abort(); } catch (e) { }
    if (jobs.get(job.id) === job) jobs.delete(job.id);
  }

  function failJob(job, msg, fatal) {
    if (job.dead) return;
    if (!fatal && job.tries < config.backoff.length) {
      var delay = config.backoff[job.tries];
      job.tries++;
      job.timer = setTimeout(function () { job.timer = null; pump(); }, delay);
      setState(job, "queued", null, null);
    } else {
      setState(job, "failed", null, msg || "error");
      persistQueue();
    }
    pump();
  }

  function onQuota(job) {
    if (job.dead) return;
    quotaPaused = true;
    setState(job, "failed", null, "quota");
    persistQueue();
    emit("quota", { id: job.id });
  }

  // Run an async fn(signal) bounded by a timeout, also aborted when `parent` aborts.
  function bounded(parent, ms, fn) {
    var c = new AbortController();
    var onAbort = function () { c.abort(); };
    if (parent.aborted) c.abort(); else parent.addEventListener("abort", onAbort);
    var t = setTimeout(function () { c.abort(); }, ms);
    return Promise.resolve().then(function () { return fn(c.signal); }).then(
      function (v) { clearTimeout(t); parent.removeEventListener("abort", onAbort); return v; },
      function (e) { clearTimeout(t); parent.removeEventListener("abort", onAbort); throw e; }
    );
  }

  function shrinkCover(blob) {
    // Cheap downscale so 1000 offline tracks don't carry 1000 big covers.
    if (typeof createImageBitmap !== "function") return Promise.resolve(blob);
    return createImageBitmap(blob).then(function (bmp) {
      var m = Math.max(bmp.width, bmp.height);
      if (m <= COVER_MAX) { if (bmp.close) bmp.close(); return blob; }
      var k = COVER_MAX / m, w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      var p;
      if (typeof OffscreenCanvas === "function") {
        var oc = new OffscreenCanvas(w, h);
        oc.getContext("2d").drawImage(bmp, 0, 0, w, h);
        p = oc.convertToBlob({ type: "image/jpeg", quality: 0.85 });
      } else {
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(bmp, 0, 0, w, h);
        p = new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.85); });
      }
      return p.then(function (out) {
        if (bmp.close) bmp.close();
        return out && out.size && out.size < blob.size ? out : blob;
      });
    }).catch(function () { return blob; });
  }

  function fetchCover(url, parentSignal) {
    if (!url) return Promise.resolve(null);
    var attempt = function (u) {
      return bounded(parentSignal, config.coverTimeout, function (signal) {
        return fetch(u, { mode: "cors", signal: signal }).then(function (r) {
          if (!r.ok) throw new Error("cover " + r.status);
          return r.blob();
        });
      }).then(function (b) {
        if (!b || !b.size || !/^image\//.test(b.type)) throw new Error("cover type");
        return shrinkCover(b);
      });
    };
    return attempt(url).catch(function () {
      if (parentSignal.aborted) return null;
      // A cached response without CORS headers can poison the first try; bust it once.
      return attempt(url + (url.indexOf("?") < 0 ? "?" : "&") + "sfdl=1").catch(function () { return null; });
    });
  }

  function fetchLyrics(id, parentSignal) {
    return bounded(parentSignal, config.lyricsTimeout, function (signal) {
      return fetch(apiBase() + "/lyrics?id=" + encodeURIComponent(id), { signal: signal, credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error("lyrics " + r.status); return r.json(); });
    }).then(function (j) {
      if (!j || j.error) return null;
      return {
        synced: Array.isArray(j.synced) ? j.synced : [],
        plain: typeof j.plain === "string" ? j.plain : "",
        instrumental: !!j.instrumental
      };
    }).catch(function () { return null; });
  }

  function canPlay(mime) {
    try {
      var a = new Audio();
      if (a.canPlayType(mime)) return true;
      // Servers label AAC-in-MP4 variously; the container is what the decoder cares about.
      if (/^(audio|video)\/(x-m4a|m4a|mp4a-latm|aac)$/.test(mime)) return !!a.canPlayType("audio/mp4");
      return false;
    } catch (e) { return false; }
  }

  // Download + validate the audio into memory. Returns {blob, mime}.
  async function fetchAudio(job) {
    var ctrl = job.ctrl;
    var headerTimer = setTimeout(function () { job.why = "timeout"; ctrl.abort(); }, config.headerTimeout);
    var r;
    try {
      r = await fetch(apiBase() + "/audio?id=" + encodeURIComponent(job.id), { signal: ctrl.signal, credentials: "same-origin" });
    } finally { clearTimeout(headerTimer); }
    if (job.dead) throw failure("cancel", true);

    if (!r.ok) {
      var st = r.status;
      if (st === 401 || st === 403) throw failure("auth " + st, true);
      if (st === 404) throw failure("not found", true);
      if (st >= 400 && st < 500 && st !== 408 && st !== 429) throw failure("http " + st, true);
      throw failure("http " + st, false);
    }
    var mime = (r.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!/^(audio|video)\//.test(mime)) throw failure("bad response", true);
    if (!canPlay(mime)) throw failure("unsupported", true);
    var len = parseInt(r.headers.get("Content-Length"), 10);
    if (!(len > 0)) len = 0;
    if (!r.body || !r.body.getReader) throw failure("no stream", true);

    setState(job, "downloading", len ? 0 : null, null);
    var reader = r.body.getReader();
    var chunks = [];
    var got = 0, lastEmit = Date.now(), lastPct = len ? 0 : -1;
    var stall = null;
    var arm = function () {
      clearTimeout(stall);
      stall = setTimeout(function () { job.why = "stall"; ctrl.abort(); }, config.stallTimeout);
    };
    arm();
    try {
      for (;;) {
        var step = await reader.read();
        if (job.dead) throw failure("cancel", true);
        if (step.done) break;
        chunks.push(step.value);
        got += step.value.length;
        arm();
        if (len) {
          var pct = Math.min(99, Math.floor(got / len * 100));
          var now = Date.now();
          if (pct !== lastPct && now - lastEmit >= config.progressInterval) {
            lastPct = pct; lastEmit = now;
            job.pct = pct;
            emitChange(job);
          }
        }
      }
    } finally {
      clearTimeout(stall);
      try { reader.releaseLock(); } catch (e) { }
    }
    if (len && got !== len) { chunks.length = 0; throw failure("truncated", false); }
    if (!got) throw failure("empty", false);
    var blob = new Blob(chunks, { type: mime });
    chunks.length = 0; // drop the pieces; the Blob owns the data now
    return { blob: blob, mime: mime };
  }

  async function commit(meta, audio, cover) {
    var d = await getDB();
    var tx = d.transaction(["meta", "blobs"], "readwrite");
    var done = txP(tx);
    done.catch(function () { }); // avoid an unhandled rejection if put() throws below
    tx.objectStore("meta").put(meta);
    tx.objectStore("blobs").put({ id: meta.id, audio: audio, cover: cover });
    await done;
  }

  async function runJob(job) {
    try {
      var got = await fetchAudio(job);
      if (job.dead) return;
      var cover = await fetchCover(job.track.thumb, job.ctrl.signal);
      if (job.dead) return;
      var lyrics = await fetchLyrics(job.id, job.ctrl.signal);
      if (job.dead) return;

      var t = job.track;
      var meta = {
        id: t.id, title: t.title, artist: t.artist, artistId: t.artistId,
        album: t.album, albumId: t.albumId, duration: t.duration, thumb: t.thumb,
        size: got.blob.size, mime: got.mime, ts: Date.now(),
        lyrics: lyrics, hasCover: !!cover
      };
      await commit(meta, got.blob, cover);
      got = null; cover = null;
      if (job.dead) return; // removed while committing: remove() deletes the records afterwards
      ids.add(t.id);
      sizes.set(t.id, meta.size);
      invalidateCover(t.id);
      jobs.delete(t.id);
      job.s = "done"; job.pct = 100; job.err = null;
      emitChange(job);
      emit("list", {});
      persistQueue();
      if (!persistTried) { persistTried = true; api.persist(); }
    } catch (e) {
      if (job.dead) return;
      if (isQuota(e)) onQuota(job);
      else if (job.why === "timeout") failJob(job, "timeout", false);
      else if (job.why === "stall") failJob(job, "stalled", false);
      else if (e && e.fatal) failJob(job, e.message, true);
      else failJob(job, e && e.message === "truncated" ? "truncated" : "network", false);
    }
    pump();
  }

  function startJob(job) {
    job.ctrl = new AbortController();
    job.why = null;
    setState(job, "preparing", null, null);
    runJob(job);
  }

  // ---- public: lifecycle ---------------------------------------------------
  api.init = function () {
    if (initPromise) return initPromise;
    initPromise = (async function () {
      try {
        if (!api.supported) return;
        try {
          var d = await getDB();
          var all = await reqP(d.transaction("meta", "readonly").objectStore("meta").getAll());
          all.forEach(function (m) { ids.add(String(m.id)); sizes.set(String(m.id), m.size || 0); });
        } catch (e) {
          // Private mode / blocked / corrupt: behave as "unsupported" rather than throwing.
          api.supported = false; db = null;
          jobs.forEach(function (j) { dropJob(j); });
          return;
        }
        // Jobs created before init finished may now be redundant.
        jobs.forEach(function (j, id) { if (ids.has(id)) { dropJob(j); } });
        var stored = [];
        try { stored = JSON.parse(lsGet(LS_QUEUE) || "[]"); } catch (e) { }
        ready = true;
        asArray(stored).forEach(enqueue);
        persistQueue();
        pump();
        emit("list", {});
      } catch (e) { /* never reject */ }
    })();
    return initPromise;
  };

  // ---- public: queries -----------------------------------------------------
  api.has = function (id) { return ids.has(String(id)); };

  api.state = function (id) {
    id = String(id);
    var j = jobs.get(id);
    if (j) return { s: j.s, pct: j.pct, err: j.err };
    if (ids.has(id)) return { s: "done", pct: 100, err: null };
    return { s: "none", pct: null, err: null };
  };

  api.getBlob = function (id) {
    if (!api.supported) return Promise.resolve(null);
    return api.init().then(function () {
      return getDB().then(function (d) { return reqP(d.transaction("blobs", "readonly").objectStore("blobs").get(String(id))); });
    }).then(function (rec) { return rec && rec.audio ? rec.audio : null; }, function () { return null; });
  };

  api.getMeta = function (id) {
    if (!api.supported) return Promise.resolve(null);
    return api.init().then(function () {
      return getDB().then(function (d) { return reqP(d.transaction("meta", "readonly").objectStore("meta").get(String(id))); });
    }).then(function (m) { return m || null; }, function () { return null; });
  };

  function invalidateCover(id) {
    var p = coverCache.get(id);
    if (!p) return;
    coverCache.delete(id);
    p.then(function (u) { if (u) URL.revokeObjectURL(u); }, function () { });
  }

  api.coverURL = function (id) {
    id = String(id);
    if (!api.supported) return Promise.resolve(null);
    var hit = coverCache.get(id);
    if (hit) { coverCache.delete(id); coverCache.set(id, hit); return hit; } // refresh LRU position
    var p = api.init().then(function () {
      return getDB().then(function (d) { return reqP(d.transaction("blobs", "readonly").objectStore("blobs").get(id)); });
    }).then(function (rec) {
      return rec && rec.cover ? URL.createObjectURL(rec.cover) : null;
    }, function () { return null; });
    coverCache.set(id, p);
    // Bound the number of live object URLs; the oldest are revoked (they get re-created on demand).
    while (coverCache.size > COVER_CACHE_MAX) invalidateCover(coverCache.keys().next().value);
    return p;
  };

  api.list = function () {
    if (!api.supported) return Promise.resolve([]);
    return api.init().then(function () {
      return getDB().then(function (d) { return reqP(d.transaction("meta", "readonly").objectStore("meta").getAll()); });
    }).then(function (all) {
      return all.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    }, function () { return []; });
  };

  api.usage = function () {
    var out = { count: 0, bytes: 0, quota: null, usage: null, persisted: false };
    if (!api.supported) return Promise.resolve(out);
    return api.init().then(function () {
      out.count = ids.size;
      sizes.forEach(function (b) { out.bytes += b; });
      var st = (typeof navigator !== "undefined" && navigator.storage) || null;
      var tasks = [];
      if (st && st.estimate) tasks.push(st.estimate().then(function (e) { out.quota = e.quota == null ? null : e.quota; out.usage = e.usage == null ? null : e.usage; }, function () { }));
      if (st && st.persisted) tasks.push(st.persisted().then(function (p) { out.persisted = !!p; }, function () { }));
      return Promise.all(tasks);
    }).then(function () { return out; }, function () { return out; });
  };

  api.persist = function () {
    try {
      var st = navigator.storage;
      if (st && st.persist) return st.persist().then(function (v) { return !!v; }, function () { return false; });
    } catch (e) { }
    return Promise.resolve(false);
  };

  // ---- public: queue control -----------------------------------------------
  function enqueue(raw) {
    var t = normTrack(raw);
    if (!t || ids.has(t.id)) return null;
    var cur = jobs.get(t.id);
    if (cur) {
      if (cur.s !== "failed") return cur; // duplicate: merge into the live job
      cur.track = t; cur.tries = 0;      // re-requesting a failed track restarts it
      setState(cur, "queued", null, null);
      return cur;
    }
    var job = { id: t.id, track: t, s: "queued", pct: null, err: null, tries: 0, timer: null, ctrl: null, dead: false, why: null };
    jobs.set(t.id, job);
    emitChange(job);
    return job;
  }

  api.download = function (tracks) {
    if (!api.supported) return;
    api.init();
    asArray(tracks).forEach(enqueue);
    persistQueue();
    pump();
  };

  api.cancel = function (id) {
    id = String(id);
    var j = jobs.get(id);
    if (!j) return;
    dropJob(j);
    emit("change", { id: id, s: "none", pct: null, err: null });
    persistQueue();
    pump();
  };

  api.retry = function (id) {
    var j = jobs.get(String(id));
    quotaPaused = false;
    if (j && j.s === "failed") { j.tries = 0; setState(j, "queued", null, null); persistQueue(); }
    pump();
  };

  api.clearQuotaPause = function () { quotaPaused = false; pump(); };

  api.remove = function (idOrIds) {
    var list = asArray(idOrIds).map(String);
    // Cancel synchronously so a running job can never re-create the record afterwards.
    list.forEach(function (id) {
      var j = jobs.get(id);
      if (j) { dropJob(j); emit("change", { id: id, s: "none", pct: null, err: null }); }
    });
    persistQueue();
    if (!api.supported || !list.length) return Promise.resolve();
    return api.init().then(function () {
      var had = list.filter(function (id) { return ids.has(id); });
      return getDB().then(function (d) {
        var tx = d.transaction(["meta", "blobs"], "readwrite");
        var done = txP(tx);
        list.forEach(function (id) { tx.objectStore("meta").delete(id); tx.objectStore("blobs").delete(id); });
        return done;
      }).then(function () {
        had.forEach(function (id) {
          ids.delete(id); sizes.delete(id); invalidateCover(id);
          emit("change", { id: id, s: "none", pct: null, err: null });
        });
        quotaPaused = false;
        if (had.length) emit("list", {});
        pump();
      });
    }).catch(function () { });
  };

  api.removeAll = function () {
    Array.from(jobs.values()).forEach(function (j) { dropJob(j); emit("change", { id: j.id, s: "none", pct: null, err: null }); });
    sets = {}; saveSets();
    persistQueue();
    if (!api.supported) return Promise.resolve();
    return api.init().then(function () {
      return getDB().then(function (d) {
        var tx = d.transaction(["meta", "blobs"], "readwrite");
        var done = txP(tx);
        tx.objectStore("meta").clear(); tx.objectStore("blobs").clear();
        return done;
      }).then(function () {
        var gone = Array.from(ids);
        ids.clear(); sizes.clear();
        Array.from(coverCache.keys()).forEach(invalidateCover);
        quotaPaused = false;
        gone.forEach(function (id) { emit("change", { id: id, s: "none", pct: null, err: null }); });
        emit("list", {});
      });
    }).catch(function () { });
  };

  api.setConcurrency = function (n) {
    n = Math.round(Number(n));
    concurrency = n >= 1 && n <= 3 ? n : n > 3 ? 3 : 1;
    pump();
  };
  api.pause = function () { userPaused = true; };
  api.resume = function () { userPaused = false; pump(); };
  api.isPaused = function () { return { user: userPaused, quota: quotaPaused }; };

  // ---- public: collections ---------------------------------------------------
  api.isSet = function (key) { return Object.prototype.hasOwnProperty.call(sets, String(key)); };

  api.setSet = function (key, on, tracks) {
    key = String(key);
    if (!api.supported) return Promise.resolve();
    var list = asArray(tracks).map(normTrack).filter(Boolean);
    if (on) {
      // Calling again while ON refreshes the set's track list (playlist grew) and queues the new ones.
      sets[key] = list.map(function (t) { return t.id; });
      saveSets();
      api.download(list);
      return Promise.resolve();
    }
    var mine = (sets[key] || []).concat(list.map(function (t) { return t.id; }));
    delete sets[key];
    saveSets();
    var needed = new Set();
    Object.keys(sets).forEach(function (k) { sets[k].forEach(function (id) { needed.add(id); }); });
    // Note: a track downloaded by hand AND listed in this set is removed too; we can't tell them apart.
    var drop = Array.from(new Set(mine)).filter(function (id) { return !needed.has(id); });
    drop.forEach(function (id) { var j = jobs.get(id); if (j) { dropJob(j); emit("change", { id: id, s: "none", pct: null, err: null }); } });
    persistQueue();
    return api.remove(drop);
  };

  api.setProgress = function (tracks) {
    var list = asArray(tracks);
    var r = { done: 0, total: list.length, active: 0 };
    list.forEach(function (t) {
      var id = String(t && t.id != null ? t.id : t);
      if (ids.has(id)) r.done++;
      else { var j = jobs.get(id); if (j && j.s !== "failed") r.active++; }
    });
    return r;
  };

  // ---- public: events --------------------------------------------------------
  api.on = function (ev, cb) { if (listeners[ev] && typeof cb === "function") listeners[ev].add(cb); };
  api.off = function (ev, cb) { if (listeners[ev]) listeners[ev].delete(cb); };

  // Coming back online: retry waiting jobs now instead of after the remaining backoff.
  // Never touches user/quota pauses (pump() honours them).
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", function () {
      jobs.forEach(function (j) { if (j.timer) { clearTimeout(j.timer); j.timer = null; } });
      pump();
    });
  }

  window.Offline = api;
})();
