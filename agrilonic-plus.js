/* =====================================================================
   Agrilonic Plus v1.0 — fitur tambahan, ditaruh di file terpisah supaya
   index.html tetap mudah dirawat. Dimuat dengan <script defer> setelah
   skrip utama, jadi `plantsData`, `openPlantModal`, `reminders`, dsb.
   sudah tersedia.

   Isi:  Kebun Saya · Keuangan Tani · Radar Risiko Cuaca · Kalkulator
         Lahan & Populasi · Cari Cepat (Ctrl+K) · Pengaturan & Cadangan
         · mode gelap · ukuran teks · notifikasi pengingat · penanda
         offline · info pembaruan · tautan pintas (?a=kebun, dst.)
   Semua data tersimpan di perangkat (localStorage), tanpa server.
   ===================================================================== */
(function(){
'use strict';
if(typeof plantsData === 'undefined' || !Array.isArray(plantsData)){ console.warn('Agrilonic Plus: plantsData tidak ditemukan, modul dilewati.'); return; }

const PLUS_VERSION = '1.0.0';
const LS = { kebun:'agrilonicKebun', kas:'agrilonicKas', set:'agrilonicSettings', wx:'agrilonicPlusWx', loc:'agrilonicCuacaLoc' };
const ANIMAL_CATS = ['peternakan','burung','peliharaan'];

/* ------------------------------------------------------------------ */
/* Helper umum                                                         */
/* ------------------------------------------------------------------ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (x, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : NaN; };
const fmtNum = (n, d) => (isFinite(n) ? n : 0).toLocaleString('id-ID', { maximumFractionDigits: d == null ? 2 : d });
const rupiah = n => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');
const rpShort = n => { const a = Math.abs(n); const s = n < 0 ? '-' : '';
  if(a >= 1e9) return s + fmtNum(a / 1e9, 1) + ' M'; if(a >= 1e6) return s + fmtNum(a / 1e6, 1) + ' jt';
  if(a >= 1e3) return s + fmtNum(a / 1e3, 0) + ' rb'; return s + Math.round(a); };
const pad2 = n => String(n).padStart(2, '0');
const fmtISO = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayISO = () => fmtISO(new Date());
const parseISO = iso => { const p = String(iso).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return fmtISO(d); };
const daysSince = iso => { const t = new Date(); t.setHours(0,0,0,0); return Math.round((t - parseISO(iso)) / 864e5); };
const fmtTgl = iso => parseISO(iso).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isAnimal = p => ANIMAL_CATS.includes(p.category);
const catLabel = c => (typeof categoryLabel !== 'undefined' && categoryLabel[c]) || c;
const getPlant = id => plantsData.find(p => p.id === id);

function load(k, d){ try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ toast('Penyimpanan perangkat penuh. Hapus data lama atau unduh cadangan.', 'err'); return false; } }
function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
let kebun = load(LS.kebun, []); if(!Array.isArray(kebun)) kebun = [];
let kas   = load(LS.kas, []);   if(!Array.isArray(kas)) kas = [];
let settings = Object.assign({ theme:'light', font:100, notif:false, notifDay:'' }, load(LS.set, {}));
const saveKebun = () => save(LS.kebun, kebun);
const saveKas = () => save(LS.kas, kas);
const saveSettings = () => save(LS.set, settings);

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */
let toastBox;
function toast(msg, kind, action){
  if(!toastBox){ toastBox = el('div'); toastBox.id = 'apToasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
  const icon = kind === 'err' ? 'ph-warning-circle' : kind === 'info' ? 'ph-info' : 'ph-check-circle';
  const t = el('div', 'ap-toast ' + (kind || 'ok'), '<i class="ph-fill ' + icon + ' t-i"></i><span>' + esc(msg) + '</span>');
  if(action){ const b = el('button', '', esc(action.label)); b.type = 'button'; b.addEventListener('click', () => { action.fn(); t.remove(); }); t.appendChild(b); }
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), action ? 9000 : 3600);
}

/* ------------------------------------------------------------------ */
/* Modal & dialog                                                      */
/* ------------------------------------------------------------------ */
const openStack = [];
function syncScroll(){ document.body.style.overflow = openStack.length ? 'hidden' : ''; }
function showOv(ov){ ov.classList.add('open'); if(!openStack.includes(ov)) openStack.push(ov); syncScroll(); }
function hideOv(ov){ ov.classList.remove('open'); const i = openStack.indexOf(ov); if(i > -1) openStack.splice(i, 1); syncScroll(); }

const modals = {};
function makeModal(id, title, icon, color, sub){
  if(modals[id]) return modals[id];
  const ov = el('div', 'ap-overlay modal-overlay');
  ov.id = 'ap-' + id;
  ov.innerHTML = '<div class="ap-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="ap-' + id + '-t">' +
    '<div class="ap-mh"><div><h3 id="ap-' + id + '-t"><i class="ph-fill ' + icon + '" style="color:' + color + '"></i> ' + esc(title) + '</h3>' +
    (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div><button type="button" class="ap-x" aria-label="Tutup"><i class="ph ph-x"></i></button></div>' +
    '<div class="ap-tabs" hidden></div><div class="ap-mb"></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', e => { if(e.target === ov) hideOv(ov); });
  $('.ap-x', ov).addEventListener('click', () => hideOv(ov));
  const m = { ov, tabs: $('.ap-tabs', ov), body: $('.ap-mb', ov) };
  modals[id] = m; return m;
}
function setTabs(m, items, active, onPick){
  m.tabs.hidden = !items.length;
  m.tabs.innerHTML = items.map(t => '<button type="button" class="tab-btn' + (t.id === active ? ' active' : '') + '" data-tab="' + t.id + '"><i class="ph-fill ' + t.icon + ' mr-1"></i> ' + esc(t.label) + '</button>').join('');
  $$('button', m.tabs).forEach(b => b.addEventListener('click', () => onPick(b.dataset.tab)));
}

/* Dialog form sederhana → Promise(values | null) */
function dialog(o){
  return new Promise(resolve => {
    const ov = el('div', 'ap-overlay ap-dlg open');
    const fields = (o.fields || []).map(f => {
      let input;
      if(f.type === 'select') input = '<select class="ap-sel" name="' + f.name + '">' + f.options.map(x => '<option value="' + esc(x.v) + '"' + (String(x.v) === String(f.value) ? ' selected' : '') + '>' + esc(x.t) + '</option>').join('') + '</select>';
      else if(f.type === 'textarea') input = '<textarea class="ap-in" name="' + f.name + '" rows="2" maxlength="300" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
      else input = '<input class="ap-in" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value == null ? '' : f.value) + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + (f.required ? ' required' : '') + ' maxlength="' + (f.maxlength || 80) + '" placeholder="' + esc(f.placeholder || '') + '">';
      return '<div style="margin-top:10px"><label class="ap-lbl">' + esc(f.label) + '</label>' + input + '</div>';
    }).join('');
    ov.innerHTML = '<form class="ap-panel ap-small" role="alertdialog" aria-modal="true"><div class="ap-mh"><div><h3>' + esc(o.title) + '</h3>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div></div>' +
      '<div class="ap-mb">' + (o.body ? '<p class="ap-note" style="font-size:13px">' + o.body + '</p>' : '') + fields +
      '<div class="ap-row-end"><button type="button" class="ap-btn ghost" data-c>' + esc(o.cancel || 'Batal') + '</button><button type="submit" class="ap-btn ' + (o.danger ? 'red' : '') + '">' + esc(o.ok || 'Simpan') + '</button></div></div></form>';
    document.body.appendChild(ov); openStack.push(ov); syncScroll();
    const form = $('form', ov);
    const close = v => { const i = openStack.indexOf(ov); if(i > -1) openStack.splice(i, 1); ov.remove(); syncScroll(); resolve(v); };
    ov.__cancel = () => close(null);
    $('[data-c]', ov).addEventListener('click', () => close(null));
    ov.addEventListener('mousedown', e => { if(e.target === ov) close(null); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if(!form.reportValidity()) return;
      const vals = {}; (o.fields || []).forEach(f => { vals[f.name] = form.elements[f.name].value; });
      close(vals);
    });
    const first = $('input,select,textarea', ov); (first || $('button[type=submit]', ov)).focus();
  });
}
const confirmDlg = (title, body, ok, danger) => dialog({ title, body, ok: ok || 'Ya', danger: !!danger }).then(v => !!v);

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && openStack.length){
    const top = openStack[openStack.length - 1];
    if(top.__cancel) top.__cancel(); else hideOv(top);
  }
});

/* ------------------------------------------------------------------ */
/* Fase tanaman                                                        */
/* ------------------------------------------------------------------ */
function phaseRange(s){
  let m = String(s).match(/(\d+)\s*[-–—]\s*(\d+)\s*HST/i); if(m) return [+m[1], +m[2]];
  m = String(s).match(/[>≥]\s*(\d+)\s*HST/i); if(m) return [+m[1], Infinity];
  m = String(s).match(/(\d+)\s*[-–—]\s*(\d+)\s*Bulan/i); if(m) return [+m[1] * 30, +m[2] * 30];
  return null;
}
function phaseInfo(entry, plant){
  const ph = plant.fertilizing || [];
  const ranges = ph.map(x => phaseRange(x.phase));
  const hasAuto = ranges.some(Boolean);
  const hst = Math.max(0, daysSince(entry.date));
  let idx = 0, auto = false;
  if(entry.phaseIdx != null && entry.phaseIdx >= 0 && entry.phaseIdx < ph.length){ idx = entry.phaseIdx; }
  else if(hasAuto){
    auto = true;
    let found = -1;
    ranges.forEach((r, i) => { if(r && hst >= r[0] && hst <= r[1] && found < 0) found = i; });
    if(found < 0){
      let last = -1; ranges.forEach((r, i) => { if(r && hst > r[1]) last = i; });
      found = last >= 0 ? Math.min(last + 1, ph.length - 1) : ranges.findIndex(Boolean);
    }
    idx = Math.max(0, found);
  }
  const next = idx + 1 < ph.length ? idx + 1 : -1;
  const nr = next >= 0 ? ranges[next] : null;
  return { ph, idx, auto, hasAuto, hst, cur: ph[idx], next: next >= 0 ? ph[next] : null, nextStartDate: nr ? addDays(entry.date, nr[0]) : null };
}

/* ------------------------------------------------------------------ */
/* Statistik kas per kebun                                             */
/* ------------------------------------------------------------------ */
function kebunName(k){ const p = getPlant(k.plantId); return (p ? p.name : 'Tanaman') + (k.label ? ' — ' + k.label : ''); }
function kebunFin(id){ let i = 0, o = 0; kas.forEach(t => { if(t.kebunId === id){ if(t.type === 'in') i += t.amount; else o += t.amount; } }); return { in: i, out: o, net: i - o }; }

/* ------------------------------------------------------------------ */
/* DASBOR BERANDA                                                      */
/* ------------------------------------------------------------------ */
function dueReminders(){ try{ return (typeof reminders !== 'undefined' && Array.isArray(reminders)) ? reminders.filter(r => daysUntil(r.date) <= 0) : []; }catch(e){ return []; } }
function nextReminderText(){
  try{
    if(typeof reminders === 'undefined' || !reminders.length) return 'Belum ada jadwal';
    const d = Math.min.apply(null, reminders.map(r => daysUntil(r.date)));
    return d <= 0 ? 'Segera dikerjakan' : 'Berikutnya ' + d + ' hari lagi';
  }catch(e){ return ''; }
}
function monthNet(){ const k = todayISO().slice(0, 7); let n = 0; kas.forEach(t => { if(t.date.slice(0, 7) === k) n += t.type === 'in' ? t.amount : -t.amount; }); return n; }

