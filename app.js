(function () {
  const RAW = window.OUTLET_DATA;
  const outlets = RAW.rows.map((r, idx) => {
    const o = { _i: idx };
    RAW.cols.forEach((c, i) => { o[c] = r[i]; });
    o._status = normStatus(o["Status FU/NOO"]);
    o._search = [o["Nama Toko"], o.Pemilik, o.Kelurahan, o.Kecamatan, o.RSM, o["Status FU/NOO"], o["Kode Outlet"],
      o["Beli S7K - Nama"], o["Beli S7K - Lokasi"], o["Beli BB - Nama"], o["Grosir BB"], o.Sales]
      .join(" ").toLowerCase();
    return o;
  });

  // "Punya data": kolom yang terisi
  const HAS = { "Kode outlet": "Kode Outlet", "Status FU/NOO": "Status FU/NOO", "Transaksi Collagena": "Transaksi Collagena",
    "Transaksi S7K Kids": "Transaksi S7K Kids", "Info grosir S7K": "Beli S7K - Nama", "Foto toko": "Foto Toko" };
  const PHOTO_COLS = ["Foto Toko", "Foto Chiller"];
  const PAGE = 50;
  const LS_KEY = "maps-beruang-visits";
  const COLOR_VISITED = "#16a34a";
  const COLOR_PENDING = "#ea580c";

  const state = { has: new Set(), sort: "Nama Toko", asc: true, page: 0 };
  let filtered = outlets;

  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat("id-ID");
  const pctOf = (a, n) => (n ? Math.round((a / n) * 100) + "%" : "–");

  function splitList(s) { return (s || "").split(",").map((x) => x.trim()).filter(Boolean); }
  // Status FU/NOO diisi bebas oleh tiap area; samakan huruf & spasi untuk filter/ringkasan
  function normStatus(s) { return String(s || "").replace(/\s+/g, " ").trim().toUpperCase(); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function uniq(list, key) {
    return [...new Set(list.map((o) => o[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  }
  function countBy(list, fn) {
    const m = new Map();
    list.forEach((o) => [].concat(fn(o)).forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }
  function fillSelect(el, values, keep) {
    const cur = keep ? el.value : "";
    el.innerHTML = '<option value="">Semua</option>' +
      values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    el.value = values.includes(cur) ? cur : "";
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  // ---------- visit store ----------
  // Di claude.ai tanda kunjungan disimpan bersama lewat `db`; di tempat lain lewat Google Sheet
  // tim (window.VISITS_API, lihat apps-script/Code.gs), atau di browser ini saja bila belum diatur.
  const API = window.VISITS_API || "";
  const API_KEY_LS = "maps-beruang-team-key";
  const NAME_LS = "maps-beruang-name";
  const visits = new Map();
  const store = {
    mode: window.claude?.use ? "pending" : API ? "api" : "local",
    db: null, user: null, uid: null, canWrite: true, needKey: false, loadedAt: null,
  };
  const isVisited = (o) => !!visits.get(o.id)?.visited;

  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }

  async function apiLoad() {
    const res = await fetch(API + "?key=" + encodeURIComponent(lsGet(API_KEY_LS)));
    const j = await res.json();
    if (!j.ok) {
      store.needKey = j.error === "kode";
      renderSyncNote();
      throw { code: j.error };
    }
    store.needKey = false;
    store.loadedAt = new Date();
    // Gambar ulang hanya bila data kunjungan memang berubah (supaya popup/ketukan tidak terganggu)
    const sig = JSON.stringify(j.visits);
    renderSyncNote();
    if (sig === store.lastSig) return;
    store.lastSig = sig;
    visits.clear();
    j.visits.forEach((v) => visits.set(v.id, v));
    refresh();
  }

  async function apiSave(o, rec) {
    const body = Object.assign({
      key: lsGet(API_KEY_LS), id: o.id, nama: o["Nama Toko"], rsm: o.RSM,
      kecamatan: o.Kecamatan, kelurahan: o.Kelurahan, remove: !rec,
    }, rec || {});
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!j.ok) {
      if (j.error === "kode") { store.needKey = true; renderSyncNote(); }
      throw { code: j.error === "kode" ? "kode" : "api" };
    }
  }

  function loadLocal() {
    try {
      Object.entries(JSON.parse(localStorage.getItem(LS_KEY) || "{}")).forEach(([k, v]) => visits.set(k, v));
    } catch (e) { /* storage tidak tersedia */ }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(visits))); } catch (e) { /* abaikan */ }
  }
  function renderSyncNote() {
    const text = {
      pending: "Menghubungkan penyimpanan…",
      shared: store.canWrite ? "Tanda kunjungan tersimpan bersama untuk semua yang membuka halaman ini" : "Kamu hanya bisa melihat tanda kunjungan",
      local: "Tanda kunjungan tersimpan di browser ini saja",
      api: store.needKey ? "Masukkan kode tim untuk melihat dan menandai kunjungan"
        : store.loadedAt ? "Tanda kunjungan tersimpan di Google Sheet tim · dimuat " +
          store.loadedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "Memuat tanda kunjungan dari Google Sheet…",
    }[store.mode];
    $("syncNote").textContent = text;
    $("keyForm").hidden = !store.needKey;
  }

  $("keyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    lsSet(API_KEY_LS, $("teamKey").value.trim());
    apiLoad().catch(() => {});
  });

  async function initStore() {
    if (store.mode === "local") { loadLocal(); renderSyncNote(); return; }
    if (store.mode === "api") {
      renderSyncNote();
      const load = () => apiLoad().catch((err) => {
        if (err?.code !== "kode") $("syncNote").textContent = "Gagal memuat dari Google Sheet. Mencoba lagi sebentar lagi…";
      });
      load();
      setInterval(() => { if (!document.hidden) load(); }, 30000);
      return;
    }
    renderSyncNote();
    const db = await window.claude.use("db");
    if (!db) { store.mode = "local"; loadLocal(); renderSyncNote(); refresh(); return; }
    store.db = db;
    store.user = await window.claude.use("user");
    store.uid = store.user ? await store.user.id() : null;
    store.canWrite = (store.user ? await store.user.can("data.write") : null) !== false;
    store.mode = "shared";
    renderSyncNote();
    db.collection("visits").onSnapshot((snap) => {
      visits.clear();
      snap.docs.forEach((d) => visits.set(d.id, d.data()));
      refresh();
    }, () => {
      $("syncNote").textContent = "Koneksi penyimpanan terputus. Muat ulang halaman untuk menyambung lagi.";
    });
  }

  async function saveVisit(o, rec) {
    const id = o.id;
    if (store.mode === "api") {
      await apiSave(o, rec);
      if (rec) visits.set(id, rec); else visits.delete(id);
      refresh();
      return;
    }
    if (store.mode === "shared") {
      const ref = store.db.doc("visits/" + id);
      if (rec) await ref.set(rec); else await ref.delete();
      return;
    }
    if (rec) visits.set(id, rec); else visits.delete(id);
    saveLocal();
    refresh();
  }

  async function names(ids) {
    const list = [...new Set(ids.filter(Boolean))];
    // Di Google Sheet, `by` sudah berupa nama yang diketik petugas.
    if (store.mode === "api") return Object.fromEntries(list.map((n) => [n, n]));
    if (!store.user || !list.length) return {};
    const ps = await store.user.profiles(list);
    return Object.fromEntries(list.map((id) => [id, ps[id]?.name || ""]));
  }

  // ---------- filters ----------
  const selects = {
    fRsm: "RSM", fKota: "Kota", fKec: "Kecamatan", fKel: "Kelurahan", fSeg: "Segmen", fStatus: "_status",
  };
  fillSelect($("fRsm"), uniq(outlets, "RSM"));
  fillSelect($("fSeg"), countBy(outlets, (o) => o.Segmen).map(([k]) => k));
  fillSelect($("fStatus"), countBy(outlets, (o) => o._status).map(([k]) => k));

  function cascade() {
    const rsm = $("fRsm").value;
    const byRsm = rsm ? outlets.filter((o) => o.RSM === rsm) : outlets;
    fillSelect($("fKota"), uniq(byRsm, "Kota"), true);
    const kota = $("fKota").value;
    const byKota = kota ? byRsm.filter((o) => o.Kota === kota) : byRsm;
    fillSelect($("fKec"), uniq(byKota, "Kecamatan"), true);
    const kec = $("fKec").value;
    fillSelect($("fKel"), uniq(kec ? byKota.filter((o) => o.Kecamatan === kec) : byKota, "Kelurahan"), true);
  }
  cascade();

  function makeChips(el, items, set) {
    el.innerHTML = items.map((b) => `<button type="button" class="chip" data-v="${esc(b)}">${esc(b)}</button>`).join("");
    el.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const v = btn.dataset.v;
      set.has(v) ? set.delete(v) : set.add(v);
      btn.classList.toggle("on", set.has(v));
      apply();
    });
  }
  makeChips($("fHas"), Object.keys(HAS), state.has);

  Object.keys(selects).concat("fVisit", "fRadius").forEach((id) => $(id).addEventListener("change", () => {
    if (id === "fRsm" || id === "fKota" || id === "fKec") cascade();
    apply();
  }));
  let t;
  $("fSearch").addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 150); });
  $("btnReset").addEventListener("click", () => {
    $("fSearch").value = "";
    $("fVisit").value = "";
    $("fRadius").value = "";
    Object.keys(selects).forEach((id) => { $(id).value = ""; });
    state.has.clear();
    document.querySelectorAll(".chip.on").forEach((c) => c.classList.remove("on"));
    cascade(); apply();
  });
  // Di HP filter tampil sebagai panel penuh
  const setFilters = (open) => { $("filters").classList.toggle("open", open); document.body.classList.toggle("no-scroll", open); };
  $("btnFilters").addEventListener("click", () => setFilters(!$("filters").classList.contains("open")));
  $("btnCloseFilters").addEventListener("click", () => setFilters(false));
  $("filterCount").addEventListener("click", () => { setFilters(false); window.scrollTo({ top: 0, behavior: "smooth" }); });

  function apply(keepView) {
    const q = $("fSearch").value.trim().toLowerCase();
    const visit = $("fVisit").value;
    const radius = me.lat != null ? +$("fRadius").value : 0;
    const sel = Object.entries(selects).map(([id, key]) => [key, $(id).value]).filter(([, v]) => v);
    filtered = outlets.filter((o) => {
      if (q && !o._search.includes(q)) return false;
      if (visit && (visit === "sudah") !== isVisited(o)) return false;
      if (radius && o._dist > radius) return false;
      for (const [k, v] of sel) if (o[k] !== v) return false;
      for (const h of state.has) if (!o[HAS[h]]) return false;
      return true;
    });
    if (!keepView) state.page = 0;
    renderKpis(); renderMap(keepView); renderNearby(); renderFilterBadge();
    dirty.table = dirty.summary = true;
    renderVisiblePanels();
  }
  // Tabel & ringkasan hanya digambar bila tab-nya sedang dibuka
  const dirty = { table: true, summary: true };
  let activeTab = "map";
  function renderVisiblePanels() {
    if (activeTab === "table" && dirty.table) { renderTable(); dirty.table = false; }
    if (activeTab === "summary" && dirty.summary) { renderSummary(); dirty.summary = false; }
  }
  function renderFilterBadge() {
    const n = Object.keys(selects).filter((id) => $(id).value).length + state.has.size +
      ["fSearch", "fVisit", "fRadius"].filter((id) => $(id).value).length;
    $("btnFilters").textContent = n ? `Filter (${n})` : "Filter";
    $("filterCount").textContent = `Lihat ${fmt.format(filtered.length)} outlet`;
  }
  // Dipanggil saat data kunjungan berubah: jangan geser peta atau halaman tabel.
  function refresh() { apply(true); }

  // ---------- KPIs ----------
  function renderKpis() {
    const n = filtered.length;
    const kec = new Set(filtered.map((o) => o.Kecamatan)).size;
    const solus = filtered.filter((o) => o.Segmen === "Solus BB").length;
    const withStatus = filtered.filter((o) => o._status).length;
    const withCode = filtered.filter((o) => o["Kode Outlet"]).length;
    const rsm = new Set(filtered.map((o) => o.RSM)).size;
    const visited = filtered.filter(isVisited).length;
    $("kpis").innerHTML = [
      ["Jumlah outlet", fmt.format(n), `dari ${fmt.format(outlets.length)} total`],
      ["Sudah didatangi", fmt.format(visited), n ? `${Math.round((visited / n) * 100)}% · ${fmt.format(n - visited)} belum` : "–"],
      ["Kecamatan", fmt.format(kec), `${new Set(filtered.map((o) => o.Kelurahan)).size} kelurahan`],
      ["Solus BB", fmt.format(solus), `${pctOf(solus, n)} dari outlet`],
      ["Ada status FU/NOO", fmt.format(withStatus), `${pctOf(withStatus, n)} · ${rsm} RSM`],
      ["Punya kode outlet", fmt.format(withCode), pctOf(withCode, n)],
    ].map(([l, v, h]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="hint">${h}</div></div>`).join("");
  }

  // ---------- map ----------
  const touch = matchMedia("(pointer: coarse)").matches;
  // tolerance: area ketuk titik diperbesar supaya mudah diketuk di HP
  const map = L.map("map", { preferCanvas: true, renderer: L.canvas({ tolerance: touch ? 12 : 4 }), maxZoom: 19, tap: false })
    .setView([-6.22, 106.88], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  const cluster = L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 60 });
  map.addLayer(cluster);

  const markerCache = new Map();
  let shownKey = "";
  function popupHtml(o) {
    const done = isVisited(o);
    return `<div class="pop-title">${esc(o["Nama Toko"])}</div>
        <div><span class="pill ${done ? "pill-done" : "pill-todo"}">${done ? "Sudah didatangi" : "Belum didatangi"}</span>
          <span class="tag">${esc(o.Segmen)}</span></div>
        <div class="pop-sub">${esc(o.Pemilik ? "Pemilik " + o.Pemilik + " · " : "")}${esc(o.Kelurahan)}, ${esc(o.Kecamatan)} · ${esc(o.RSM)}</div>
        ${o["Status FU/NOO"] ? `<div>Status: <b>${esc(o["Status FU/NOO"])}</b></div>` : ""}
        <div class="pop-actions"><button class="btn pop-btn" data-open="${o._i}">Lihat detail</button>
          <a class="btn btn-ghost pop-btn" href="${routeUrl(o)}" target="_blank" rel="noopener">Rute ↗</a></div>`;
  }
  function markerFor(o) {
    let m = markerCache.get(o._i);
    if (!m) {
      m = L.circleMarker([o.latitude, o.longitude], { radius: touch ? 9 : 7, weight: 2, color: "#fff", fillOpacity: 0.95 });
      m.bindPopup(() => popupHtml(o), { maxWidth: 280 }); // isi dibuat saat dibuka → status selalu terbaru
      markerCache.set(o._i, m);
    }
    m.setStyle({ fillColor: isVisited(o) ? COLOR_VISITED : COLOR_PENDING });
    return m;
  }
  function renderMap(keepView) {
    const list = filtered.filter((o) => o.latitude && o.longitude);
    const key = list.length + ":" + list.map((o) => o._i).join(",");
    const markers = list.map(markerFor);
    if (key === shownKey) return; // isi sama: cukup warna yang diperbarui
    shownKey = key;
    cluster.clearLayers();
    cluster.addLayers(markers);
    if (markers.length && !keepView) map.fitBounds(cluster.getBounds(), { padding: [30, 30], maxZoom: 16 });
  }
  function routeUrl(o) { return `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`; }
  // ---------- lokasi saya ----------
  const me = { lat: null, lng: null, acc: null, watch: null, picking: false, appliedAt: null, shown: 10 };
  const meLayer = L.layerGroup().addTo(map);

  function distM(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(a));
  }
  function fmtDist(m) {
    if (m < 1000) return Math.round(m / 10) * 10 + " m";
    return (m / 1000).toLocaleString("id-ID", { maximumFractionDigits: m < 10000 ? 1 : 0 }) + " km";
  }
  function setLocNote(text) { $("locNote").textContent = text; }

  function setMe(lat, lng, acc, recenter, manual) {
    const first = me.lat == null;
    const moved = me.appliedAt ? distM(me.appliedAt[0], me.appliedAt[1], lat, lng) : Infinity;
    Object.assign(me, { lat, lng, acc });
    meLayer.clearLayers();
    // interactive:false → titik lokasi tidak menghalangi ketukan ke outlet di bawahnya
    if (acc) L.circle([lat, lng], { radius: acc, color: "#2563eb", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(meLayer);
    L.circleMarker([lat, lng], { radius: 8, weight: 3, color: "#fff", fillColor: "#2563eb", fillOpacity: 1, interactive: false })
      .addTo(meLayer);
    $("fRadius").disabled = false;
    setLocNote(manual ? "Memakai titik yang kamu pilih di peta."
      : `Lokasi ditemukan${acc ? ` (akurasi ± ${fmtDist(acc)})` : ""}. Daftar diperbarui saat kamu bergerak.`);
    // Hitung ulang hanya bila bergeser cukup jauh, supaya peta tidak digambar ulang terus-menerus.
    if (moved > 30) {
      outlets.forEach((o) => { o._dist = o.latitude && o.longitude ? distM(lat, lng, o.latitude, o.longitude) : null; });
      me.appliedAt = [lat, lng];
      if (first) { state.sort = "_dist"; state.asc = true; }
      apply(true);
    }
    if (recenter) map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }

  function startPick(reason) {
    me.picking = true;
    $("map").classList.add("picking");
    setLocNote((reason ? reason + " " : "") + "Ketuk peta di posisi kamu untuk memakai titik itu.");
  }
  map.on("click", (e) => {
    if (!me.picking) return;
    me.picking = false;
    $("map").classList.remove("picking");
    if (me.watch != null) { navigator.geolocation.clearWatch(me.watch); me.watch = null; }
    setMe(e.latlng.lat, e.latlng.lng, null, false, true);
  });

  function locate() {
    if (!navigator.geolocation) { startPick("Browser ini tidak bisa membaca lokasi."); return; }
    setLocNote("Mencari lokasi…");
    navigator.geolocation.getCurrentPosition((pos) => {
      setMe(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, true);
      if (me.watch == null) {
        me.watch = navigator.geolocation.watchPosition(
          (p) => setMe(p.coords.latitude, p.coords.longitude, p.coords.accuracy, false),
          () => {}, { enableHighAccuracy: true, maximumAge: 15000 });
      }
    }, (err) => {
      startPick(err.code === 1 ? "Izin lokasi ditolak atau tidak tersedia di halaman ini."
        : "Lokasi belum ditemukan. Pastikan GPS menyala.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }
  $("btnLocate").addEventListener("click", locate);
  $("btnPick").addEventListener("click", () => startPick(""));

  const LocateControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const b = L.DomUtil.create("button", "locate-btn");
      b.type = "button";
      b.title = "Lokasi saya";
      b.setAttribute("aria-label", "Lokasi saya");
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", locate);
      return b;
    },
  });
  map.addControl(new LocateControl());

  function renderNearby() {
    const list = $("nearbyList");
    if (me.lat == null) { list.innerHTML = ""; $("nearbyMore").hidden = true; return; }
    const near = filtered.filter((o) => o._dist != null).sort((a, b) => a._dist - b._dist);
    list.innerHTML = near.slice(0, me.shown).map((o) => {
      const done = isVisited(o);
      return `<li class="near-item">
        <span class="near-dist">${fmtDist(o._dist)}</span>
        <button type="button" class="near-main" data-open="${o._i}">
          <b>${esc(o["Nama Toko"])}</b>
          <small>${esc([o.Kelurahan, o.Segmen, o["Status FU/NOO"]].filter(Boolean).join(" · "))}</small>
        </button>
        <span class="pill ${done ? "pill-done" : "pill-todo"}">${done ? "Sudah" : "Belum"}</span>
        <a class="near-route" href="${routeUrl(o)}" target="_blank" rel="noopener">Rute ↗</a>
      </li>`;
    }).join("") || '<li class="near-empty">Tidak ada outlet yang cocok dengan filter di sekitar lokasi ini.</li>';
    $("nearbyMore").hidden = near.length <= me.shown;
  }
  $("nearbyList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openDetail(+b.dataset.open);
  });
  $("nearbyMore").addEventListener("click", () => { me.shown += 10; renderNearby(); });

  map.on("popupopen", (e) => {
    const b = e.popup.getElement().querySelector("[data-open]");
    if (b) b.addEventListener("click", () => openDetail(+b.dataset.open));
  });

  // ---------- table ----------
  document.querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    state.asc = state.sort === k ? !state.asc : true;
    state.sort = k; state.page = 0;
    renderTable();
  }));
  $("prev").addEventListener("click", () => { state.page--; renderTable(); });
  $("next").addEventListener("click", () => { state.page++; renderTable(); });

  function renderTable() {
    const k = state.sort, dir = state.asc ? 1 : -1;
    const rows = [...filtered].sort((a, b) => {
      if (k === "_visit") return (isVisited(a) - isVisited(b)) * dir;
      if (k === "_dist") return ((a._dist ?? Infinity) - (b._dist ?? Infinity)) * dir;
      return String(a[k]).localeCompare(String(b[k]), "id") * dir;
    });
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    state.page = Math.min(Math.max(0, state.page), pages - 1);
    const slice = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
    document.querySelector("#tbl tbody").innerHTML = slice.map((o) => {
      const v = visits.get(o.id);
      const done = !!v?.visited;
      return `<tr data-i="${o._i}">
      <td><span class="pill ${done ? "pill-done" : "pill-todo"}">${done ? "Sudah" : "Belum"}</span></td>
      <td>${esc(o["Nama Toko"])}</td><td>${esc(o.Pemilik)}</td><td>${esc(o.RSM)}</td><td>${esc(o.Segmen)}</td>
      <td>${esc(o.Kecamatan)}</td><td>${esc(o.Kelurahan)}</td><td>${esc(o["Status FU/NOO"])}</td>
      <td>${esc(o["Kode Outlet"])}</td><td>${esc(o["Transaksi Collagena"])}</td><td>${esc(o["Transaksi S7K"])}</td>
      <td>${esc(o["Transaksi S7K Kids"])}</td><td>${esc(o["Beli Collagena di"])}</td>
      <td>${esc([o["Beli S7K - Nama"], o["Beli S7K - Lokasi"]].filter(Boolean).join(" — "))}</td>
      <td>${esc([o["Beli BB - Nama"] || o["Grosir BB"], o["Beli BB - Alamat"] || o["Lokasi Grosir BB"]].filter(Boolean).join(" — "))}</td>
      <td>${[["Toko", o["Foto Toko"]], ["Chiller", o["Foto Chiller"]]].filter(([, u]) => u)
        .map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${l}</a>`).join(" · ")}</td>
      <td class="note-cell" title="${esc(v?.note)}">${esc(v?.note)}</td>
      <td class="num dist-col"${me.lat == null ? " hidden" : ""}>${o._dist != null ? fmtDist(o._dist) : ""}</td></tr>`;
    }).join("") ||
      '<tr><td colspan="18">Tidak ada outlet yang cocok dengan filter.</td></tr>';
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === k);
      th.classList.toggle("asc", th.dataset.sort === k && state.asc);
    });
    document.querySelectorAll("th.dist-col").forEach((th) => { th.hidden = me.lat == null; });
    // label kolom untuk tampilan kartu di HP
    const heads = [...document.querySelectorAll("#tbl thead th")].map((th) => th.textContent.replace(/[▴▾]/g, "").trim());
    document.querySelectorAll("#tbl tbody tr[data-i]").forEach((tr) => [...tr.children].forEach((td, i) => {
      td.dataset.label = heads[i] || "";
      if (!td.textContent.trim()) td.classList.add("empty");
    }));
    $("pageInfo").textContent = `Halaman ${state.page + 1} dari ${pages} · ${fmt.format(rows.length)} outlet`;
    $("prev").disabled = state.page === 0;
    $("next").disabled = state.page >= pages - 1;
  }
  document.querySelector("#tbl tbody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-i]");
    if (tr) openDetail(+tr.dataset.i);
  });

  // ---------- summary ----------
  function barCard(title, entries, limit = 12) {
    const top = entries.slice(0, limit);
    const max = top.length ? top[0][1] : 1;
    return `<div class="card"><h3>${title}</h3>${top.map(([k, v]) => `<div class="bar-row">
      <span class="name" title="${esc(k)}">${esc(k)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%"></div></div>
      <span class="count">${fmt.format(v)}</span></div>`).join("") || "<p>Tidak ada data.</p>"}</div>`;
  }
  function renderSummary() {
    const val = (k) => (o) => normStatus(o[k]);
    $("charts").innerHTML = [
      barCard("Sudah didatangi per RSM", countBy(filtered.filter(isVisited), (o) => o.RSM), 15),
      barCard("Outlet per RSM", countBy(filtered, (o) => o.RSM), 15),
      barCard("Outlet per Kecamatan", countBy(filtered, (o) => o.Kecamatan), 15),
      barCard("Segmen", countBy(filtered, (o) => o.Segmen)),
      barCard("Status FU / NOO", countBy(filtered, (o) => o._status || "Tidak diisi"), 15),
      barCard("Transaksi Collagena", countBy(filtered, (o) => val("Transaksi Collagena")(o) || "Tidak diisi")),
      barCard("Transaksi S7K Kids", countBy(filtered, (o) => val("Transaksi S7K Kids")(o) || "Tidak diisi")),
      barCard("Beli S7K di (nama)", countBy(filtered, val("Beli S7K - Nama")), 15),
      barCard("Beli S7K di (lokasi)", countBy(filtered, val("Beli S7K - Lokasi")), 15),
      barCard("Beli Bear Brand di", countBy(filtered, (o) => normStatus(o["Beli BB - Nama"] || o["Grosir BB"])), 15),
      barCard("Supplier Bear Brand (Bekasi)", countBy(filtered, (o) => o["Supplier BB"])),
      barCard("Sales (Jaksel 2)", countBy(filtered, (o) => o.Sales)),
    ].join("");
  }

  // ---------- detail ----------
  function kv(pairs) {
    const rows = pairs.filter(([, v]) => v !== "" && v != null);
    return rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : "";
  }
  function section(title, body) { return body ? `<div class="detail-section"><h3>${title}</h3>${body}</div>` : ""; }

  function visitSection(o) {
    const v = visits.get(o.id);
    const locked = store.mode === "pending" || !store.canWrite || store.needKey;
    return `<div class="detail-section visit-box">
      <h3>Kunjungan</h3>
      <label class="check"><input type="checkbox" id="visitDone" ${v?.visited ? "checked" : ""} ${locked ? "disabled" : ""}> Sudah didatangi</label>
      <label class="field"><span>Catatan</span>
        <textarea id="visitNote" rows="3" placeholder="mis. pemilik tertarik, minta dihubungi minggu depan" ${locked ? "disabled" : ""}>${esc(v?.note)}</textarea>
      </label>
      ${store.mode === "api" ? `<label class="field"><span>Nama kamu</span>
        <input type="text" id="visitBy" value="${esc(lsGet(NAME_LS))}" placeholder="mis. Dimas" ${locked ? "disabled" : ""}>
      </label>` : ""}
      <div class="visit-actions">
        <button class="btn" id="visitSave" ${locked ? "disabled" : ""}>Simpan</button>
        <span class="visit-meta" id="visitMeta"></span>
      </div>
    </div>`;
  }

  async function renderVisitMeta(o) {
    const v = visits.get(o.id);
    const el = $("visitMeta");
    if (!el) return;
    if (!v) { el.textContent = store.mode === "pending" ? "Menghubungkan penyimpanan…" : ""; return; }
    const who = (await names([v.by]))[v.by];
    el.textContent = [v.visited && v.visitedAt ? "Didatangi " + fmtDate(v.visitedAt) : "",
      who ? "oleh " + who : "", v.updatedAt ? "· diperbarui " + fmtDate(v.updatedAt) : ""].filter(Boolean).join(" ");
  }

  function openDetail(i) {
    const o = outlets[i];
    const e = (k) => esc(o[k]);
    const photos = PHOTO_COLS.filter((c) => /^https:\/\//.test(o[c]))
      .map((c) => `<figure><a href="${esc(o[c])}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(o[c])}" alt="${esc(c)}" onerror="this.closest('figure').remove()"></a><figcaption>${esc(c)}</figcaption></figure>`)
      .join("");
    const gmaps = `https://www.google.com/maps?q=${o.latitude},${o.longitude}`;
    const join = (...xs) => esc(xs.filter(Boolean).join(" — "));

    $("modalBody").innerHTML = `
      <div class="detail-head"><h2>${e("Nama Toko")}</h2>
        <p><span class="tag">${e("Segmen")}</span> ${esc([o.Kelurahan, o.Kecamatan, o.Kota].filter(Boolean).join(", "))}</p>
        ${o._dist != null ? `<p><b>${fmtDist(o._dist)}</b> dari lokasimu</p>` : ""}
        <div class="detail-links"><a href="${routeUrl(o)}" target="_blank" rel="noopener">🧭 Rute ke outlet ↗</a>
          <a href="${gmaps}" target="_blank" rel="noopener">Buka di Google Maps ↗</a></div></div>
      ${visitSection(o)}
      ${section("Info toko", kv([
        ["Pemilik", e("Pemilik")], ["RSM", e("RSM")], ["Segmen", e("Segmen")],
        ["Kode outlet", e("Kode Outlet")], ["Sales", e("Sales")],
        ["Wilayah", esc([o.Kelurahan, o.Kecamatan, o.Kota].filter(Boolean).join(", "))],
        ["Koordinat", `${o.latitude}, ${o.longitude}`], ["Tanggal survei", e("Tanggal Survei")], ["Sheet asal", e("Sheet")],
      ]))}
      ${section("Status &amp; transaksi", kv([
        ["Status FU / NOO", e("Status FU/NOO")],
        ["Transaksi Collagena (ctn)", e("Transaksi Collagena")],
        ["Transaksi S7K (ctn)", e("Transaksi S7K")],
        ["Transaksi S7K Kids (ctn)", e("Transaksi S7K Kids")],
      ]))}
      ${section("Sumber pembelian", kv([
        ["Collagena", e("Beli Collagena di")],
        ["S7K", join(o["Beli S7K - Nama"], o["Beli S7K - Lokasi"])],
        ["Bear Brand", join(o["Beli BB - Nama"], o["Beli BB - Alamat"])],
        ["Supplier Bear Brand", e("Supplier BB")],
        ["Grosir Bear Brand", join(o["Grosir BB"], o["Lokasi Grosir BB"])],
      ]))}
      ${section("Brand susu di toko", kv([
        ["TPH LS", e("TPH LS")], ["Di rak", e("Brand Susu di Toko")], ["Di chiller", e("Brand Susu di Chiller")],
      ]))}
      ${section("Foto", photos ? `<div class="photos">${photos}</div><div class="detail-links">${PHOTO_COLS.filter((c) => o[c])
        .map((c) => `<a href="${esc(o[c])}" target="_blank" rel="noopener">📷 Buka ${esc(c)} ↗</a>`).join("")}</div>` : "")}`;
    $("modal").classList.remove("hidden");
    renderVisitMeta(o);

    $("visitSave").addEventListener("click", async () => {
      const btn = $("visitSave");
      const done = $("visitDone").checked;
      const note = $("visitNote").value.trim();
      const prev = visits.get(o.id);
      const now = new Date().toISOString();
      let by = store.uid || "";
      if (store.mode === "api") {
        by = $("visitBy").value.trim();
        if (!by) { $("visitMeta").textContent = "Isi nama kamu dulu supaya tim tahu siapa yang datang."; $("visitBy").focus(); return; }
        lsSet(NAME_LS, by);
      }
      const rec = done || note ? {
        visited: done,
        note,
        visitedAt: done ? (prev?.visited && prev.visitedAt) || now : "",
        updatedAt: now,
        by,
      } : null;
      btn.disabled = true;
      $("visitMeta").textContent = "Menyimpan…";
      try {
        await saveVisit(o, rec);
        if (rec) visits.set(o.id, rec); else visits.delete(o.id);
        await renderVisitMeta(o);
        $("visitMeta").textContent = "Tersimpan. " + $("visitMeta").textContent;
      } catch (err) {
        if (err?.code === "invalid_argument") {
          store.canWrite = false;
          renderSyncNote();
          $("visitMeta").textContent = "Kamu tidak punya izin mengubah data ini. Minta akses Contributor atau Editor ke pemilik halaman.";
        } else if (err?.code === "kode") {
          $("visitMeta").textContent = "Kode tim salah atau belum diisi. Masukkan kode tim di bagian atas halaman.";
        } else if (err?.code === "quota_exceeded") {
          $("visitMeta").textContent = "Penyimpanan penuh. Hapus tanda yang tidak dipakai lalu coba lagi.";
        } else {
          $("visitMeta").textContent = "Gagal menyimpan. Periksa koneksi lalu coba lagi.";
        }
      } finally {
        btn.disabled = !store.canWrite;
      }
    });
  }
  function closeModal() { $("modal").classList.add("hidden"); }
  $("modalClose").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // ---------- tabs ----------
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + b.dataset.tab));
    activeTab = b.dataset.tab;
    if (activeTab === "map") map.invalidateSize();
    renderVisiblePanels();
  }));

  // ---------- export ----------
  async function exportExcel() {
    const btn = $("btnExport");
    btn.disabled = true;
    try {
      const who = await names(filtered.map((o) => visits.get(o.id)?.by));
      const extra = ["Status Kunjungan", "Tanggal Kunjungan", "Dikunjungi oleh", "Catatan", "Terakhir diperbarui"];
      const aoa = [extra.concat(RAW.cols), ...filtered.map((o) => {
        const v = visits.get(o.id);
        return [v?.visited ? "Sudah didatangi" : "Belum didatangi", fmtDate(v?.visitedAt), who[v?.by] || "",
          v?.note || "", fmtDate(v?.updatedAt)].concat(RAW.cols.map((c) => o[c]));
      })];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!autofilter"] = { ref: ws["!ref"] };
      XLSX.utils.book_append_sheet(wb, ws, "Outlet");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const filename = `maps_beruang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const downloads = window.claude?.use ? await window.claude.use("downloads") : null;
      if (downloads) {
        await downloads.save({ filename, data: new Blob([buf]) }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally {
      btn.disabled = false;
    }
  }
  $("btnExport").addEventListener("click", exportExcel);

  $("subtitle").textContent = `${fmt.format(outlets.length)} outlet hasil survei · ${uniq(outlets, "RSM").length} RSM · ${new Set(outlets.map((o) => o.Kecamatan)).size} kecamatan`;
  // tinggi header untuk posisi tab yang menempel (HP)
  const setTopbarH = () => document.documentElement.style.setProperty("--topbar-h", document.querySelector(".topbar").offsetHeight + "px");
  setTopbarH();
  new ResizeObserver(setTopbarH).observe(document.querySelector(".topbar"));
  initStore();
  apply();
})();