function ensureDash(){
  let d = $('#apDash'); if(d) return d;
  d = el('section'); d.id = 'apDash'; d.setAttribute('aria-label', 'Ringkasan Agrilonic Plus');
  const anchor = $('#visitorBanner'); const main = $('main');
  if(anchor) anchor.insertAdjacentElement('afterend', d); else if(main) main.prepend(d); else return null;
  d.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if(t) TOOLS_BY_ID[t.dataset.go].open(); });
  return d;
}
function refreshDash(){
  const d = ensureDash(); if(!d) return;
  const aktif = kebun.filter(k => k.status !== 'panen').length;
  const due = dueReminders().length;
  const net = monthNet();
  const wx = load(LS.wx, null);
  let riskVal = 'Cek cuaca', riskSub = 'Buka Radar Risiko';
  if(wx && wx.f && Date.now() - wx.ts < 6 * 3600e3){
    const sc = riskScores(wx.f); const top = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
    riskVal = levelOf(sc[top]).label; riskSub = CLASS_LABEL[top].short + ' · ' + sc[top] + '/100';
  }
  d.innerHTML =
    '<div class="ap-dash-head"><h2><i class="ph-fill ph-plant" style="color:#16a34a"></i> Kebun & Usaha Saya</h2>' +
    '<div class="ap-row"><button type="button" class="ap-btn ghost sm" data-go="cari"><i class="ph ph-magnifying-glass"></i> Cari cepat</button>' +
    '<button type="button" class="ap-btn ghost sm" data-go="pengaturan" aria-label="Pengaturan"><i class="ph ph-gear-six"></i></button></div></div>' +
    '<div class="ap-grid ap-g4">' +
    '<button type="button" class="ap-tile" data-go="kebun"><span class="t-top"><i class="ph-fill ph-plant" style="color:#16a34a"></i> Kebun Saya</span><span class="t-val">' + aktif + ' aktif</span><span class="t-sub">' + (kebun.length ? kebun.length + ' total dipantau' : 'Mulai catat tanaman Anda') + '</span></button>' +
    '<button type="button" class="ap-tile" data-go="pengingat"><span class="t-top"><i class="ph-fill ph-bell" style="color:#f59e0b"></i> Pengingat</span><span class="t-val">' + due + ' jatuh tempo</span><span class="t-sub">' + esc(nextReminderText()) + '</span></button>' +
    '<button type="button" class="ap-tile ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '') + '" data-go="kas"><span class="t-top"><i class="ph-fill ph-coins" style="color:#b45309"></i> Kas bulan ini</span><span class="t-val">' + (kas.length ? rupiah(net) : 'Rp 0') + '</span><span class="t-sub">' + (kas.length ? (net >= 0 ? 'Laba berjalan' : 'Rugi berjalan') : 'Catat biaya & hasil panen') + '</span></button>' +
    '<button type="button" class="ap-tile" data-go="risiko"><span class="t-top"><i class="ph-fill ph-radar" style="color:#0284c7"></i> Risiko cuaca</span><span class="t-val">' + esc(riskVal) + '</span><span class="t-sub">' + esc(riskSub) + '</span></button>' +
    '</div>';
}

/* ------------------------------------------------------------------ */
/* DAFTAR ALAT (menu, pencarian, dasbor)                               */
/* ------------------------------------------------------------------ */
const TOOLS = [
  { id:'kebun',      label:'Kebun Saya',            sub:'Pantau tanaman/ternak, fase & panen',        icon:'ph-plant',            color:'#16a34a', bg:'#f0fdf4', kw:'tanam kebun pantau fase panen hst umur', open:() => openKebun() },
  { id:'kas',        label:'Keuangan Tani',         sub:'Kas, laba-rugi, R/C & titik impas',          icon:'ph-coins',            color:'#b45309', bg:'#fffbeb', kw:'uang biaya modal untung rugi bep hpp kas',  open:() => openKas() },
  { id:'risiko',     label:'Radar Risiko Cuaca',    sub:'Potensi jamur, bakteri & hama dari cuaca',   icon:'ph-radar',            color:'#0284c7', bg:'#f0f9ff', kw:'cuaca hujan lembap penyakit hama waspada',  open:() => openRisiko() },
  { id:'lahan',      label:'Kalkulator Lahan',      sub:'Konversi luas & hitung populasi/bibit',      icon:'ph-ruler',            color:'#7c3aed', bg:'#f5f3ff', kw:'luas bata tumbak hektar are jarak tanam bibit populasi', open:() => openLahan() },
  { id:'cari',       label:'Cari Cepat',            sub:'Cari tanaman, penyakit, gejala & fitur',     icon:'ph-magnifying-glass', color:'#475569', bg:'#f1f5f9', kw:'search cari temukan ctrl k',                open:() => openCari() },
  { id:'pengaturan', label:'Pengaturan & Cadangan', sub:'Tema, ukuran teks, notifikasi, backup data', icon:'ph-gear-six',         color:'#334155', bg:'#f1f5f9', kw:'tema gelap backup cadangan restore notifikasi huruf', open:() => openPengaturan() }
];
const TOOLS_BY_ID = {}; TOOLS.forEach(t => { TOOLS_BY_ID[t.id] = t; });
TOOLS_BY_ID.pengingat = { id:'pengingat', open:() => { const b = $('#btnPengingat'); if(b) b.click(); } };

function injectMenus(){
  const dd = $('#alatTaniDropdown');
  if(dd && !$('#apDdBlock')){
    const blk = el('div'); blk.id = 'apDdBlock';
    blk.innerHTML = '<p class="tools-dropdown-label">Agrilonic Plus</p>' + TOOLS.map(t =>
      '<button type="button" class="tool-item" data-ap="' + t.id + '"><span class="tool-item-icon" style="background:' + t.bg + ';color:' + t.color + '"><i class="ph-fill ' + t.icon + '"></i></span><span class="tool-item-label">' + esc(t.label) + '</span></button>').join('') +
      '<div class="border-t border-slate-100 my-1.5" style="border-top:1px solid #f1f5f9;margin:6px 0"></div>';
    dd.insertBefore(blk, dd.firstChild);
    blk.addEventListener('click', e => { const b = e.target.closest('[data-ap]'); if(!b) return;
      dd.classList.remove('open'); const c = $('#alatTaniCaret'); if(c) c.style.transform = 'rotate(0deg)'; TOOLS_BY_ID[b.dataset.ap].open(); });
  }
  const nav = $('#mobileMenuDrawer nav');
  if(nav && !$('#apNavBlock')){
    const blk = el('div'); blk.id = 'apNavBlock'; blk.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    blk.innerHTML = '<p class="tools-dropdown-label" style="padding:2px 4px 0">Agrilonic Plus</p>' + TOOLS.map(t =>
      '<button type="button" class="mobile-menu-item" data-ap="' + t.id + '"><span class="mobile-menu-icon" style="background:' + t.color + '"><i class="ph-fill ' + t.icon + '"></i></span><span class="flex-1 text-left" style="flex:1;text-align:left"><span class="block font-head font-bold text-sm text-slate-700" style="display:block;font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:#334155">' + esc(t.label) + '</span><span class="block text-xs text-slate-400" style="display:block;font-size:12px;color:#94a3b8">' + esc(t.sub) + '</span></span><i class="ph ph-caret-right text-slate-300" style="color:#cbd5e1"></i></button>').join('') +
      '<p class="tools-dropdown-label" style="padding:6px 4px 0">Fitur lainnya</p>';
    nav.insertBefore(blk, nav.firstChild);
    blk.addEventListener('click', e => { const b = e.target.closest('[data-ap]'); if(!b) return;
      try{ if(typeof closeMobileMenu === 'function') closeMobileMenu(); }catch(x){}
      setTimeout(() => TOOLS_BY_ID[b.dataset.ap].open(), 230); });
  }
}

/* ------------------------------------------------------------------ */
/* KEBUN SAYA                                                          */
/* ------------------------------------------------------------------ */
const ksState = { view:'list', showDone:false };
const UNITS = ['tanaman','pohon','polybag','bedeng','m²','ekor'];

function plantOptionsHtml(selected){
  const cats = []; plantsData.forEach(p => { if(!cats.includes(p.category)) cats.push(p.category); });
  return cats.map(c => '<optgroup label="' + esc(catLabel(c)) + '">' +
    plantsData.filter(p => p.category === c).map(p => '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</optgroup>').join('');
}

function openKebun(){
  const m = makeModal('kebun', 'Kebun Saya', 'ph-plant', '#16a34a', 'Pantau tanaman & ternak: umur, fase pemupukan, dan panen.');
  if(!m.bound){ m.bound = true; bindKebun(m); }
  ksState.view = 'list'; renderKebun(); showOv(m.ov);
}

function renderKebun(){
  const m = modals.kebun; if(!m) return;
  if(ksState.view === 'add'){
    const first = plantsData[0];
    m.body.innerHTML =
      '<div class="ap-card"><div class="ap-sec">Tambah ke Kebun Saya</div>' +
      '<label class="ap-lbl" for="apKPlant">Tanaman / ternak</label><select id="apKPlant" class="ap-sel">' + plantOptionsHtml(first.id) + '</select>' +
      '<div class="ap-grid ap-g2" style="margin-top:10px"><div><label class="ap-lbl" for="apKLabel">Nama kebun/blok (opsional)</label><input id="apKLabel" class="ap-in" maxlength="40" placeholder="mis. Bedeng A, Kandang 2"></div>' +
      '<div><label class="ap-lbl" for="apKDate">Tanggal tanam / mulai</label><input id="apKDate" type="date" class="ap-in" value="' + todayISO() + '"></div></div>' +
      '<div class="ap-grid ap-g2" style="margin-top:10px"><div><label class="ap-lbl" for="apKQty">Jumlah</label><input id="apKQty" type="number" min="0" step="any" class="ap-in" placeholder="mis. 50"></div>' +
      '<div><label class="ap-lbl" for="apKUnit">Satuan</label><select id="apKUnit" class="ap-sel">' + UNITS.map(u => '<option>' + u + '</option>').join('') + '</select></div></div>' +
      '<div class="ap-row-end"><button type="button" class="ap-btn ghost" data-act="cancel">Batal</button><button type="button" class="ap-btn green" data-act="save"><i class="ph-bold ph-check"></i> Simpan</button></div></div>';
    return;
  }
  const aktif = kebun.filter(k => k.status !== 'panen');
  const done = kebun.filter(k => k.status === 'panen');
  let h = '<div class="ap-row" style="margin-bottom:12px"><span class="ap-note">' + aktif.length + ' aktif · ' + done.length + ' selesai</span><span class="ap-sp"></span><button type="button" class="ap-btn green" data-act="add"><i class="ph-bold ph-plus"></i> Tambah</button></div>';
  if(!kebun.length){
    h += '<div class="ap-empty"><i class="ph ph-plant"></i><p><b>Belum ada tanaman yang dipantau.</b></p><p>Tambahkan tanaman atau ternak Anda untuk melihat umur, fase pemupukan berikutnya, risiko cuaca, dan laba-rugi per kebun.</p></div>';
  } else {
    h += aktif.map(kebunCard).join('') || '<div class="ap-empty"><p>Semua catatan sudah selesai dipanen.</p></div>';
    if(done.length){
      h += '<div class="ap-row" style="margin-top:16px"><div class="ap-sec" style="margin:0">Selesai / dipanen</div><span class="ap-sp"></span><button type="button" class="ap-btn ghost sm" data-act="toggle-done">' + (ksState.showDone ? 'Sembunyikan' : 'Tampilkan (' + done.length + ')') + '</button></div>';
      if(ksState.showDone) h += '<div style="margin-top:8px">' + done.map(kebunCard).join('') + '</div>';
    }
  }
  m.body.innerHTML = h;
}

function kebunCard(k){
  const p = getPlant(k.plantId);
  if(!p) return '<div class="ap-card"><span class="ap-muted">Data tanaman tidak ditemukan.</span> <button type="button" class="ap-ico del" data-act="hapus" data-id="' + esc(k.id) + '" aria-label="Hapus"><i class="ph ph-trash"></i></button></div>';
  const animal = isAnimal(p);
  const pi = phaseInfo(k, p);
  const fin = kebunFin(k.id);
  const done = k.status === 'panen';
  const umur = animal ? 'umur ' + pi.hst + ' hari' : pi.hst + ' HST';
  let h = '<div class="ap-card" data-id="' + esc(k.id) + '">' +
    '<div class="ap-row"><div style="min-width:0;flex:1"><div class="ap-h" style="font-size:16px;color:#334155"><i class="ph-fill ' + esc(p.icon || 'ph-plant') + '" style="color:#16a34a"></i> ' + esc(p.name) + (k.label ? ' <span class="ap-pill blue">' + esc(k.label) + '</span>' : '') + (done ? ' <span class="ap-pill green">Dipanen</span>' : '') + '</div>' +
    '<div class="ap-note">' + (animal ? 'Mulai ' : 'Ditanam ') + fmtTgl(k.date) + ' · <b>' + umur + '</b>' + (k.qty ? ' · ' + fmtNum(k.qty) + ' ' + esc(k.unit || '') : '') + '</div></div>' +
    '<button type="button" class="ap-ico del" data-act="hapus" data-id="' + esc(k.id) + '" aria-label="Hapus catatan"><i class="ph ph-trash"></i></button></div>';
  if(!done && pi.cur){
    h += '<div style="margin-top:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px">' +
      '<div class="ap-row"><span class="ap-pill green"><i class="ph-fill ph-leaf"></i> Fase ' + (pi.idx + 1) + '/' + pi.ph.length + (pi.auto ? ' · otomatis dari HST' : (k.phaseIdx != null ? ' · diatur manual' : '')) + '</span><span class="ap-sp"></span>' +
      '<button type="button" class="ap-ico" data-act="fase-prev" data-id="' + esc(k.id) + '" aria-label="Fase sebelumnya"' + (pi.idx <= 0 ? ' disabled style="opacity:.3"' : '') + '><i class="ph-bold ph-caret-left"></i></button>' +
      '<button type="button" class="ap-ico" data-act="fase-next" data-id="' + esc(k.id) + '" aria-label="Fase berikutnya"' + (pi.idx >= pi.ph.length - 1 ? ' disabled style="opacity:.3"' : '') + '><i class="ph-bold ph-caret-right"></i></button>' +
      (pi.hasAuto && k.phaseIdx != null ? '<button type="button" class="ap-btn ghost sm" data-act="fase-auto" data-id="' + esc(k.id) + '">Otomatis</button>' : '') + '</div>' +
      '<div class="ap-h" style="color:#166534;margin-top:6px">' + esc(pi.cur.phase) + '</div><div class="ap-note" style="color:#166534">' + esc(pi.cur.desc) + '</div>' +
      (pi.next ? '<div class="ap-note" style="margin-top:6px"><i class="ph ph-arrow-bend-down-right"></i> Berikutnya: <b>' + esc(pi.next.phase) + '</b>' + (pi.nextStartDate ? ' · sekitar ' + fmtTgl(pi.nextStartDate) : '') + '</div>' : '') +
      (!pi.hasAuto && k.phaseIdx == null ? '<div class="ap-note" style="margin-top:6px;color:#92400e">Database tidak memuat rentang hari untuk tanaman ini — geser fase dengan tombol ◀ ▶ sesuai kondisi di lapangan.</div>' : '') + '</div>';
  }
  if(fin.in || fin.out) h += '<div class="ap-row ap-note" style="margin-top:8px"><span>Biaya <b>' + rupiah(fin.out) + '</b></span><span>Hasil <b>' + rupiah(fin.in) + '</b></span><span class="' + (fin.net >= 0 ? 'rk-low' : 'rk-high') + '"><b>' + (fin.net >= 0 ? 'Laba ' : 'Rugi ') + rupiah(Math.abs(fin.net)) + '</b></span></div>';
  if(done && k.harvest) h += '<div class="ap-note" style="margin-top:8px">Panen ' + fmtTgl(k.harvest.date) + ': <b>' + fmtNum(k.harvest.qty) + ' ' + esc(k.harvest.unit) + '</b> × ' + rupiah(k.harvest.price) + '</div>';
  h += '<div class="ap-row" style="margin-top:10px">' +
    '<button type="button" class="ap-btn ghost sm" data-act="info" data-id="' + esc(k.id) + '"><i class="ph ph-book-open"></i> Panduan</button>' +
    (!done ? '<button type="button" class="ap-btn ghost sm" data-act="ingatkan" data-id="' + esc(k.id) + '"><i class="ph ph-bell"></i> Ingatkan</button>' +
             (!animal ? '<button type="button" class="ap-btn ghost sm" data-act="radar" data-id="' + esc(k.id) + '"><i class="ph ph-radar"></i> Risiko</button>' : '') +
             '<button type="button" class="ap-btn green sm" data-act="panen" data-id="' + esc(k.id) + '"><i class="ph-bold ph-basket"></i> ' + (animal ? 'Jual / selesai' : 'Panen') + '</button>'
           : '<button type="button" class="ap-btn ghost sm" data-act="buka" data-id="' + esc(k.id) + '"><i class="ph ph-arrow-counter-clockwise"></i> Aktifkan lagi</button>') + '</div></div>';
  return h;
}

function bindKebun(m){
  m.body.addEventListener('change', e => {
    if(e.target.id === 'apKPlant'){ const p = getPlant(e.target.value); const u = $('#apKUnit', m.body); if(p && u) u.value = isAnimal(p) ? 'ekor' : 'tanaman'; }
  });
  m.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
    const act = b.dataset.act; const k = kebun.find(x => x.id === b.dataset.id);
    if(act === 'add'){ ksState.view = 'add'; renderKebun(); return; }
    if(act === 'cancel'){ ksState.view = 'list'; renderKebun(); return; }
    if(act === 'toggle-done'){ ksState.showDone = !ksState.showDone; renderKebun(); return; }
    if(act === 'save'){
      const plantId = $('#apKPlant', m.body).value; const date = $('#apKDate', m.body).value || todayISO();
      const qty = num($('#apKQty', m.body).value);
      kebun.unshift({ id: uid('k'), plantId, label: $('#apKLabel', m.body).value.trim().slice(0, 40), date, qty: isFinite(qty) ? qty : 0, unit: $('#apKUnit', m.body).value, status: 'aktif', phaseIdx: null });
      if(saveKebun()){ ksState.view = 'list'; renderKebun(); refreshDash(); toast('Ditambahkan ke Kebun Saya.'); }
      return;
    }
    if(!k) return;
    const p = getPlant(k.plantId);
    if(act === 'info' && p && typeof openPlantModal === 'function'){ openPlantModal(p.id); }
    else if(act === 'radar'){ rsState.sel = k.plantId; openRisiko(); }
    else if(act === 'fase-prev' || act === 'fase-next'){
      const pi = phaseInfo(k, p); const ni = clamp(pi.idx + (act === 'fase-next' ? 1 : -1), 0, pi.ph.length - 1);
      k.phaseIdx = ni; saveKebun(); renderKebun();
    }
    else if(act === 'fase-auto'){ k.phaseIdx = null; saveKebun(); renderKebun(); }
    else if(act === 'ingatkan'){ kebunRemind(k, p); }
    else if(act === 'panen'){ kebunHarvest(k, p); }
    else if(act === 'buka'){ k.status = 'aktif'; saveKebun(); renderKebun(); refreshDash(); }
    else if(act === 'hapus'){
      if(await confirmDlg('Hapus catatan ini?', 'Catatan kebun <b>' + esc(kebunName(k)) + '</b> akan dihapus. Transaksi kas yang terkait tetap tersimpan.', 'Hapus', true)){
        kebun = kebun.filter(x => x.id !== k.id); saveKebun(); renderKebun(); refreshDash();
      }
    }
  });
}

async function kebunRemind(k, p){
  if(typeof reminders === 'undefined'){ toast('Fitur pengingat tidak tersedia.', 'err'); return; }
  const pi = phaseInfo(k, p);
  const sugg = pi.nextStartDate && pi.nextStartDate >= todayISO() ? pi.nextStartDate : addDays(todayISO(), 7);
  const v = await dialog({ title: 'Buat pengingat pupuk', sub: esc(kebunName(k)), ok: 'Buat pengingat', fields: [
    { name:'date', label:'Tanggal pengingat', type:'date', value:sugg, required:true },
    { name:'note', label:'Catatan', type:'text', value: pi.next ? 'Fase berikutnya: ' + pi.next.phase : (pi.cur ? pi.cur.phase : 'Pemupukan'), maxlength:120 }
  ]});
  if(!v) return;
  /* teks di-escape karena modul Pengingat lama menampilkan catatan sebagai HTML */
  reminders.push({ id:'r' + Date.now(), plantId:p.id, plantName: p.name + (k.label ? ' (' + esc(k.label) + ')' : ''), date:v.date, note: esc(v.note), type:'pupuk', intervalDays:null });
  try{ saveReminders(); updateReminderBadge(); if(typeof renderReminderList === 'function') renderReminderList(); }catch(e){}
  refreshDash(); toast('Pengingat dibuat untuk ' + fmtTgl(v.date) + '.');
}

async function kebunHarvest(k, p){
  const animal = isAnimal(p);
  const v = await dialog({ title: animal ? 'Catat penjualan / selesai' : 'Catat panen', sub: esc(kebunName(k)), ok:'Simpan', fields: [
    { name:'date', label:'Tanggal', type:'date', value:todayISO(), required:true },
    { name:'qty', label:'Jumlah hasil', type:'number', step:'any', min:0, value:'', required:true, placeholder:'mis. 120' },
    { name:'unit', label:'Satuan', type:'text', value: animal ? 'ekor' : 'kg', maxlength:12 },
    { name:'price', label:'Harga jual per satuan (Rp) — kosongkan jika tidak dijual', type:'number', step:'any', min:0, value:'' }
  ]});
  if(!v) return;
  const qty = num(v.qty), price = num(v.price);
  k.status = 'panen'; k.harvest = { date:v.date, qty: isFinite(qty) ? qty : 0, unit: (v.unit || '').trim() || 'unit', price: isFinite(price) ? price : 0 };
  if(k.harvest.qty > 0 && k.harvest.price > 0){
    kas.unshift({ id: uid('t'), date:v.date, type:'in', cat:'Penjualan hasil', amount: Math.round(k.harvest.qty * k.harvest.price), note: 'Panen ' + p.name, kebunId:k.id });
    saveKas();
  }
  saveKebun(); ksState.showDone = true; renderKebun(); refreshDash();
  toast(k.harvest.price > 0 ? 'Panen dicatat & pemasukan masuk ke kas.' : 'Panen dicatat.');
}

/* ------------------------------------------------------------------ */
/* KEUANGAN TANI                                                       */
/* ------------------------------------------------------------------ */
const kasState = { tab:'ringkas', range:'bulan', type:'out', limit:30 };
const CAT_OUT = ['Bibit/benih','Pupuk','Pestisida/obat','Media & wadah','Tenaga kerja','Peralatan','Pakan','Air & listrik','Transport','Lainnya'];
const CAT_IN  = ['Penjualan hasil','Penjualan bibit/olahan','Lainnya'];
const RANGES = [['bulan','Bulan ini'],['3bln','3 bulan'],['tahun','Tahun ini'],['semua','Semua']];

function rangeStart(r){
  const n = new Date();
  if(r === 'bulan') return fmtISO(new Date(n.getFullYear(), n.getMonth(), 1));
  if(r === '3bln') return fmtISO(new Date(n.getFullYear(), n.getMonth() - 2, 1));
  if(r === 'tahun') return n.getFullYear() + '-01-01';
  return '0000-01-01';
}
function openKas(tab){
  const m = makeModal('kas', 'Keuangan Tani', 'ph-coins', '#b45309', 'Catat biaya & hasil, lihat laba-rugi, R/C ratio, dan titik impas.');
  if(!m.bound){ m.bound = true; bindKas(m); }
  if(tab) kasState.tab = tab;
  renderKas(); showOv(m.ov);
}
function renderKas(){
  const m = modals.kas; if(!m) return;
  setTabs(m, [{id:'ringkas',label:'Ringkasan',icon:'ph-chart-line-up'},{id:'transaksi',label:'Transaksi',icon:'ph-list-bullets'},{id:'bep',label:'Titik Impas',icon:'ph-scales'}], kasState.tab, t => { kasState.tab = t; renderKas(); });
  m.body.innerHTML = kasState.tab === 'ringkas' ? kasRingkas() : kasState.tab === 'transaksi' ? kasTransaksi() : kasBep();
  if(kasState.tab === 'bep') bepCalc();
}

function monthlySeries(){
  const out = []; const n = new Date();
  for(let i = 5; i >= 0; i--){
    const d = new Date(n.getFullYear(), n.getMonth() - i, 1); const key = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    let a = 0, b = 0; kas.forEach(t => { if(t.date.slice(0, 7) === key){ if(t.type === 'in') a += t.amount; else b += t.amount; } });
    out.push({ key, label: d.toLocaleDateString('id-ID', { month:'short' }), in:a, out:b });
  }
  return out;
}
function chartSvg(series){
  const W = 320, H = 150, base = 122, top = 16; const max = Math.max(1, ...series.map(s => Math.max(s.in, s.out)));
  const bw = 15, gap = (W - 20) / series.length; let g = '';
  series.forEach((s, i) => {
    const x = 10 + i * gap + (gap - bw * 2 - 3) / 2; const hi = (s.in / max) * (base - top), ho = (s.out / max) * (base - top);
    g += '<rect x="' + x.toFixed(1) + '" y="' + (base - hi).toFixed(1) + '" width="' + bw + '" height="' + hi.toFixed(1) + '" rx="3" fill="#16a34a"><title>Pemasukan ' + esc(rupiah(s.in)) + '</title></rect>' +
         '<rect x="' + (x + bw + 3).toFixed(1) + '" y="' + (base - ho).toFixed(1) + '" width="' + bw + '" height="' + ho.toFixed(1) + '" rx="3" fill="#e11d48"><title>Pengeluaran ' + esc(rupiah(s.out)) + '</title></rect>' +
         '<text x="' + (x + bw + 1.5).toFixed(1) + '" y="' + (base + 13) + '" text-anchor="middle">' + esc(s.label) + '</text>';
  });
  return '<svg class="ap-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan terakhir">' +
    '<line x1="8" y1="' + base + '" x2="' + (W - 8) + '" y2="' + base + '" stroke="#cbd5e1"/><text x="8" y="10">maks ' + esc(rpShort(max)) + '</text>' + g + '</svg>';
}
function kasRingkas(){
  const start = rangeStart(kasState.range); const rows = kas.filter(t => t.date >= start);
  let tin = 0, tout = 0; const cat = {}; const per = {};
  rows.forEach(t => {
    if(t.type === 'in') tin += t.amount; else { tout += t.amount; cat[t.cat] = (cat[t.cat] || 0) + t.amount; }
    const key = kebun.some(k => k.id === t.kebunId) ? t.kebunId : '_umum'; per[key] = per[key] || { in:0, out:0 }; per[key][t.type === 'in' ? 'in' : 'out'] += t.amount;
  });
  const net = tin - tout; const rc = tout > 0 ? tin / tout : null;
  let h = '<div class="ap-row" style="margin-bottom:12px"><div class="ap-seg" role="group" aria-label="Periode">' + RANGES.map(r => '<button type="button" data-act="range" data-v="' + r[0] + '" class="' + (kasState.range === r[0] ? 'on' : '') + '">' + r[1] + '</button>').join('') + '</div><span class="ap-sp"></span><button type="button" class="ap-btn green sm" data-act="goadd"><i class="ph-bold ph-plus"></i> Catat</button></div>';
  if(!kas.length) return h + '<div class="ap-empty"><i class="ph ph-coins"></i><p><b>Belum ada catatan kas.</b></p><p>Catat biaya (bibit, pupuk, tenaga kerja) dan hasil penjualan untuk mengetahui untung-rugi usaha tani Anda.</p></div>';
  h += '<div class="ap-grid ap-g4"><div class="ap-stat pos"><span>Pemasukan</span><b>' + rupiah(tin) + '</b></div><div class="ap-stat neg"><span>Pengeluaran</span><b>' + rupiah(tout) + '</b></div>' +
    '<div class="ap-stat ' + (net >= 0 ? 'pos' : 'neg') + '"><span>' + (net >= 0 ? 'Laba' : 'Rugi') + '</span><b>' + rupiah(Math.abs(net)) + '</b></div>' +
    '<div class="ap-stat ' + (rc == null ? '' : rc >= 1 ? 'pos' : 'neg') + '"><span>R/C ratio</span><b>' + (rc == null ? '—' : fmtNum(rc, 2)) + '</b></div></div>';
  if(rc != null) h += '<p class="ap-note" style="margin-top:6px">' + (rc >= 1 ? 'R/C ≥ 1: penerimaan menutup biaya pada periode ini.' : 'R/C &lt; 1: penerimaan belum menutup biaya — wajar jika tanaman belum panen.') + '</p>';
  h += '<div class="ap-sec">6 bulan terakhir</div>' + chartSvg(monthlySeries()) +
    '<div class="ap-row ap-note" style="justify-content:center;gap:14px"><span><i class="ph-fill ph-square" style="color:#16a34a"></i> Pemasukan</span><span><i class="ph-fill ph-square" style="color:#e11d48"></i> Pengeluaran</span></div>';
  const cats = Object.keys(cat).sort((a, b) => cat[b] - cat[a]);
  if(cats.length){
    h += '<div class="ap-sec">Pengeluaran per kategori</div>' + cats.map(c => { const pc = tout ? cat[c] / tout * 100 : 0;
      return '<div style="margin-bottom:8px"><div class="ap-row ap-note"><span>' + esc(c) + '</span><span class="ap-sp"></span><b>' + rupiah(cat[c]) + ' · ' + fmtNum(pc, 0) + '%</b></div><div class="ap-bar red"><i style="width:' + pc.toFixed(1) + '%"></i></div></div>'; }).join('');
  }
  const keys = Object.keys(per);
  if(keys.length){
    h += '<div class="ap-sec">Laba-rugi per kebun</div>' + keys.map(id => { const k = kebun.find(x => x.id === id); const v = per[id]; const n = v.in - v.out;
      return '<div class="ap-list-item"><div style="flex:1;min-width:0"><b style="font-size:13px;color:#334155">' + esc(k ? kebunName(k) : 'Umum / tanpa kebun') + '</b><div class="ap-note">Biaya ' + rupiah(v.out) + ' · Hasil ' + rupiah(v.in) + '</div></div><b class="' + (n >= 0 ? 'rk-low' : 'rk-high') + '" style="font-size:13px">' + (n >= 0 ? '+' : '-') + rupiah(Math.abs(n)) + '</b></div>'; }).join('');
  }
  return h;
}

function kasTransaksi(){
  const cats = kasState.type === 'in' ? CAT_IN : CAT_OUT;
  let h = '<div class="ap-card"><div class="ap-sec">Catat transaksi</div>' +
    '<div class="ap-seg" role="group" aria-label="Jenis"><button type="button" data-act="type" data-v="out" class="out' + (kasState.type === 'out' ? ' on' : '') + '">Pengeluaran</button><button type="button" data-act="type" data-v="in" class="in' + (kasState.type === 'in' ? ' on' : '') + '">Pemasukan</button></div>' +
    '<div class="ap-grid ap-g2" style="margin-top:10px"><div><label class="ap-lbl" for="apTDate">Tanggal</label><input id="apTDate" type="date" class="ap-in" value="' + todayISO() + '"></div>' +
    '<div><label class="ap-lbl" for="apTAmt">Jumlah (Rp)</label><input id="apTAmt" type="number" min="0" step="any" class="ap-in" placeholder="mis. 150000"></div></div>' +
    '<div class="ap-grid ap-g2" style="margin-top:10px"><div><label class="ap-lbl" for="apTCat">Kategori</label><select id="apTCat" class="ap-sel">' + cats.map(c => '<option>' + esc(c) + '</option>').join('') + '</select></div>' +
    '<div><label class="ap-lbl" for="apTKebun">Untuk kebun</label><select id="apTKebun" class="ap-sel"><option value="">Umum / tidak spesifik</option>' + kebun.map(k => '<option value="' + esc(k.id) + '">' + esc(kebunName(k)) + '</option>').join('') + '</select></div></div>' +
    '<div style="margin-top:10px"><label class="ap-lbl" for="apTNote">Catatan</label><input id="apTNote" class="ap-in" maxlength="80" placeholder="mis. beli NPK 25 kg"></div>' +
    '<button type="button" class="ap-btn block ' + (kasState.type === 'in' ? 'green' : 'red') + '" style="margin-top:12px" data-act="addtx"><i class="ph-bold ph-plus"></i> Simpan ' + (kasState.type === 'in' ? 'pemasukan' : 'pengeluaran') + '</button></div>';
  const sorted = kas.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  h += '<div class="ap-row" style="margin:16px 0 4px"><div class="ap-sec" style="margin:0">Riwayat (' + sorted.length + ')</div><span class="ap-sp"></span>' + (sorted.length ? '<button type="button" class="ap-btn ghost sm" data-act="csv"><i class="ph ph-download-simple"></i> Unduh CSV</button>' : '') + '</div>';
  if(!sorted.length) return h + '<div class="ap-empty"><p>Belum ada transaksi.</p></div>';
  h += sorted.slice(0, kasState.limit).map(t => { const k = kebun.find(x => x.id === t.kebunId);
    return '<div class="ap-list-item"><span class="ap-pill ' + (t.type === 'in' ? 'green' : 'red') + '"><i class="ph-bold ' + (t.type === 'in' ? 'ph-arrow-down-left' : 'ph-arrow-up-right') + '"></i></span>' +
      '<div style="flex:1;min-width:0"><b style="font-size:13px;color:#334155">' + esc(t.cat) + (t.note ? ' · <span style="font-weight:500">' + esc(t.note) + '</span>' : '') + '</b><div class="ap-note">' + fmtTgl(t.date) + (k ? ' · ' + esc(kebunName(k)) : '') + '</div></div>' +
      '<b class="' + (t.type === 'in' ? 'rk-low' : 'rk-high') + '" style="font-size:13px;white-space:nowrap">' + (t.type === 'in' ? '+' : '-') + rupiah(t.amount) + '</b>' +
      '<button type="button" class="ap-ico del" data-act="deltx" data-id="' + esc(t.id) + '" aria-label="Hapus transaksi"><i class="ph ph-trash"></i></button></div>'; }).join('');
  if(sorted.length > kasState.limit) h += '<button type="button" class="ap-btn ghost block" style="margin-top:10px" data-act="more">Tampilkan lebih banyak</button>';
  return h;
}

function kasBep(){
  return '<p class="ap-note" style="margin-bottom:10px">Hitung harga pokok produksi (HPP) dan batas harga/produksi agar usaha tidak rugi. Isi manual, atau ambil dari catatan kebun.</p>' +
    '<div class="ap-row" style="margin-bottom:10px"><select id="bepKebun" class="ap-sel" style="flex:1"><option value="">Ambil dari kebun…</option>' + kebun.map(k => '<option value="' + esc(k.id) + '">' + esc(kebunName(k)) + '</option>').join('') + '</select><button type="button" class="ap-btn ghost" data-act="bepfill">Isi otomatis</button></div>' +
    '<div class="ap-grid ap-g2"><div><label class="ap-lbl" for="bepBiaya">Total biaya (Rp)</label><input id="bepBiaya" type="number" min="0" step="any" class="ap-in" placeholder="mis. 2500000"></div>' +
    '<div><label class="ap-lbl" for="bepHarga">Harga jual per satuan (Rp)</label><input id="bepHarga" type="number" min="0" step="any" class="ap-in" placeholder="mis. 18000"></div>' +
    '<div><label class="ap-lbl" for="bepHasil">Hasil panen / produksi</label><input id="bepHasil" type="number" min="0" step="any" class="ap-in" placeholder="mis. 200"></div>' +
    '<div><label class="ap-lbl" for="bepSat">Satuan</label><input id="bepSat" class="ap-in" value="kg" maxlength="12"></div></div>' +
    '<div id="bepOut" style="margin-top:14px"></div>';
}
function bepCalc(){
  const out = $('#bepOut'); if(!out) return;
  const biaya = num($('#bepBiaya').value), harga = num($('#bepHarga').value), hasil = num($('#bepHasil').value); const sat = esc($('#bepSat').value || 'unit');
  if(!(biaya >= 0) || !(hasil > 0)){ out.innerHTML = '<p class="ap-muted">Isi total biaya dan hasil produksi untuk melihat HPP.</p>'; return; }
  const hpp = biaya / hasil; let h = '<div class="ap-grid ap-g2"><div class="ap-stat"><span>HPP per ' + sat + '</span><b>' + rupiah(hpp) + '</b></div>';
  if(harga > 0){
    const terima = hasil * harga, laba = terima - biaya, rc = biaya > 0 ? terima / biaya : null, bc = biaya > 0 ? laba / biaya : null, margin = terima > 0 ? laba / terima * 100 : 0, bepProd = biaya / harga;
    h += '<div class="ap-stat"><span>Impas di produksi</span><b>' + fmtNum(bepProd, 1) + ' ' + sat + '</b></div>' +
      '<div class="ap-stat"><span>Penerimaan</span><b>' + rupiah(terima) + '</b></div><div class="ap-stat ' + (laba >= 0 ? 'pos' : 'neg') + '"><span>' + (laba >= 0 ? 'Laba' : 'Rugi') + '</span><b>' + rupiah(Math.abs(laba)) + '</b></div>' +
      '<div class="ap-stat"><span>R/C ratio</span><b>' + (rc == null ? '—' : fmtNum(rc, 2)) + '</b></div><div class="ap-stat"><span>B/C · Margin</span><b>' + (bc == null ? '—' : fmtNum(bc, 2)) + ' · ' + fmtNum(margin, 0) + '%</b></div></div>' +
      '<p class="ap-note" style="margin-top:10px">' + (laba >= 0 ? 'Usaha menguntungkan pada harga ini. Harga jual boleh turun hingga ' + rupiah(hpp) + '/' + sat + ' sebelum rugi.' : 'Pada harga ini usaha rugi. Perlu harga minimal ' + rupiah(hpp) + '/' + sat + ' atau produksi ≥ ' + fmtNum(bepProd, 1) + ' ' + sat + '.') + '</p>';
  } else h += '</div><p class="ap-note" style="margin-top:10px">Isi harga jual untuk melihat laba-rugi dan titik impas.</p>';
  out.innerHTML = h;
}

function downloadFile(name, text, mime){
  const blob = new Blob([text], { type: mime || 'text/plain' }); const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csvCell(v){ let s = String(v == null ? '' : v); if(/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
function exportCsv(){
  const rows = [['Tanggal','Jenis','Kategori','Jumlah (Rp)','Kebun','Catatan']].concat(kas.slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => {
    const k = kebun.find(x => x.id === t.kebunId); return [t.date, t.type === 'in' ? 'Pemasukan' : 'Pengeluaran', t.cat, t.amount, k ? kebunName(k) : '', t.note || ''];
  }));
  downloadFile('agrilonic-kas-' + todayISO() + '.csv', '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}

function bindKas(m){
  m.body.addEventListener('input', e => { if(/^bep/.test(e.target.id)) bepCalc(); });
  m.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if(!b) return; const act = b.dataset.act;
    if(act === 'range'){ kasState.range = b.dataset.v; renderKas(); }
    else if(act === 'goadd'){ kasState.tab = 'transaksi'; renderKas(); }
    else if(act === 'type'){ kasState.type = b.dataset.v; renderKas(); }
    else if(act === 'more'){ kasState.limit += 30; renderKas(); }
    else if(act === 'csv'){ exportCsv(); }
    else if(act === 'addtx'){
      const amt = num($('#apTAmt', m.body).value); if(!(amt > 0)){ toast('Isi jumlah lebih dari 0.', 'err'); return; }
      kas.unshift({ id: uid('t'), date: $('#apTDate', m.body).value || todayISO(), type: kasState.type, cat: $('#apTCat', m.body).value, amount: Math.round(amt), note: $('#apTNote', m.body).value.trim().slice(0, 80), kebunId: $('#apTKebun', m.body).value || null });
      if(saveKas()){ renderKas(); refreshDash(); toast('Transaksi disimpan.'); }
    }
    else if(act === 'deltx'){
      if(await confirmDlg('Hapus transaksi?', 'Transaksi ini akan dihapus dari catatan kas.', 'Hapus', true)){ kas = kas.filter(t => t.id !== b.dataset.id); saveKas(); renderKas(); refreshDash(); }
    }
    else if(act === 'bepfill'){
      const k = kebun.find(x => x.id === $('#bepKebun', m.body).value); if(!k){ toast('Pilih kebun dulu.', 'info'); return; }
      const f = kebunFin(k.id); $('#bepBiaya').value = f.out || ''; if(k.harvest){ $('#bepHasil').value = k.harvest.qty || ''; $('#bepHarga').value = k.harvest.price || ''; $('#bepSat').value = k.harvest.unit || 'kg'; } bepCalc();
    }
  });
}

/* ------------------------------------------------------------------ */
/* RADAR RISIKO CUACA                                                  */
/* ------------------------------------------------------------------ */
const CLASS_LABEL = {
  lembap:  { name:'Jamur & parasit (kondisi lembap)', short:'Jamur/lembap', icon:'ph-drop',
             tip:'Perbaiki drainase dan sirkulasi udara, hindari menyiram daun menjelang malam, buang bagian yang terserang, dan pertimbangkan perlakuan pencegahan sesuai label produk.' },
  bakteri: { name:'Penyakit bakteri (hujan & angin)', short:'Bakteri', icon:'ph-cloud-rain',
             tip:'Hindari keluar-masuk lahan saat tanaman basah, jangan melukai tanaman, sanitasi alat potong, dan kurangi pemupukan nitrogen berlebih.' },
  vektor:  { name:'Virus, tungau & hama (panas-kering)', short:'Hama/virus', icon:'ph-bug',
             tip:'Periksa bagian bawah daun secara rutin, pasang perangkap/mulsa pemantul, jaga kelembapan tanah, dan segera cabut tanaman bergejala virus.' }
};
function levelOf(s){ return s < 35 ? { label:'Rendah', cls:'rk-low', bar:'green' } : s < 65 ? { label:'Sedang', cls:'rk-mid', bar:'amber' } : { label:'Tinggi', cls:'rk-high', bar:'red' }; }
function tri(t, lo, a, b, hi){ if(t <= lo || t >= hi) return 0; if(t >= a && t <= b) return 1; return t < a ? (t - lo) / (a - lo) : (hi - t) / (hi - b); }
function riskScores(f){
  const wet = clamp((f.rain72 + f.rain48) / 40), rh = clamp((f.rhMean - 65) / 25), high = clamp(f.rhHigh / 0.5);
  const lembap  = 100 * (0.30 * rh + 0.25 * high + 0.25 * wet + 0.20 * tri(f.tMean, 14, 20, 30, 36));
  const bakteri = 100 * (0.30 * wet + 0.25 * rh + 0.20 * clamp((f.windMax - 10) / 20) + 0.25 * tri(f.tMean, 18, 24, 33, 38));
  const vektor  = 100 * (0.40 * clamp((f.tMean - 26) / 6) + 0.30 * clamp((75 - f.rhMean) / 25) + 0.30 * (1 - clamp((f.rain72 + f.rain48) / 20)));
  return { lembap: Math.round(lembap), bakteri: Math.round(bakteri), vektor: Math.round(vektor) };
}
function thiOf(f){ const T = f.tMax; return (1.8 * T + 32) - (0.55 - 0.0055 * f.rhMean) * (1.8 * T - 26); }
function classifyDisease(d){
  const t = ((d.pathogen || '') + ' ' + (d.name || '')).toLowerCase();
  if(/jamur|phytophthora|plasmodiophora|cendawan|cacing|nematoda|parasit|protozoa/.test(t)) return 'lembap';
  if(/bakteri/.test(t)) return 'bakteri';
  if(/virus|tungau/.test(t)) return 'vektor';
  return null;
}
const classCache = {};
function classIndex(p){
  if(classCache[p.id]) return classCache[p.id];
  const idx = { lembap:[], bakteri:[], vektor:[] }; const rank = { Tinggi:0, Sedang:1, Rendah:2 };
  (p.diseases || []).forEach(d => { const c = classifyDisease(d); if(c) idx[c].push(d); });
  Object.keys(idx).forEach(c => idx[c].sort((a, b) => (rank[a.severity] == null ? 3 : rank[a.severity]) - (rank[b.severity] == null ? 3 : rank[b.severity])));
  return (classCache[p.id] = idx);
}
function wxFeatures(j){
  const h = j && j.hourly; if(!h || !Array.isArray(h.time) || !h.time.length) throw new Error('data cuaca tidak lengkap');
  const ln = new Date(Date.now() + (j.utc_offset_seconds || 0) * 1000);
  const nowStr = ln.getUTCFullYear() + '-' + pad2(ln.getUTCMonth() + 1) + '-' + pad2(ln.getUTCDate()) + 'T' + pad2(ln.getUTCHours()) + ':00';
  let ni = -1; h.time.forEach((t, i) => { if(t <= nowStr) ni = i; });
  if(ni < 0) ni = Math.min(71, h.time.length - 1);
  const a = Math.max(0, ni - 71), b = Math.min(h.time.length - 1, ni + 48);
  const T = h.temperature_2m || [], RH = h.relative_humidity_2m || [], P = h.precipitation || [], W = h.wind_speed_10m || [];
  let ts = 0, tn = 0, tmax = -99, rs = 0, rn = 0, hi = 0, r72 = 0, r48 = 0, wmax = 0;
  for(let i = a; i <= b; i++){
    if(isFinite(T[i])){ ts += T[i]; tn++; tmax = Math.max(tmax, T[i]); }
    if(isFinite(RH[i])){ rs += RH[i]; rn++; if(RH[i] >= 85) hi++; }
    if(isFinite(P[i])){ if(i <= ni) r72 += P[i]; else r48 += P[i]; }
    if(isFinite(W[i])) wmax = Math.max(wmax, W[i]);
  }
  if(!tn || !rn) throw new Error('data cuaca kosong');
  return { tMean: ts / tn, tMax: tmax, rhMean: rs / rn, rhHigh: hi / rn, rain72: r72, rain48: r48, windMax: wmax };
}
function getLoc(){ const l = load(LS.loc, null); if(l && isFinite(+l.lat) && isFinite(+l.lon)) return { lat:+l.lat, lon:+l.lon, label: l.label || 'Lokasi tersimpan' }; return null; }
const near = (c, loc) => c && Math.abs(c.lat - loc.lat) < 0.01 && Math.abs(c.lon - loc.lon) < 0.01;
async function fetchWx(loc, force){
  const c = load(LS.wx, null);
  if(!force && c && c.f && near(c, loc) && Date.now() - c.ts < 30 * 60e3) return c;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
  try{
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon + '&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&past_days=3&forecast_days=3&timezone=auto';
    const r = await fetch(url, { signal: ctl.signal }); if(!r.ok) throw new Error('http ' + r.status);
    const rec = { ts: Date.now(), lat: loc.lat, lon: loc.lon, label: loc.label, f: wxFeatures(await r.json()) };
    save(LS.wx, rec); return rec;
  } finally { clearTimeout(to); }
}

const rsState = { sel:null, rec:null };
function openRisiko(){
  const m = makeModal('risiko', 'Radar Risiko Cuaca', 'ph-radar', '#0284c7', 'Potensi penyakit & hama dari cuaca 3 hari terakhir + 2 hari ke depan.');
  if(!m.bound){ m.bound = true; bindRisiko(m); }
  if(!rsState.sel) rsState.sel = kebun.some(k => k.status !== 'panen' && getPlant(k.plantId) && !isAnimal(getPlant(k.plantId))) ? 'kebun' : plantsData[0].id;
  showOv(m.ov); loadRisiko(false);
}
async function loadRisiko(force){
  const m = modals.risiko; const loc = getLoc();
  if(!loc){ m.body.innerHTML = '<div class="ap-empty"><i class="ph ph-map-pin"></i><p><b>Lokasi belum diatur.</b></p><p>Radar memakai cuaca di lokasi kebun Anda.</p>' +
    '<div class="ap-row" style="justify-content:center;margin-top:10px"><button type="button" class="ap-btn" data-act="geo"><i class="ph-fill ph-crosshair"></i> Gunakan lokasi saya</button><button type="button" class="ap-btn ghost" data-act="cuaca">Cari nama kota</button></div></div>'; return; }
  m.body.innerHTML = '<div class="ap-empty"><i class="ph ph-cloud-sun"></i><p>Mengambil data cuaca untuk <b>' + esc(loc.label) + '</b>…</p></div>';
  try{ const rec = await fetchWx(loc, force); rsState.rec = rec; renderRisiko(); refreshDash(); }
  catch(e){
    const c = load(LS.wx, null);
    if(c && c.f && near(c, loc)){ rsState.rec = Object.assign({ stale:true }, c); renderRisiko(); }
    else m.body.innerHTML = '<div class="ap-empty"><i class="ph ph-wifi-slash"></i><p><b>Data cuaca tidak bisa diambil.</b></p><p>Periksa koneksi internet, lalu coba lagi.</p><button type="button" class="ap-btn" data-act="reload">Coba lagi</button></div>';
  }
}
function renderRisiko(){
  const m = modals.risiko, rec = rsState.rec; if(!rec) return; const f = rec.f, sc = riskScores(f);
  if(rsState.sel === 'kebun' && !kebun.some(k => k.status !== 'panen')) rsState.sel = plantsData[0].id;
  const when = new Date(rec.ts).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  let h = '<div class="ap-row" style="margin-bottom:10px"><span class="ap-pill blue"><i class="ph-fill ph-map-pin"></i> ' + esc(rec.label || 'Lokasi') + '</span><span class="ap-note">' + (rec.stale ? 'Data tersimpan (offline) · ' : 'Diperbarui ') + when + '</span><span class="ap-sp"></span><button type="button" class="ap-btn ghost sm" data-act="reload"><i class="ph ph-arrows-clockwise"></i> Muat ulang</button></div>';
  h += '<div class="ap-grid ap-g4"><div class="ap-stat"><span>Suhu rata-rata</span><b>' + fmtNum(f.tMean, 1) + '°C</b></div><div class="ap-stat"><span>Kelembapan</span><b>' + fmtNum(f.rhMean, 0) + '%</b></div>' +
    '<div class="ap-stat"><span>Hujan 3 hari lalu</span><b>' + fmtNum(f.rain72, 1) + ' mm</b></div><div class="ap-stat"><span>Hujan 2 hari depan</span><b>' + fmtNum(f.rain48, 1) + ' mm</b></div></div>';
  h += '<div class="ap-sec">Kondisi cuaca mendukung…</div>' + Object.keys(CLASS_LABEL).map(c => { const lv = levelOf(sc[c]);
    return '<div class="ap-risk"><span class="rk-n"><i class="ph-fill ' + CLASS_LABEL[c].icon + '" style="color:#64748b"></i> ' + esc(CLASS_LABEL[c].short) + '</span><div class="ap-bar ' + lv.bar + '"><i style="width:' + sc[c] + '%"></i></div><span class="rk-v ' + lv.cls + '">' + lv.label + ' · ' + sc[c] + '</span></div>'; }).join('');
  h += '<div class="ap-sec">Tanaman yang dipantau</div><select id="rsSel" class="ap-sel" aria-label="Pilih tanaman">' +
    (kebun.some(k => k.status !== 'panen') ? '<option value="kebun"' + (rsState.sel === 'kebun' ? ' selected' : '') + '>Kebun saya (yang aktif)</option>' : '') + plantOptionsHtml(rsState.sel) + '</select><div style="margin-top:10px">';
  let plants = [];
  if(rsState.sel === 'kebun'){ kebun.filter(k => k.status !== 'panen').forEach(k => { const p = getPlant(k.plantId); if(p && !plants.includes(p)) plants.push(p); }); }
  else { const p = getPlant(rsState.sel); if(p) plants = [p]; }
  h += plants.map(p => plantRiskBlock(p, sc, f)).join('') || '<div class="ap-empty"><p>Pilih tanaman untuk melihat daftar yang perlu diwaspadai.</p></div>';
  h += '</div><p class="ap-note" style="margin-top:12px"><i class="ph ph-info"></i> Ini <b>indikator kondisi cuaca</b>, bukan prediksi pasti serangan. Skor 0–100 dihitung dari kelembapan, hujan, suhu & angin; selalu cek langsung kondisi tanaman Anda. Data cuaca: Open-Meteo.</p>';
  m.body.innerHTML = h;
}
function plantRiskBlock(p, sc, f){
  let h = '<div class="ap-card"><div class="ap-row"><div class="ap-h" style="font-size:15px;color:#334155"><i class="ph-fill ' + esc(p.icon || 'ph-plant') + '" style="color:#16a34a"></i> ' + esc(p.name) + '</div><span class="ap-sp"></span><button type="button" class="ap-btn ghost sm" data-act="plant" data-p="' + esc(p.id) + '">Panduan</button></div>';
  if(isAnimal(p)){
    const t = thiOf(f); const lv = t < 72 ? ['Nyaman','green'] : t < 79 ? ['Stres ringan','amber'] : t < 89 ? ['Stres sedang','red'] : ['Stres berat','red'];
    h += '<div class="ap-row" style="margin-top:8px"><span class="ap-pill ' + lv[1] + '"><i class="ph-fill ph-thermometer-hot"></i> ' + lv[0] + '</span><span class="ap-note">Indeks suhu-kelembapan (THI) ± ' + fmtNum(t, 0) + '</span></div>' +
      '<p class="ap-note" style="margin-top:6px">' + (t < 72 ? 'Kondisi cuaca relatif nyaman untuk ternak/hewan.' : 'Sediakan air minum bersih & sejuk, naungan dan ventilasi, kurangi kepadatan, hindari penanganan/angkut di jam terpanas.') + ' THI adalah indeks umum untuk ternak; unggas dan hewan kecil bisa lebih peka.</p></div>';
    return h;
  }
  const idx = classIndex(p); const keys = Object.keys(CLASS_LABEL).filter(c => sc[c] >= 35 && (idx[c].length || (c === 'vektor' && (p.pests || []).length))).sort((a, b) => sc[b] - sc[a]);
  if(!keys.length) return h + '<p class="ap-note" style="margin-top:8px"><i class="ph-fill ph-check-circle" style="color:#16a34a"></i> Cuaca saat ini tidak menunjukkan risiko menonjol untuk penyakit utama ' + esc(p.name) + '. Tetap pantau rutin.</p></div>';
  keys.forEach(c => { const lv = levelOf(sc[c]);
    h += '<div style="margin-top:10px"><div class="ap-row"><b class="' + lv.cls + '" style="font-size:13px"><i class="ph-fill ' + CLASS_LABEL[c].icon + '"></i> ' + esc(CLASS_LABEL[c].name) + ' — ' + lv.label + '</b></div>' +
      '<div class="ap-row" style="margin-top:6px">' + idx[c].slice(0, 4).map(d => '<button type="button" class="ap-pill ' + (d.severity === 'Tinggi' ? 'red' : d.severity === 'Sedang' ? 'amber' : '') + '" data-act="dis" data-p="' + esc(p.id) + '" data-d="' + esc(d.id) + '" style="cursor:pointer">' + esc(d.name) + '</button>').join('') + '</div>' +
      (c === 'vektor' && (p.pests || []).length ? '<p class="ap-note" style="margin-top:6px">Hama tercatat: ' + (p.pests || []).slice(0, 3).map(x => esc(String(x.name).replace(/\s*\(.*$/, ''))).join(', ') + '</p>' : '') +
      '<p class="ap-note" style="margin-top:4px">' + esc(CLASS_LABEL[c].tip) + '</p></div>'; });
  return h + '</div>';
}
function bindRisiko(m){
  m.body.addEventListener('change', e => { if(e.target.id === 'rsSel'){ rsState.sel = e.target.value; renderRisiko(); } });
  m.body.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(!b) return; const a = b.dataset.act;
    if(a === 'reload') loadRisiko(true);
    else if(a === 'plant' && typeof openPlantModal === 'function') openPlantModal(b.dataset.p);
    else if(a === 'dis' && typeof openDiseaseModal === 'function') openDiseaseModal(b.dataset.p, b.dataset.d);
    else if(a === 'cuaca'){ hideOv(m.ov); const c = $('#btnCuaca'); if(c) c.click(); }
    else if(a === 'geo'){
      if(!navigator.geolocation){ toast('Perangkat tidak mendukung deteksi lokasi.', 'err'); return; }
      b.disabled = true;
      navigator.geolocation.getCurrentPosition(pos => { save(LS.loc, { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4), label:'Lokasi saya' }); loadRisiko(true); },
        () => { b.disabled = false; toast('Izin lokasi ditolak. Coba "Cari nama kota".', 'err'); }, { timeout: 10000, maximumAge: 600000 });
    }
  });
}

/* ------------------------------------------------------------------ */
/* KALKULATOR LAHAN & POPULASI                                         */
/* ------------------------------------------------------------------ */
const lahanState = { tab:'konversi' };
function openLahan(){
  const m = makeModal('lahan', 'Kalkulator Lahan', 'ph-ruler', '#7c3aed', 'Konversi satuan luas dan hitung populasi tanaman & kebutuhan bibit.');
  if(!m.bound){ m.bound = true; m.body.addEventListener('input', lahanCalc); m.body.addEventListener('change', lahanCalc); }
  renderLahan(); showOv(m.ov);
}
function renderLahan(){
  const m = modals.lahan;
  setTabs(m, [{id:'konversi',label:'Konversi Luas',icon:'ph-arrows-left-right'},{id:'populasi',label:'Populasi & Bibit',icon:'ph-grid-nine'}], lahanState.tab, t => { lahanState.tab = t; renderLahan(); });
  const unitOpts = sel => ['m²','are','ha','bata'].map(u => '<option' + (u === sel ? ' selected' : '') + '>' + u + '</option>').join('');
  m.body.innerHTML = lahanState.tab === 'konversi'
    ? '<div class="ap-grid ap-g2"><div><label class="ap-lbl" for="lkVal">Luas</label><input id="lkVal" type="number" min="0" step="any" class="ap-in" placeholder="mis. 2500"></div><div><label class="ap-lbl" for="lkUnit">Satuan</label><select id="lkUnit" class="ap-sel">' + ['m²','are','ha','bata','tumbak'].map(u => '<option>' + u + '</option>').join('') + '</select></div></div>' +
      '<div style="margin-top:10px"><label class="ap-lbl" for="lkBata">1 bata / 1 tumbak = … m² (umumnya 14, berbeda tiap daerah)</label><input id="lkBata" type="number" min="1" step="any" class="ap-in" value="14"></div><div id="lkOut" style="margin-top:14px"></div>'
    : '<div class="ap-grid ap-g2"><div><label class="ap-lbl" for="lpLuas">Luas lahan</label><input id="lpLuas" type="number" min="0" step="any" class="ap-in" placeholder="mis. 1000"></div><div><label class="ap-lbl" for="lpUnit">Satuan</label><select id="lpUnit" class="ap-sel">' + unitOpts('m²') + '</select></div>' +
      '<div><label class="ap-lbl" for="lpJb">Jarak antar baris (cm)</label><input id="lpJb" type="number" min="1" step="any" class="ap-in" placeholder="mis. 60"></div><div><label class="ap-lbl" for="lpJd">Jarak dalam baris (cm)</label><input id="lpJd" type="number" min="1" step="any" class="ap-in" placeholder="mis. 50"></div>' +
      '<div><label class="ap-lbl" for="lpEf">Lahan efektif tanam (%)</label><input id="lpEf" type="number" min="1" max="100" step="any" class="ap-in" value="80"></div><div><label class="ap-lbl" for="lpSulam">Cadangan sulam (%)</label><input id="lpSulam" type="number" min="0" max="100" step="any" class="ap-in" value="10"></div>' +
      '<div><label class="ap-lbl" for="lpHarga">Harga bibit/unit (Rp, opsional)</label><input id="lpHarga" type="number" min="0" step="any" class="ap-in" placeholder="mis. 700"></div></div>' +
      '<p class="ap-note" style="margin-top:8px">Lahan efektif = bagian lahan yang benar-benar ditanami (di luar parit, jalan, pematang). Jarak tanam isi sesuai anjuran varietas.</p><div id="lpOut" style="margin-top:14px"></div>';
  lahanCalc();
}
function luasM2(v, u, bata){ return v * ({ 'm²':1, are:100, ha:10000, bata:bata, tumbak:bata }[u] || 1); }
function lahanCalc(){
  const m = modals.lahan; if(!m) return;
  if(lahanState.tab === 'konversi'){
    const out = $('#lkOut', m.body); if(!out) return; const v = num($('#lkVal', m.body).value), bata = num($('#lkBata', m.body).value) || 14;
    if(!(v > 0)){ out.innerHTML = '<p class="ap-muted">Masukkan luas untuk melihat hasil konversi.</p>'; return; }
    const m2 = luasM2(v, $('#lkUnit', m.body).value, bata);
    out.innerHTML = '<div class="ap-grid ap-g3">' + [['m²', m2], ['are', m2 / 100], ['hektar', m2 / 10000], ['bata', m2 / bata], ['tumbak', m2 / bata]].map(r => '<div class="ap-stat"><span>' + r[0] + '</span><b>' + fmtNum(r[1], 3) + '</b></div>').join('') + '</div>';
  } else {
    const out = $('#lpOut', m.body); if(!out) return;
    const luas = num($('#lpLuas', m.body).value), jb = num($('#lpJb', m.body).value), jd = num($('#lpJd', m.body).value), ef = num($('#lpEf', m.body).value), sulam = num($('#lpSulam', m.body).value) || 0, harga = num($('#lpHarga', m.body).value);
    if(!(luas > 0 && jb > 0 && jd > 0 && ef > 0)){ out.innerHTML = '<p class="ap-muted">Isi luas lahan dan kedua jarak tanam untuk menghitung.</p>'; return; }
    const area = luasM2(luas, $('#lpUnit', m.body).value, 14), efektif = area * Math.min(ef, 100) / 100, per = (jb / 100) * (jd / 100);
    const pop = Math.floor(efektif / per), butuh = Math.ceil(pop * (1 + sulam / 100)), perHa = Math.floor(10000 * Math.min(ef, 100) / 100 / per);
    out.innerHTML = '<div class="ap-grid ap-g2"><div class="ap-stat"><span>Luas efektif</span><b>' + fmtNum(efektif, 1) + ' m²</b></div><div class="ap-stat"><span>Ruang per tanaman</span><b>' + fmtNum(per, 3) + ' m²</b></div>' +
      '<div class="ap-stat pos"><span>Populasi tanaman</span><b>' + fmtNum(pop, 0) + '</b></div><div class="ap-stat pos"><span>Bibit dibutuhkan (+sulam)</span><b>' + fmtNum(butuh, 0) + '</b></div>' +
      '<div class="ap-stat"><span>Setara per hektar</span><b>' + fmtNum(perHa, 0) + '</b></div>' + (harga > 0 ? '<div class="ap-stat"><span>Perkiraan biaya bibit</span><b>' + rupiah(butuh * harga) + '</b></div>' : '') + '</div>';
  }
}

/* ------------------------------------------------------------------ */
/* CARI CEPAT                                                          */
/* ------------------------------------------------------------------ */
let cariIdx = null, cariSel = 0, cariRes = [], cariOv = null;
function buildIdx(){
  const it = [];
  plantsData.forEach(p => {
    it.push({ t:'tanaman', title:p.name, sub:(p.latin || '') + ' · ' + catLabel(p.category), icon:p.icon || 'ph-plant', hay:norm(p.name + ' ' + (p.latin || '')), hay2:norm(catLabel(p.category)), go:() => openPlantModal(p.id) });
    (p.diseases || []).forEach(d => it.push({ t:'penyakit', title:d.name, sub:p.name + ' · ' + (d.pathogen || ''), icon:'ph-virus', hay:norm(d.name + ' ' + (d.pathogen || '')), hay2:norm((d.symptoms || []).join(' ') + ' ' + (d.cause || '')), go:() => openDiseaseModal(p.id, d.id) }));
    (p.pests || []).forEach(x => it.push({ t:'hama', title:x.name, sub:p.name, icon:'ph-bug', hay:norm(x.name), hay2:norm((x.symptoms || '') + ' ' + (x.control || '')), go:() => openPlantModal(p.id) }));
  });
  const hdr = [['btnKamera','ph-camera'],['btnDiagnosa','ph-stethoscope'],['btnPengingat','ph-bell'],['btnAiChat','ph-sparkle']];
  hdr.forEach(h => { const b = document.getElementById(h[0]); if(b) it.push({ t:'fitur', title:(b.textContent || '').trim(), sub:'Fitur Agrilonic', icon:h[1], hay:norm(b.textContent || ''), hay2:'', go:() => b.click() }); });
  $$('#alatTaniDropdown button.tool-item[id]').forEach(b => { const l = $('.tool-item-label', b); if(l) it.push({ t:'fitur', title:l.textContent.trim(), sub:'Alat Tani', icon:(($('i', b) || {}).className || 'ph-toolbox').replace(/ph-fill|ph /g, '').trim() || 'ph-toolbox', hay:norm(l.textContent), hay2:'', go:() => b.click() }); });
  TOOLS.forEach(t => it.push({ t:'fitur', title:t.label, sub:t.sub, icon:t.icon, hay:norm(t.label), hay2:norm(t.sub + ' ' + t.kw), go:t.open }));
  return it;
}
function cariSearch(q){
  if(!cariIdx) cariIdx = buildIdx();
  q = norm(q).trim();
  if(!q) return cariIdx.filter(i => i.t === 'fitur').slice(-TOOLS.length - 6);
  const toks = q.split(/\s+/); const out = [];
  cariIdx.forEach(i => {
    let s = 0; const all = i.hay + ' ' + i.hay2;
    for(const t of toks){ if(i.hay.includes(t)) s += (i.hay.startsWith(t) || i.hay.includes(' ' + t)) ? 15 : 10; else if(all.includes(t)) s += 3; else return; }
    if(i.hay.includes(q)) s += 30; if(i.hay.startsWith(q)) s += 20; s += i.t === 'tanaman' ? 6 : i.t === 'fitur' ? 5 : 0;
    out.push({ i, s });
  });
  return out.sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i);
}
function openCari(){
  if(!cariOv){
    cariOv = el('div', 'ap-overlay ap-top');
    cariOv.innerHTML = '<div class="ap-panel ap-search-box" role="dialog" aria-modal="true" aria-label="Cari cepat"><div class="ap-search-in"><i class="ph ph-magnifying-glass"></i><input id="apQ" type="search" autocomplete="off" placeholder="Cari tanaman, penyakit, gejala, atau fitur…" aria-label="Kata kunci"><button type="button" class="ap-x" aria-label="Tutup"><i class="ph ph-x"></i></button></div><div class="ap-search-res" id="apRes" role="listbox"></div>' +
      '<div class="ap-search-foot"><span><span class="ap-kbd">↑</span> <span class="ap-kbd">↓</span> pilih</span><span><span class="ap-kbd">Enter</span> buka</span><span><span class="ap-kbd">Esc</span> tutup</span></div></div>';
    document.body.appendChild(cariOv);
    cariOv.addEventListener('mousedown', e => { if(e.target === cariOv) hideOv(cariOv); });
    $('.ap-x', cariOv).addEventListener('click', () => hideOv(cariOv));
    const inp = $('#apQ', cariOv); let tm;
    inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => renderCari(inp.value), 70); });
    inp.addEventListener('keydown', e => {
      if(e.key === 'ArrowDown'){ e.preventDefault(); cariSel = Math.min(cariSel + 1, cariRes.length - 1); markCari(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); cariSel = Math.max(cariSel - 1, 0); markCari(); }
      else if(e.key === 'Enter'){ e.preventDefault(); pickCari(cariSel); }
    });
    $('#apRes', cariOv).addEventListener('click', e => { const b = e.target.closest('[data-i]'); if(b) pickCari(+b.dataset.i); });
  }
  const inp = $('#apQ', cariOv); inp.value = ''; renderCari(''); showOv(cariOv); setTimeout(() => inp.focus(), 30);
}
function renderCari(q){
  cariRes = cariSearch(q); cariSel = 0; const box = $('#apRes', cariOv);
  if(!cariRes.length){ box.innerHTML = '<div class="ap-empty"><i class="ph ph-magnifying-glass-minus"></i><p>Tidak ada hasil untuk “' + esc(q) + '”. Coba kata lain, misalnya nama tanaman atau gejala.</p></div>'; return; }
  box.innerHTML = cariRes.map((r, i) => '<button type="button" class="ap-res' + (i === 0 ? ' sel' : '') + '" role="option" data-i="' + i + '"><span class="r-ico"><i class="ph-fill ' + esc(r.icon) + '"></i></span><span class="r-main"><b>' + esc(r.title) + '</b><span>' + esc(r.sub) + '</span></span><span class="r-tag">' + esc(r.t) + '</span></button>').join('');
}
function markCari(){ $$('.ap-res', cariOv).forEach((b, i) => { b.classList.toggle('sel', i === cariSel); if(i === cariSel) b.scrollIntoView({ block:'nearest' }); }); }
function pickCari(i){ const r = cariRes[i]; if(!r) return; hideOv(cariOv); setTimeout(() => { try{ r.go(); }catch(e){ console.warn(e); } }, 60); }

/* ------------------------------------------------------------------ */
/* PENGATURAN, TEMA & CADANGAN                                         */
/* ------------------------------------------------------------------ */
const BACKUP_KEYS = { reminders:'agrilonicReminders', jurnal:'agrilonicJurnal', favorites:'agrilonicFavorites', kebun:LS.kebun, kas:LS.kas, settings:LS.set, loc:LS.loc, aiChat:'agrilonicAiChatHistory' };
const OBJ_KEYS = ['settings', 'loc'];

function applyTheme(){
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('ap-dark', !!dark);
  const mt = $('meta[name="theme-color"]'); if(mt) mt.setAttribute('content', dark ? '#1e293b' : '#3b82f6');
}
function applyFont(){ document.documentElement.style.fontSize = (settings.font && settings.font !== 100) ? settings.font + '%' : ''; }
if(window.matchMedia) try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if(settings.theme === 'auto') applyTheme(); }); }catch(e){}

function storageBytes(){ let n = 0; try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || '').length) * 2; } }catch(e){} return n; }
function sanitizeDeep(v, depth){
  depth = depth || 0; if(depth > 8) return null;
  if(typeof v === 'string') return v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if(Array.isArray(v)) return v.slice(0, 5000).map(x => sanitizeDeep(x, depth + 1));
  if(v && typeof v === 'object'){ const o = {}; Object.keys(v).forEach(k => { if(k === '__proto__' || k === 'constructor' || k === 'prototype') return; o[k] = sanitizeDeep(v[k], depth + 1); }); return o; }
  return (typeof v === 'number' || typeof v === 'boolean' || v === null) ? v : null;
}
const validItem = {
  reminders: x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && typeof x.plantName === 'string',
  jurnal:    x => x && typeof x === 'object',
  kebun:     x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.plantId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date || ''),
  kas:       x => x && typeof x === 'object' && typeof x.id === 'string' && (x.type === 'in' || x.type === 'out') && typeof x.amount === 'number' && isFinite(x.amount) && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.cat === 'string',
  favorites: x => typeof x === 'string', aiChat: x => x && typeof x === 'object'
};
function buildBackup(){ const data = {}; Object.keys(BACKUP_KEYS).forEach(k => { const v = load(BACKUP_KEYS[k], undefined); if(v !== undefined) data[k] = v; }); return { app:'agrilonic', plus:PLUS_VERSION, exportedAt:new Date().toISOString(), data }; }
function mergeVal(cur, inc){
  if(Array.isArray(cur) && Array.isArray(inc)){
    if(inc.some(x => x && typeof x === 'object')){ const ids = new Set(cur.map(x => x && x.id)); return cur.concat(inc.filter(x => !(x && x.id != null && ids.has(x.id)))); }
    return Array.from(new Set(cur.concat(inc)));
  }
  if(cur && inc && typeof cur === 'object' && typeof inc === 'object' && !Array.isArray(cur)) return Object.assign({}, inc, cur);
  return cur != null ? cur : inc;
}
async function importBackup(file){
  let obj; try{ obj = JSON.parse(await file.text()); }catch(e){ toast('File tidak bisa dibaca (bukan JSON valid).', 'err'); return; }
  if(!obj || obj.app !== 'agrilonic' || !obj.data || typeof obj.data !== 'object'){ toast('Ini bukan file cadangan Agrilonic.', 'err'); return; }
  const clean = {}; let count = 0;
  Object.keys(BACKUP_KEYS).forEach(k => {
    if(!(k in obj.data)) return; const v = sanitizeDeep(obj.data[k]);
    if(OBJ_KEYS.includes(k)){ if(v && typeof v === 'object' && !Array.isArray(v)){ clean[k] = v; count++; } }
    else if(Array.isArray(v)){ clean[k] = v.filter(validItem[k] || (() => true)); count += clean[k].length; }
  });
  if(!count){ toast('File cadangan kosong atau tidak valid.', 'err'); return; }
  const v = await dialog({ title:'Pulihkan cadangan', sub:'Dibuat ' + esc(obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('id-ID') : '—'), body:'Ditemukan <b>' + count + '</b> data. <b>Gabungkan</b> menambahkan data yang belum ada; <b>Timpa</b> mengganti data yang ada di perangkat ini.', ok:'Pulihkan',
    fields:[{ name:'mode', label:'Cara pemulihan', type:'select', value:'gabung', options:[{v:'gabung',t:'Gabungkan (aman)'},{v:'timpa',t:'Timpa data yang ada'}] }] });
  if(!v) return;
  Object.keys(clean).forEach(k => { const key = BACKUP_KEYS[k]; const cur = load(key, null); save(key, v.mode === 'timpa' || cur == null ? clean[k] : mergeVal(cur, clean[k])); });
  toast('Cadangan dipulihkan. Memuat ulang…', 'ok'); setTimeout(() => location.reload(), 900);
}

async function notifyDue(manualTest){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  if(!manualTest && !settings.notif) return;
  const today = todayISO(); if(!manualTest && settings.notifDay === today) return;
  const due = dueReminders(); if(!due.length && !manualTest) return;
  if(!manualTest){ settings.notifDay = today; saveSettings(); }
  const title = manualTest ? 'Notifikasi Agrilonic aktif' : 'Agrilonic — ' + due.length + ' pengingat perawatan';
  const body = manualTest ? 'Anda akan diingatkan jadwal pupuk/siram saat membuka aplikasi.' : due.slice(0, 3).map(r => r.plantName + (r.type === 'siram' ? ' (siram)' : ' (pupuk)')).join(', ') + (due.length > 3 ? ' dan lainnya' : '');
  const opt = { body, icon:'icons/icon-192.png', badge:'icons/favicon-32.png', tag:'agrilonic-due' };
  try{ const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if(reg && reg.showNotification){ await reg.showNotification(title, opt); return; } }catch(e){}
  try{ new Notification(title, opt); }catch(e){}
}

function openPengaturan(){
  const m = makeModal('pengaturan', 'Pengaturan & Cadangan', 'ph-gear-six', '#334155', 'Tampilan, notifikasi, dan pengamanan data Anda.');
  if(!m.bound){ m.bound = true; bindPengaturan(m); }
  renderPengaturan(); showOv(m.ov);
}
function seg(act, cur, opts){ return '<div class="ap-seg" role="group">' + opts.map(o => '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div>'; }
function renderPengaturan(){
  const m = modals.pengaturan; const bytes = storageBytes(); const pct = clamp(bytes / (5 * 1024 * 1024)) * 100;
  const supN = 'Notification' in window; const perm = supN ? Notification.permission : 'denied';
  m.body.innerHTML =
    '<div class="ap-sec">Tampilan</div><div class="ap-card"><label class="ap-lbl">Tema</label>' + seg('theme', settings.theme, [['light','Terang'],['dark','Gelap'],['auto','Ikuti perangkat']]) +
    '<p class="ap-note" style="margin-top:6px">Mode gelap memakai inversi warna otomatis, jadi beberapa warna aksen bisa tampak sedikit berbeda.</p>' +
    '<label class="ap-lbl" style="margin-top:12px">Ukuran teks</label>' + seg('font', settings.font, [[90,'Kecil'],[100,'Normal'],[115,'Besar'],[130,'Sangat besar']]) + '</div>' +
    '<div class="ap-sec">Notifikasi pengingat</div><div class="ap-card"><div class="ap-row"><div style="flex:1;min-width:180px"><b style="font-size:13px;color:#334155">Beritahu saat ada jadwal jatuh tempo</b><p class="ap-note">Muncul saat Anda membuka atau kembali ke aplikasi, maksimal sekali per hari. Aplikasi web tidak bisa mengirim notifikasi saat benar-benar tertutup tanpa server push.</p></div>' +
    (supN ? '<button type="button" class="ap-btn ' + (settings.notif && perm === 'granted' ? 'green' : 'ghost') + '" data-act="notif">' + (settings.notif && perm === 'granted' ? '<i class="ph-bold ph-check"></i> Aktif' : 'Aktifkan') + '</button>' : '<span class="ap-pill">Tidak didukung</span>') + '</div>' +
    (perm === 'denied' && supN ? '<p class="ap-note" style="color:#b91c1c;margin-top:6px">Izin notifikasi diblokir di browser. Ubah lewat pengaturan situs browser.</p>' : '') + '</div>' +
    '<div class="ap-sec">Cadangan data</div><div class="ap-card"><p class="ap-note">Pengingat, jurnal, favorit, Kebun Saya, dan Keuangan hanya tersimpan di perangkat ini. <b>Unduh cadangan secara berkala</b> agar tidak hilang saat data browser dibersihkan atau ganti HP.</p>' +
    '<div class="ap-row" style="margin-top:10px"><button type="button" class="ap-btn" data-act="export"><i class="ph-bold ph-download-simple"></i> Unduh cadangan</button>' +
    (navigator.canShare ? '<button type="button" class="ap-btn ghost" data-act="share"><i class="ph ph-share-network"></i> Bagikan/simpan ke…</button>' : '') +
    '<button type="button" class="ap-btn ghost" data-act="import"><i class="ph-bold ph-upload-simple"></i> Pulihkan dari file</button></div><input type="file" id="apImp" accept="application/json,.json" hidden></div>' +
    '<div class="ap-sec">Penyimpanan</div><div class="ap-card"><div class="ap-row ap-note"><span>Terpakai ± <b>' + fmtNum(bytes / 1048576, 2) + ' MB</b> dari batas umum ± 5 MB</span></div><div class="ap-bar ' + (pct > 80 ? 'red' : pct > 55 ? 'amber' : 'green') + '" style="margin-top:6px"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
    '<div class="ap-row" style="margin-top:10px"><button type="button" class="ap-btn ghost sm" data-act="persist"><i class="ph ph-shield-check"></i> Minta penyimpanan permanen</button><span class="ap-note" id="apPersist"></span></div></div>' +
    '<div class="ap-sec">Lainnya</div><div class="ap-card"><div class="ap-row"><span class="ap-note">Agrilonic Plus v' + PLUS_VERSION + ' · ' + (navigator.onLine ? 'online' : 'offline') + '</span><span class="ap-sp"></span><button type="button" class="ap-btn red sm" data-act="wipe"><i class="ph ph-trash"></i> Hapus semua data saya</button></div></div>';
  if(navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { const s = $('#apPersist', m.body); if(s) s.textContent = p ? 'Sudah permanen ✓' : 'Belum permanen'; }).catch(() => {});
}
function bindPengaturan(m){
  m.body.addEventListener('change', e => { if(e.target.id === 'apImp' && e.target.files[0]){ importBackup(e.target.files[0]); e.target.value = ''; } });
  m.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if(!b) return; const a = b.dataset.act;
    if(a === 'theme'){ settings.theme = b.dataset.v; saveSettings(); applyTheme(); renderPengaturan(); }
    else if(a === 'font'){ settings.font = +b.dataset.v; saveSettings(); applyFont(); renderPengaturan(); }
    else if(a === 'notif'){
      if(settings.notif){ settings.notif = false; saveSettings(); renderPengaturan(); return; }
      let p = Notification.permission; if(p === 'default') p = await Notification.requestPermission();
      if(p === 'granted'){ settings.notif = true; settings.notifDay = ''; saveSettings(); renderPengaturan(); notifyDue(true); toast('Notifikasi diaktifkan.'); } else { toast('Izin notifikasi tidak diberikan.', 'err'); renderPengaturan(); }
    }
    else if(a === 'export'){ downloadFile('agrilonic-cadangan-' + todayISO() + '.json', JSON.stringify(buildBackup()), 'application/json'); toast('Cadangan diunduh. Simpan di tempat aman.'); }
    else if(a === 'share'){
      try{ const f = new File([JSON.stringify(buildBackup())], 'agrilonic-cadangan-' + todayISO() + '.json', { type:'application/json' });
        if(navigator.canShare({ files:[f] })) await navigator.share({ files:[f], title:'Cadangan Agrilonic' }); else toast('Perangkat tidak mendukung berbagi file. Gunakan Unduh.', 'info'); }catch(x){ if(x && x.name !== 'AbortError') toast('Gagal membagikan file.', 'err'); }
    }
    else if(a === 'import'){ $('#apImp', m.body).click(); }
    else if(a === 'persist'){
      if(!(navigator.storage && navigator.storage.persist)){ toast('Browser tidak mendukung.', 'info'); return; }
      const ok = await navigator.storage.persist(); toast(ok ? 'Penyimpanan permanen diberikan.' : 'Browser belum memberi izin (coba pasang aplikasi ke layar utama).', ok ? 'ok' : 'info'); renderPengaturan();
    }
    else if(a === 'wipe'){
      if(await confirmDlg('Hapus SEMUA data?', 'Pengingat, jurnal, favorit, Kebun Saya, dan kas di perangkat ini akan dihapus <b>permanen</b>. Unduh cadangan dulu jika perlu.', 'Hapus semua', true)){
        Object.keys(BACKUP_KEYS).forEach(k => { try{ localStorage.removeItem(BACKUP_KEYS[k]); }catch(x){} }); try{ localStorage.removeItem(LS.wx); }catch(x){}
        toast('Data dihapus. Memuat ulang…', 'info'); setTimeout(() => location.reload(), 800);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* PWA: offline, pembaruan, pintasan, init                             */
/* ------------------------------------------------------------------ */
function initOffline(){
  const b = el('div'); b.id = 'apOffline'; b.setAttribute('role', 'status'); b.textContent = 'Anda sedang offline — data di perangkat tetap bisa dibuka; cuaca & AI butuh internet.';
  document.body.appendChild(b);
  const upd = () => b.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', () => { upd(); toast('Kembali online.'); }); window.addEventListener('offline', upd); upd();
}
function initUpdate(){
  if(!('serviceWorker' in navigator)) return; const had = !!navigator.serviceWorker.controller; let shown = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if(!had || shown) return; shown = true; toast('Versi baru Agrilonic sudah aktif.', 'info', { label:'Muat ulang', fn:() => location.reload() }); });
}
function handleDeepLink(){
  let a; try{ a = new URLSearchParams(location.search).get('a'); }catch(e){} if(!a) return;
  const map = { kebun:'kebun', kas:'kas', keuangan:'kas', risiko:'risiko', lahan:'lahan', cari:'cari', pengaturan:'pengaturan', pengingat:'pengingat' };
  const btn = { diagnosa:'btnDiagnosa', kamera:'btnKamera', ai:'btnAiChat', cuaca:'btnCuaca', jurnal:'btnJurnal' };
  setTimeout(() => { if(map[a]) TOOLS_BY_ID[map[a]].open(); else if(btn[a] && document.getElementById(btn[a])) document.getElementById(btn[a]).click(); }, 450);
  try{ const u = new URL(location.href); u.searchParams.delete('a'); history.replaceState(null, '', u.pathname + u.search + u.hash); }catch(e){}
}
function bindShortcuts(){
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(); const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); openCari(); }
    else if(e.key === '/' && !typing && !openStack.length && !e.ctrlKey && !e.metaKey){ e.preventDefault(); openCari(); }
  });
}
function autoWx(){
  if(!navigator.onLine) return; const loc = getLoc(); if(!loc) return;
  if(!kebun.some(k => k.status !== 'panen' && getPlant(k.plantId) && !isAnimal(getPlant(k.plantId)))) return;
  fetchWx(loc, false).then(refreshDash).catch(() => {});
}

function init(){
  applyTheme(); applyFont();
  injectMenus(); refreshDash(); initOffline(); initUpdate(); bindShortcuts();
  try{ const u = window.updateReminderBadge; if(typeof u === 'function' && !u.__ap){ const w = function(){ const r = u.apply(this, arguments); refreshDash(); return r; }; w.__ap = true; window.updateReminderBadge = w; } }catch(e){}
  document.addEventListener('visibilitychange', () => { if(!document.hidden){ refreshDash(); notifyDue(); } });
  handleDeepLink(); notifyDue(); autoWx();
  window.AgrilonicPlus = { version: PLUS_VERSION, open:{ kebun:openKebun, kas:openKas, risiko:openRisiko, lahan:openLahan, cari:openCari, pengaturan:openPengaturan }, _t:{ riskScores, phaseRange, classifyDisease, wxFeatures, sanitizeDeep, mergeVal, thiOf } };
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
