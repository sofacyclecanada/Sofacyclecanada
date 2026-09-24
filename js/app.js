/* ══════════════════════════════════════════════════════════════════════
   SOFA CYCLE CANADA — app.js
   Edit config.js and inventory.js, not this file.
   ══════════════════════════════════════════════════════════════════════ */
"use strict";

/* ═══════════ FORM SUBMISSION (Netlify Forms) ═══════════
   Every form posts here. If it fails, the customer is told to text —
   a lead is never silently lost. */
async function submitForm(formName, data) {
  const body = new URLSearchParams({ "form-name": formName, ...data });
  const res = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) throw new Error("Submission failed (" + res.status + ")");
  pushAlert(formName, data);          /* fire-and-forget instant ping */
  return true;
}

/* Optional instant notification. Never blocks or breaks the submission —
   if it fails, the customer's form still went through to Netlify. */
function pushAlert(formName, data) {
  if (!CONFIG.alertWebhook) return;
  const titles = {
    "sofa-reservation": "🛋️ SOFA CLAIMED",
    "sofa-waitlist":    "📲 New waitlist signup",
    "sofa-cleaning":    "🧼 Cleaning booking",
    "sofa-donation":    "❤️ Sofa donation offer"
  };
  const lines = [
    titles[formName] || formName,
    data.sofa ? data.sofa : "",
    data.name ? `${data.name} — ${data.phone || ""}` : "",
    data.address || "",
    data.amount_due_today ? `Due today: ${data.amount_due_today}` : "",
    data.estimate ? `Estimate: ${data.estimate}` : "",
    data.looking_for ? `Wants: ${data.looking_for} · ${data.budget || ""}` : ""
  ].filter(Boolean).join("\n");
  try {
    fetch(CONFIG.alertWebhook, { method: "POST", body: lines }).catch(() => {});
  } catch (e) { /* silent */ }
}

function busy(btn, label) {
  if (!btn) return () => {};
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>' + (label || "Sending…");
  return () => { btn.disabled = false; btn.innerHTML = original; };
}

function failBox(msg) {
  return `<div class="formerr">⚠️ ${msg}<br>
    Please text us at <a href="tel:${CONFIG.phone}">${CONFIG.phoneDisplay}</a>
    and we'll sort it out right away.</div>`;
}

/* ═══════════ HELPERS ═══════════ */
const $  = (id) => document.getElementById(id);
const money = (n) => "$" + Number(n).toLocaleString("en-CA");

function fmtPhone(v) {
  const d = String(v).replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return d.slice(0, 3) + "-" + d.slice(3);
  return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
}
function validPhone(v) { return String(v).replace(/\D/g, "").length === 10; }

function clrErr(el) {
  el.classList.remove("err");
  const m = el.parentElement.querySelector(".emsg");
  if (m) m.classList.remove("show");
}
function setErr(id, msg) {
  const el = $(id); if (!el) return;
  el.classList.add("err");
  const m = el.parentElement.querySelector(".emsg");
  if (m) { m.textContent = msg; m.classList.add("show"); }
}

function toast(msg, isErr) {
  const t = $("ts"); if (!t) return;
  t.textContent = msg;
  t.style.background = isErr ? "#C0424C" : "#4FC98A";
  t.style.color = isErr ? "#fff" : "#04241a";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3400);
}

function go(id) {
  const el = $(id); if (!el) return;
  try { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  catch (e) { el.scrollIntoView(); }
}


/* ═══════════ DELIVERY DISTANCE ═══════════
   Real distance from base, so we never promise free delivery we can't honour. */
function distanceKm(lat, lon) {
  const R = 6371, base = CONFIG.deliveryBase;
  const dLat = (lat - base.lat) * Math.PI / 180;
  const dLon = (lon - base.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(base.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* Coordinates give an exact answer; a postal code gives a good guess. */
function zoneCheck(value, coords) {
  if (coords && coords.lat) {
    const d = distanceKm(coords.lat, coords.lon);
    return { free: d <= CONFIG.freeRadiusKm, km: d, exact: true };
  }
  const v = String(value).toUpperCase().replace(/\s/g, "");
  if (v.length < 3) return null;
  const free = CONFIG.freePostalPrefixes.some(p => v.startsWith(p));
  return { free, km: null, exact: false };
}

function deliveryFee(km) {
  /* $50 base beyond the free radius, +$10 per additional 5 km */
  if (km <= CONFIG.freeRadiusKm) return 0;
  const extra = km - CONFIG.freeRadiusKm;
  return CONFIG.deliveryFeeFrom + Math.floor(extra / 5) * 10;
}

function zoneMessage(r) {
  if (!r) return "";
  if (r.free) {
    return r.exact
      ? `✅ ${r.km.toFixed(1)} km away — <b>free delivery</b>, no fee.`
      : `✅ Looks like you're in our <b>free delivery</b> area.`;
  }
  if (r.exact) {
    const fee = deliveryFee(r.km);
    return `🚚 ${r.km.toFixed(0)} km away — we deliver there. Delivery is
      <b>about ${money(fee)}</b>, confirmed when we text you.`;
  }
  return `🚚 We deliver across the GTA. Outside 10 km there's a delivery fee
    from <b>${money(CONFIG.deliveryFeeFrom)}</b> depending on distance.`;
}



/* ═══════════ ADDRESS AUTOCOMPLETE ═══════════
   Suggests addresses as you type, then fills the postal code on select.
   Default provider is Photon (OpenStreetMap) — free, no API key.
   Fails silently: if the lookup is down, typing still works normally. */

let acTimer = null, acItems = [], acIndex = -1, acTarget = null;

async function fetchPhoton(q) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}`
    + `&limit=6&lang=en&lat=${CONFIG.addressBiasLat}&lon=${CONFIG.addressBiasLon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("lookup failed");
  const data = await res.json();
  return (data.features || [])
    .filter(f => (f.properties.country === "Canada" || !f.properties.country))
    .map(f => {
      const p = f.properties;
      const street = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
      const city = p.city || p.town || p.village || p.district || "";
      return {
        line: street || p.name || "",
        city,
        postal: (p.postcode || "").toUpperCase(),
        lat: f.geometry && f.geometry.coordinates ? f.geometry.coordinates[1] : null,
        lon: f.geometry && f.geometry.coordinates ? f.geometry.coordinates[0] : null,
        label: [street || p.name, city, p.state].filter(Boolean).join(", ")
      };
    })
    .filter(x => x.line);
}

async function fetchGoogle(q) {
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`
    + `?input=${encodeURIComponent(q)}&components=country:ca&types=address`
    + `&key=${CONFIG.googlePlacesKey}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.predictions || []).map(p => ({
    line: p.structured_formatting.main_text,
    city: (p.structured_formatting.secondary_text || "").split(",")[0],
    postal: "",
    label: p.description,
    placeId: p.place_id
  }));
}

function acBox(input) {
  let box = input.parentElement.querySelector(".acbox");
  if (!box) {
    box = document.createElement("div");
    box.className = "acbox";
    input.parentElement.style.position = "relative";
    input.parentElement.appendChild(box);
  }
  return box;
}

function acClose(input) {
  const box = input && input.parentElement.querySelector(".acbox");
  if (box) box.classList.remove("open");
  acIndex = -1;
}

function acRender(input) {
  const box = acBox(input);
  if (!acItems.length) { box.classList.remove("open"); return; }
  box.innerHTML = acItems.map((s, i) => `
    <div class="acitem${i === acIndex ? " on" : ""}" data-i="${i}">
      <span class="acpin">📍</span>
      <span class="acmain">${s.line}</span>
      <span class="acsub">${[s.city, s.postal].filter(Boolean).join(" · ")}</span>
    </div>`).join("");
  box.classList.add("open");
  box.querySelectorAll(".acitem").forEach(el =>
    el.addEventListener("mousedown", e => { e.preventDefault(); acPick(+el.dataset.i, input); }));
}

function acPick(i, input) {
  const s = acItems[i];
  if (!s) return;
  input.value = s.line + (s.city ? ", " + s.city : "");
  clrErr(input);

  /* Fill the matching postal code field and re-run the delivery check */
  const postalId = acTarget === "reserve" ? "pc" : "d_pc";
  const pc = $(postalId);
  if (pc && s.postal) {
    pc.value = s.postal;
    pc.classList.add("acfilled");
    setTimeout(() => pc.classList.remove("acfilled"), 1200);
    const coords = (s.lat && s.lon) ? { lat: s.lat, lon: s.lon } : null;
    if (acTarget === "reserve") { checkZone(pc, coords); saveDraft(); }
    else { donCoords = coords; donZone(pc, coords); }
  }
  if (!s.postal && s.lat) {
    const r = zoneCheck("", { lat: s.lat, lon: s.lon });
    const z = $(acTarget === "reserve" ? "zn" : "d_zone");
    if (z) { z.className = r.free ? "zone ok show" : "zone no show"; z.innerHTML = zoneMessage(r); }
  }
  acClose(input);
  if (acTarget === "reserve") { saveDraft(); progress(); }
}

function addressInput(input, which) {
  acTarget = which;
  clrErr(input);
  if (which === "reserve") progress();
  const q = input.value.trim();
  clearTimeout(acTimer);
  if (q.length < 4) { acItems = []; acClose(input); return; }

  acTimer = setTimeout(async () => {
    try {
      const useGoogle = CONFIG.addressProvider === "google" && CONFIG.googlePlacesKey;
      acItems = useGoogle ? await fetchGoogle(q) : await fetchPhoton(q);
      acIndex = -1;
      acRender(input);
    } catch (e) {
      acItems = []; acClose(input);   /* silent — typing still works */
    }
  }, 280);
}

function addressKeys(e, input) {
  const box = input.parentElement.querySelector(".acbox");
  if (!box || !box.classList.contains("open")) return;
  if (e.key === "ArrowDown") { e.preventDefault(); acIndex = Math.min(acIndex + 1, acItems.length - 1); acRender(input); }
  else if (e.key === "ArrowUp") { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); acRender(input); }
  else if (e.key === "Enter" && acIndex >= 0) { e.preventDefault(); acPick(acIndex, input); }
  else if (e.key === "Escape") acClose(input);
}

document.addEventListener("click", e => {
  document.querySelectorAll(".acbox.open").forEach(b => {
    if (!b.parentElement.contains(e.target)) b.classList.remove("open");
  });
});

/* Afterpay eligibility — Square's range is $1–$2,000 */
function apEligible(price){
  const a = CONFIG.afterpay;
  return a && a.enabled && price >= a.minOrder && price <= a.maxOrder;
}


/* ═══════════ BUYER-FACING HELPERS ═══════════ */

/* Canadians measure doorways in inches. Show both so nobody has to convert. */
function dimsBoth(d) {
  const m = String(d).match(/(\d+)\s*[×x]\s*(\d+)\s*cm/i);
  if (!m) return d;
  const w = Math.round(+m[1] / 2.54), dp = Math.round(+m[2] / 2.54);
  return `${m[1]}×${m[2]} cm <span class="dim-in">(${w}"×${dp}")</span>`;
}

/* "Listed 3 days ago" — freshness matters when stock turns over fast */
function listedAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return "Listed today";
  if (days === 1) return "Listed yesterday";
  if (days < 7) return `Listed ${days} days ago`;
  if (days < 14) return "Listed last week";
  if (days < 60) return `Listed ${Math.floor(days / 7)} weeks ago`;
  return "Been here a while — make an offer";
}
function isNewListing(iso) {
  return iso && (Date.now() - new Date(iso)) / 86400000 <= 7;
}

/* Photo gallery for Quick View — used furniture needs more than one angle */
let galleryIndex = 0;
function galleryFor(s) {
  return (s.photos && s.photos.length ? s.photos : [s.img]).filter(Boolean);
}
function setGallery(i, id) {
  const s = inv.find(x => x.id === id); if (!s) return;
  const pics = galleryFor(s);
  galleryIndex = (i + pics.length) % pics.length;
  const img = document.querySelector(".qvi");
  if (img) img.src = "assets/" + pics[galleryIndex];
  document.querySelectorAll(".gdot").forEach((d, n) => d.classList.toggle("on", n === galleryIndex));
  const c = $("gcount"); if (c) c.textContent = `${galleryIndex + 1} / ${pics.length}`;
}

/* ═══════════ STATE ═══════════ */
let inv = INVENTORY.map(s => ({ ...s }));
let cart = [], sel = null, fil = "all", srt = "d";
let step = 1, draft = {}, payMode = "deposit";
let tier = 1, cleanTier = 0, cleanAddons = [];
let roff = 0, hstep = 0, donPhotos = [];

/* ═══════════ INVENTORY RENDER ═══════════ */
function filtered() {
  let l = inv.filter(s => {
    if (fil === "all") return true;
    if (fil === "under-450") return s.price <= 450;
    if (fil === "likenew") return s.condition === "Like New";
    return s.type === fil;
  });
  if (srt === "pa") l = [...l].sort((a, b) => a.price - b.price);
  else if (srt === "pd") l = [...l].sort((a, b) => b.price - a.price);
  else if (srt === "c") l = [...l].sort((a) => a.condition === "Like New" ? -1 : 1);
  else if (srt === "n") l = [...l].sort((a, b) => new Date(b.listed || 0) - new Date(a.listed || 0));
  return l;
}

function renderInv() {
  const grid = $("ig"); if (!grid) return;
  const l = filtered();
  const rc = $("rc");
  if (rc) rc.textContent = `${l.length} sofas · ${l.filter(s => s.status === "available").length} available now`;

  if (!l.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;
      background:var(--card);border:1px dashed var(--line-2);border-radius:14px">
      <div style="font-size:2.6rem;margin-bottom:10px">🛋️</div>
      <div style="font-family:Nunito;font-weight:800;color:var(--white);margin-bottom:6px">Nothing matches that filter</div>
      <div style="color:var(--muted);font-size:.86rem;margin-bottom:16px">New sofas land every week — join the list and we'll text you first.</div>
      <button class="btn-g" onclick="go('waitlist')">Get Notified →</button></div>`;
    updateCount(); return;
  }

  grid.innerHTML = l.map(s => {
    const sold = s.status === "sold", res = s.status === "reserved", hold = s.status === "hold";
    const pct = s.rrp ? Math.round((1 - s.price / s.rrp) * 100) : 0;
    const bc = res ? "c-res" : hold ? "c-hold" : s.condition === "Like New" ? "c-new" : "c-good";
    const bl = res ? "Reserved" : hold ? "On Hold" : s.condition;
    return `<article class="scard" onclick="qv(${s.id})">
      <div class="iw">
        ${s.img ? `<img src="assets/${s.img}" alt="${s.brand} ${s.name} — used sofa Toronto" loading="lazy" width="620" height="465">`
                : `<div class="iph">🛋️</div>`}
        ${s.was && !sold ? `<span class="save-flag">REDUCED</span>`
          : s.rrp && !sold ? `<span class="save-flag">SAVE ${pct}%</span>` : ""}
        <span class="cbadge ${bc}" style="${(s.rrp || s.was) && !sold ? "left:auto;right:10px;top:10px" : ""}"
          title="${CONDITIONS[s.condition] || ""}">${bl}</span>
        ${isNewListing(s.listed) && !sold && !res && !hold ? `<span class="fresh">NEW IN</span>` : ""}
        ${s.hot && !sold && !res && !hold ? `<span class="hot" style="${(s.rrp || s.was) ? "top:42px" : ""}">🔥 Hot</span>` : ""}
        ${sold ? '<div class="soldo">SOLD</div>' : ""}
      </div>
      <button class="qv" onclick="event.stopPropagation();qv(${s.id})">Quick View →</button>
      <div class="cb">
        <h3 class="cn">${s.name}</h3>
        <div class="cm">${s.brand} · ${s.colour} · ${dimsBoth(s.dims)}</div>
        <div class="cnote">${s.note}</div>
        ${s.listed ? `<div class="listed">${listedAgo(s.listed)}</div>` : ""}
        <div class="cf">
          <div class="price-block">
            ${s.was ? `<span class="rrp">Was ${money(s.was)}</span>`
                    : s.rrp ? `<span class="rrp">Comparable new ${money(s.rrp)}</span>` : ""}
            <span class="cp">${money(s.price)}</span>
            ${s.was ? `<span class="saved">Reduced by ${money(s.was - s.price)}</span>`
                    : s.rrp ? `<span class="saved">You save ${money(s.rrp - s.price)}</span>`
                    : `<small style="font-size:.7rem;color:var(--muted)">${money(CONFIG.deposit)} holds it</small>`}
            ${apEligible(s.price) ? `<span class="ap-mini">card, e-transfer or 4× ${money(Math.ceil(s.price/4))} Afterpay</span>` : ""}
          </div>
          <button class="rbtn" ${sold || res || hold ? "disabled" : ""}
            onclick="event.stopPropagation();openReserve(${s.id})">${sold ? "Sold" : res ? "Reserved" : hold ? "On Hold" : "Claim It"}</button>
        </div>
      </div></article>`;
  }).join("");
  updateCount();
}

function updateCount() {
  const n = inv.filter(s => s.status === "available").length;
  const a = $("an"), b = $("hac");
  if (a) a.textContent = n;
  if (b) b.textContent = n + " sofas";
}

function setF(f, btn) {
  fil = f;
  document.querySelectorAll(".fbtn").forEach(x => x.classList.remove("on"));
  if (btn) btn.classList.add("on");
  renderInv();
}
function setS(v) { srt = v; renderInv(); }

/* ═══════════ QUICK VIEW ═══════════ */
function qv(id) {
  const s = inv.find(x => x.id === id); if (!s) return;
  const sold = s.status === "sold", res = s.status === "reserved", hold = s.status === "hold";
  $("qi").innerHTML = `<button class="qvc" onclick="closeQV()">✕</button>
    ${s.img ? `<div class="qvi-wrap">
      <img class="qvi" src="assets/${galleryFor(s)[0]}" alt="${s.name}">
      ${galleryFor(s).length > 1 ? `
        <button class="gnav gprev" onclick="setGallery(galleryIndex-1,${s.id})" aria-label="Previous photo">‹</button>
        <button class="gnav gnext" onclick="setGallery(galleryIndex+1,${s.id})" aria-label="Next photo">›</button>
        <div class="gcount" id="gcount">1 / ${galleryFor(s).length}</div>
        <div class="gdots">${galleryFor(s).map((_,i)=>`<span class="gdot${i===0?' on':''}" onclick="setGallery(${'${i}'},${s.id})"></span>`).join("")}</div>
      ` : `<div class="gcount gcount-one">📷 More photos on request — just text us</div>`}
    </div>` : `<div class="qvph">🛋️</div>`}
    <div class="qvb">
      <span class="qvt">${s.brand} · ${s.type}</span>
      <h3 class="qvn">${s.name}</h3>
      <div class="qvp">${money(s.price)} <small>· ${money(CONFIG.deposit)} holds it</small></div>
      ${s.rrp ? `<div class="qv-save">
        <div><div class="qv-save-l">Comparable new</div>
        <div style="text-decoration:line-through;color:var(--muted);font-size:.86rem">${money(s.rrp)}</div></div>
        <div class="qv-save-v">Save ${money(s.rrp - s.price)}<br>
        <span style="font-size:.72rem;font-weight:700">${Math.round((1 - s.price / s.rrp) * 100)}% off</span></div></div>` : ""}
      ${s.fit ? `<div class="fit-note">📏 <b>Will it fit?</b> Needs about <b>${s.fit}" (${Math.round(s.fit * 2.54)} cm)</b>
        of clear doorway width. Measure your narrowest doorway, stairwell turn and elevator before claiming —
        text us the numbers if you're unsure and we'll tell you honestly.</div>` : ""}
      <div class="qvsp">
        <div class="qsp"><div class="qsp-l">Colour</div><div class="qsp-v">${s.colour}</div></div>
        <div class="qsp"><div class="qsp-l">Dimensions</div><div class="qsp-v">${dimsBoth(s.dims)}</div></div>
        <div class="qsp"><div class="qsp-l">Condition</div><div class="qsp-v">${s.condition}</div></div>
        <div class="qsp"><div class="qsp-l">Balance Due</div><div class="qsp-v">${money(s.price - CONFIG.deposit)} on delivery</div></div>
      </div>
      <p class="qvd">${s.note}</p>
      ${CONDITIONS[s.condition] ? `<div class="cond-note"><b>"${s.condition}" means:</b> ${CONDITIONS[s.condition]}</div>` : ""}
      ${s.listed ? `<div class="qv-listed">🕒 ${listedAgo(s.listed)}</div>` : ""}
      <div class="qva">
        ${!sold && !res && !hold ? `<button class="qvr" onclick="closeQV();openReserve(${s.id})">Claim It — ${money(CONFIG.deposit)} Deposit →</button>` : ""}
        ${hold ? `<div class="hold-note">🤝 On hold for another buyer right now. Holds fall through often —
          <a href="#" onclick="closeQV();nav('/','waitlist');return false">join the waitlist</a> and we'll text you first if it comes back.</div>` : ""}
        ${CONFIG.phone ? `<a class="qvs" href="sms:${CONFIG.phone}&body=Hi! I have a question about the ${encodeURIComponent(s.name)}"
           style="text-decoration:none;text-align:center">💬 Ask a question</a>` : ""}
      </div></div>`;
  galleryIndex = 0;
  $("qov").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeQV() {
  $("qov").classList.remove("open");
  document.body.style.overflow = "";
}
function qvBg(e) { if (e.target === $("qov")) closeQV(); }

/* ═══════════ RESERVE / CHECKOUT ═══════════ */
function openReserve(id) {
  const s = inv.find(x => x.id === id);
  if (!s || s.status !== "available") return;
  if (sel && sel.id !== id) { draft = {}; payMode = "deposit"; }
  sel = s; step = 1; renderStep();
  $("ov").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  saveDraft();
  $("ov").classList.remove("open");
  document.body.style.overflow = "";
}
function modalBg(e) { if (e.target === $("ov")) closeModal(); }

function saveDraft() {
  ["f1","f2","f3","f4","f5","f6","f7","f8","pc"].forEach(k => {
    const e = $(k); if (e) draft[k] = e.value;
  });
  const sms = $("sms"); if (sms) draft.sms = sms.checked;
  const ad = $("addOn"); if (ad) draft.addOn = ad.checked;
}
const D = (k) => draft[k] || "";

function checkZone(el, coords) {
  draft.pc = el.value;
  if (coords) draft.coords = coords;
  const z = $("zn"); if (!z) return;
  const r = zoneCheck(el.value, coords || draft.coords);
  if (r === null) { z.className = "zone"; return; }
  z.className = r.free ? "zone ok show" : "zone no show";
  z.innerHTML = zoneMessage(r);
  progress();
}

function progress() {
  const filled = ["f1","f3","f4","pc"].map(i => $(i)?.value.trim()).filter(Boolean).length;
  const f = $("pf"); if (f) f.style.width = Math.round(filled / 4 * 100) + "%";
}

function setPay(m) { payMode = m; saveDraft(); renderStep(); }

function renderStep() {
  const on = draft.addOn;
  const bar = `<div class="steps">
    <div class="stp ${step === 1 ? "on" : "done"}"><div class="stp-n">${step > 1 ? "✓" : "1"}</div><div class="stp-t">Your details</div></div>
    <div class="stp-line ${step > 1 ? "done" : ""}"></div>
    <div class="stp ${step === 2 ? "on" : ""}"><div class="stp-n">2</div><div class="stp-t">Delivery &amp; pay</div></div></div>`;
  const prev = `<div class="prev"><div class="pv-l">
    ${sel.img ? `<img class="pv-i" src="assets/${sel.img}" alt="">` : `<div class="pv-ph">🛋️</div>`}
    <div><div class="pv-n">${sel.name}</div><div class="pv-m">${sel.brand} · ${sel.colour} · ${sel.dims}</div></div>
    </div><div class="pv-p">${money(sel.price)}</div></div>`;

  let body, foot;
  if (step === 1) {
    body = `${bar}${prev}
      <div class="dep">✅ <b>${money(CONFIG.deposit)}</b> holds this sofa today — or pay in full at the next step and
        <b>save ${money(CONFIG.payInFullSaves)}</b>.</div>
      <div class="frow">
        <div class="fg"><label class="fl">First Name</label>
          <input class="fi" id="f1" value="${D("f1")}" placeholder="Jane" oninput="clrErr(this);progress()"><div class="emsg"></div></div>
        <div class="fg"><label class="fl">Last Name <span class="opt">(optional)</span></label>
          <input class="fi" id="f2" value="${D("f2")}" placeholder="Smith"></div></div>
      <div class="fg"><label class="fl">📱 Mobile Number</label>
        <input class="fi" id="f3" type="tel" inputmode="numeric" value="${D("f3")}" placeholder="647-555-1234"
          oninput="this.value=fmtPhone(this.value);clrErr(this);progress()"><div class="emsg"></div></div>
      <div class="fg"><label class="fl">📍 Delivery Address</label>
        <input class="fi" id="f4" value="${D("f4")}" placeholder="Start typing your address…"
          autocomplete="off" oninput="addressInput(this,'reserve')"
          onkeydown="addressKeys(event,this)"><div class="emsg"></div>
        <div class="hintline">Pick from the list and we'll fill in your postal code</div></div>
      <div class="fg"><label class="fl">Postal Code</label>
        <input class="fi" id="pc" value="${D("pc")}" placeholder="M5V 1A1" maxlength="7"
          style="text-transform:uppercase" oninput="checkZone(this)"><div class="zone" id="zn"></div></div>
      <div class="consent"><label><input type="checkbox" id="sms" ${draft.sms !== false ? "checked" : ""}>
        <span>Yes — text me delivery updates at this number. Only about this order. Reply STOP anytime.</span></label></div>
      <div class="pbar"><div class="pfill" id="pf"></div></div>`;
    foot = `<button class="sbtn" onclick="nextStep()">Continue → Delivery Details</button>
      ${CONFIG.phone ? `<div class="txtalt"><a href="sms:${CONFIG.phone}">💬 Prefer to text? Message us instead</a>
      <p>We reply fast — usually within minutes</p></div>` : ""}`;
  } else {
    /* three ways to pay:
         deposit   — $99 card via Square, balance on delivery
         etransfer — full amount by e-transfer, $25 off (no processing fee)
         card      — full amount by card via Square, full price, Afterpay works here */
    const isFull = payMode === "etransfer" || payMode === "card";
    const addons = cart.reduce((s, i) => s + i.price * i.qty, 0) + (on ? 28 : 0);
    const sofaDue = payMode === "etransfer" ? sel.price - CONFIG.payInFullSaves
                  : payMode === "card"      ? sel.price
                  : CONFIG.deposit;
    const today = sofaDue + addons;
    const later = isFull ? 0 : sel.price - CONFIG.deposit;
    const full = isFull;
    body = `${bar}${prev}
      <div class="frow">
        <div class="fg"><label class="fl">Unit / Apt <span class="opt">(optional)</span></label>
          <input class="fi" id="f5" value="${D("f5")}" placeholder="Apt 2B"></div>
        <div class="fg"><label class="fl">Delivery Window</label><select class="fs" id="f6">
          ${["Flexible / ASAP","Weekday morning (9–12)","Weekday afternoon (12–5)","Weekend morning","Weekend afternoon"]
            .map(o => `<option ${D("f6") === o ? "selected" : ""}>${o}</option>`).join("")}</select></div></div>
      <div class="fg"><label class="fl">Building Access</label><select class="fs" id="f7">
        ${["Elevator building","Ground floor / no stairs","Stairs only (note floor below)"]
          .map(o => `<option ${D("f7") === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      <div class="fg"><label class="fl">Anything we should know? <span class="opt">(optional)</span></label>
        <textarea class="ft" id="f8" placeholder="Buzzer code, parking, floor number, tight doorway...">${D("f8")}</textarea></div>
      <div class="consent"><label><input type="checkbox" id="addOn" ${on ? "checked" : ""} onchange="saveDraft();renderStep()">
        <span><b style="color:var(--gold);font-family:Nunito">Add Defense Sheets — $28</b><br>
        Protect your new sofa from day one. 12 clear sheets, cats scratch these not your fabric. 🐱</span></label></div>`;
    foot = `<div class="paychoice">
      <div class="payopt ${payMode === "deposit" ? "on" : ""}" onclick="setPay('deposit')"><div class="payopt-radio"></div>
        <div class="payopt-body">
          <div class="payopt-top"><span class="payopt-t">Reserve with a deposit</span><span class="payopt-p">${money(CONFIG.deposit)}</span></div>
          <div class="payopt-d">Pay ${money(CONFIG.deposit)} by card now to hold it. Remaining
            <b style="color:var(--text)">${money(sel.price - CONFIG.deposit)}</b> on delivery day.</div>
          <div class="payopt-note">Non-refundable, but transferable to any other sofa.</div></div></div>

      <div class="payopt ${payMode === "etransfer" ? "on" : ""}" onclick="setPay('etransfer')"><div class="payopt-radio"></div>
        <div class="payopt-body">
          <div class="payopt-top"><span class="payopt-t">Pay in full by e-transfer<span class="payopt-save">SAVE ${money(CONFIG.payInFullSaves)}</span></span>
            <span class="payopt-p">${money(sel.price - CONFIG.payInFullSaves)}</span></div>
          <div class="payopt-d">We text you our e-transfer details and knock
            <b style="color:var(--text)">${money(CONFIG.payInFullSaves)}</b> off.</div>
          <div class="payopt-note">Was ${money(sel.price)} — you pay ${money(sel.price - CONFIG.payInFullSaves)}.</div></div></div>

      <div class="payopt ${payMode === "card" ? "on" : ""}" onclick="setPay('card')"><div class="payopt-radio"></div>
        <div class="payopt-body">
          <div class="payopt-top"><span class="payopt-t">Pay in full by card</span>
            <span class="payopt-p">${money(sel.price)}</span></div>
          <div class="payopt-d">Secure Square checkout — Visa, Mastercard, Amex, Apple Pay and Google Pay.
            ${apEligible(sel.price) ? `Afterpay available: <b style="color:#B2FCE4">4 × ${money(Math.ceil(sel.price/4))}</b>.` : ""}</div>
          <div class="payopt-note">Nothing owing on delivery day.</div></div></div></div>
      <div class="csum">
        <div class="cl"><span>${payMode === "etransfer" ? "Sofa (incl. e-transfer discount)"
          : payMode === "card" ? "Sofa — paid in full by card" : "Deposit (due now)"}</span><span>${money(sofaDue)}</span></div>
        ${cart.map(i => `<div class="cl"><span>${i.name}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
        ${on ? `<div class="cl"><span>🐱 Defense Sheets (12)</span><span>$28</span></div>` : ""}
        <div class="cl tot"><span>Due today</span><span>${money(today)}</span></div>
        <div class="cl"><span>Balance on delivery</span><span>${later ? money(later) : "$0 — nothing owing 🎉"}</span></div>
        ${(() => {
          const c = draft.coords;
          if (!c) return "";
          const d = distanceKm(c.lat, c.lon), f = deliveryFee(d);
          return f
            ? `<div class="cl"><span>Delivery (${d.toFixed(0)} km)</span><span>~${money(f)}</span></div>`
            : `<div class="cl"><span>Delivery (${d.toFixed(1)} km)</span><span style="color:var(--green)">FREE</span></div>`;
        })()}
        ${CONFIG.taxNote ? `<div class="taxline">${CONFIG.taxNote}</div>` : ""}</div>
      ${apEligible(sel.price) ? `<div class="ap-strip" style="margin-bottom:14px">
        <div class="ap-strip-l"><span class="ap-strip-ic">🧾</span>
          <div><div class="ap-strip-t">Or split it with Afterpay</div>
            <div class="ap-strip-d">4 interest-free payments of <b style="color:#B2FCE4">${money(Math.ceil(sel.price/4))}</b> over 6 weeks.
            Choose Afterpay on the Square checkout page.</div></div></div>
        <div class="ap-split">
          ${[1,2,3,4].map(n=>`<div class="ap-pay"><div class="ap-pay-n">Payment ${n}</div>
            <div class="ap-pay-v">${money(Math.ceil(sel.price/4))}</div></div>`).join("")}
        </div></div>` : ""}
      <div class="brow"><button class="backb" onclick="prevStep()">← Back</button>
        <button class="sbtn" id="resBtn" onclick="submitReserve()">${
          payMode === "card"      ? `Continue to Payment — ${money(today)}`
        : payMode === "etransfer" ? `Confirm — ${money(today)}`
        :                           `Claim It — ${money(today)}`}</button></div>
      <div class="trust"><span class="tr">🔒 Secure</span><span class="tr">🔁 Transferable</span>
        <span class="tr">🚫 No hidden fees</span><span class="tr">🍁 Toronto based</span></div>`;
  }

  $("mi").innerHTML = `<div class="mh"><div>
    <div class="mt">${step === 1 ? "Claim Your Sofa" : "Delivery &amp; Payment"}</div>
    <div class="msb">${step === 1 ? money(CONFIG.deposit) + " holds it — takes about a minute" : "Choose how you'd like to pay"}</div>
    </div><button class="mc" onclick="closeModal()">✕</button></div>
    <div class="mb">${body}</div><div class="mf">${foot}</div>`;
  if (step === 1) { progress(); const p = $("pc"); if (p && p.value) checkZone(p); }
}

function nextStep() {
  saveDraft();
  let ok = true;
  if (!D("f1").trim()) { setErr("f1", "We need a first name"); ok = false; }
  if (!validPhone(D("f3"))) { setErr("f3", "Enter a 10-digit mobile number"); ok = false; }
  if (D("f4").trim().length < 6) { setErr("f4", "Enter your street address"); ok = false; }
  if (!ok) { toast("Just a couple of fields to fix", true); return; }
  step = 2; renderStep();
  const m = document.querySelector(".md"); if (m) m.scrollTop = 0;
}
function prevStep() {
  saveDraft(); step = 1; renderStep();
  const m = document.querySelector(".md"); if (m) m.scrollTop = 0;
}

async function submitReserve() {
  saveDraft();
  const isFull = payMode === "etransfer" || payMode === "card";
  const full = isFull;
  const addons = cart.reduce((s, i) => s + i.price * i.qty, 0) + (draft.addOn ? 28 : 0);
  const sofaDue = payMode === "etransfer" ? sel.price - CONFIG.payInFullSaves
                : payMode === "card"      ? sel.price
                : CONFIG.deposit;
  const today = sofaDue + addons;
  const restore = busy($("resBtn"), "Sending…");

  try {
    await submitForm("sofa-reservation", {
      sofa: `${sel.name} (${sel.brand}) — ${money(sel.price)}`,
      sofa_id: sel.id,
      name: `${D("f1")} ${D("f2")}`.trim(),
      phone: D("f3"),
      address: D("f4"),
      unit: D("f5"),
      postal: D("pc"),
      delivery_window: D("f6"),
      building_access: D("f7"),
      notes: D("f8"),
      payment_type: payMode === "card" ? "Paid in full — card (Square)"
                  : payMode === "etransfer" ? "Paid in full — e-transfer"
                  : "Deposit ($99 card)",
      amount_due_today: money(today),
      balance_on_delivery: isFull ? "$0" : money(sel.price - CONFIG.deposit),
      defense_sheets: draft.addOn ? "Yes (+$28)" : "No",
      sms_consent: draft.sms !== false ? "Yes" : "No"
    });
  } catch (err) {
    $("mi").insertAdjacentHTML("afterbegin", failBox("We couldn't submit that just now."));
    restore();
    const m = document.querySelector(".md"); if (m) m.scrollTop = 0;
    return;
  }

  const s = inv.find(x => x.id === sel.id); if (s) s.status = "reserved";
  /* Deposit → fixed $99 Square link.
     Card in full → buyer-enters-amount Square link (Afterpay lives here).
     E-transfer → no link; we text details. */
  const payLink = payMode === "card"      ? (sel.payLink || CONFIG.squareBalance || "")
                : payMode === "deposit"   ? (CONFIG.squareDeposit || "")
                :                           "";
  const payLabel = payMode === "card"
    ? `Pay ${money(today)} by Card →`
    : `Pay ${money(CONFIG.deposit)} Deposit Now →`;

  $("mi").innerHTML = `<div class="succ"><div class="sic">🎉</div>
    <div class="stt">You're all set, ${D("f1")}!</div>
    <p class="smg">Your <b style="color:var(--text)">${sel.name}</b> is held. We'll text
      <b style="color:var(--text)">${D("f3")}</b> to confirm your delivery window.</p>
    <ul class="sstp">
      <li>📱 Text confirmation within minutes</li>
      <li>📅 We'll lock in a delivery time that suits you</li>
      <li>🚐 Another text when we're 20 minutes away</li>
      ${payMode === "etransfer"
        ? `<li>💳 We'll text you our e-transfer details for ${money(today)}</li>
           <li>✅ Nothing owing on delivery day — you saved ${money(CONFIG.payInFullSaves)}</li>`
        : payMode === "card"
        ? `<li>💳 Complete your ${money(today)} card payment using the button below</li>
           <li>✅ Nothing owing on delivery day</li>`
        : `<li>💵 Balance of ${money(sel.price - CONFIG.deposit)} due on arrival — cash, e-transfer or card</li>`}
      ${draft.addOn ? "<li>🐱 Defense Sheets included with your delivery</li>" : ""}
      <li>🍁 Thanks for choosing preloved</li></ul>
    ${payLink ? `<a class="sbtn" href="${payLink}" target="_blank" rel="noopener"
        style="display:block;text-decoration:none;text-align:center;margin-bottom:10px">
        ${payLabel} →</a>` : ""}
    ${payMode === "deposit" && CONFIG.squareBalance ? `<div class="paylater">
        Rather pay the balance by card too? <a href="${CONFIG.squareBalance}" target="_blank" rel="noopener">Pay ${money(sel.price - CONFIG.deposit)} by card</a>
        <span>Otherwise it's cash or e-transfer on delivery day — no fee either way.</span></div>` : ""}
    <button class="${payLink ? "backb" : "sbtn"}" style="width:100%" onclick="closeModal();renderInv()">Back to Browsing →</button></div>`;
  draft = {}; renderInv();
}

/* ═══════════ CART ═══════════ */
function pickTier(i, el) {
  tier = i;
  document.querySelectorAll(".tier").forEach(t => t.classList.remove("best"));
  el.classList.add("best");
  const p = $("dsPrice"); if (p) p.textContent = money(SHEET_TIERS[i].price);
}
function addDefense() {
  const t = SHEET_TIERS[tier];
  const ex = cart.find(x => x.id === "sheets" && x.tier === tier);
  if (ex) ex.qty++;
  else cart.push({ id: "sheets", name: "Defense Sheets — " + t.label, price: t.price, emoji: "🐱", qty: 1, tier });
  badge(); toast(`🐱 Defense Sheets (${t.label}) added`);
}
function badge() {
  const n = cart.reduce((s, i) => s + i.qty, 0);
  const e = $("cc"); if (!e) return;
  e.textContent = n; e.classList.toggle("show", n > 0);
}
function openCart() { drawCart(); $("cartOv").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeCart() { $("cartOv").classList.remove("open"); document.body.style.overflow = ""; }
function cartBg(e) { if (e.target === $("cartOv")) closeCart(); }
function qty(id, t, d) {
  const i = cart.findIndex(x => x.id === id && x.tier === t); if (i < 0) return;
  cart[i].qty += d; if (cart[i].qty < 1) cart.splice(i, 1);
  badge(); drawCart();
}
function rmCart(id, t) { cart = cart.filter(x => !(x.id === id && x.tier === t)); badge(); drawCart(); }
function drawCart() {
  const b = $("cartBody"), f = $("cartFoot"); if (!b) return;
  if (!cart.length) {
    b.innerHTML = `<div class="cart-empty"><div class="cart-empty-ic">🛒</div>
      <div style="font-family:Nunito;font-weight:800;color:var(--white);margin-bottom:6px">Your cart is empty</div>
      <div style="font-size:.84rem;margin-bottom:18px">Defense Sheets protect your sofa from claws, spills and wear.</div>
      <a class="sbtn" href="index.html#defense-sheets" style="text-decoration:none;display:block;text-align:center">Stop Cat Scratches →</a></div>`;
    f.innerHTML = ""; return;
  }
  const tot = cart.reduce((s, i) => s + i.price * i.qty, 0);
  b.innerHTML = cart.map(i => `<div class="cart-item"><div class="ci-ic">${i.emoji}</div>
    <div style="flex:1;min-width:0"><div class="ci-n">${i.name}</div><div class="ci-p">${money(i.price * i.qty)}</div>
    <div class="ci-qty"><button class="qbtn" onclick="qty('${i.id}',${i.tier},-1)">−</button>
      <span class="ci-q">${i.qty}</span><button class="qbtn" onclick="qty('${i.id}',${i.tier},1)">+</button>
      <button class="ci-rm" onclick="rmCart('${i.id}',${i.tier})">Remove</button></div></div></div>`).join("");
  f.innerHTML = `<div class="cl tot" style="margin-bottom:14px"><span>Subtotal</span><span>${money(tot)}</span></div>
    ${CONFIG.squareSheets
      ? `<a class="sbtn" href="${CONFIG.squareSheets}" target="_blank" rel="noopener"
           style="display:block;text-decoration:none;text-align:center">Checkout ${money(tot)} →</a>`
      : CONFIG.phone ? `<a class="sbtn" href="sms:${CONFIG.phone}&body=Hi! I'd like to order: ${encodeURIComponent(cart.map(i => i.name + " x" + i.qty).join(", "))}"
           style="display:block;text-decoration:none;text-align:center">Text Us to Order →</a>`
      : `<a class="sbtn" href="#/" onclick="closeCart();nav('/','inventory')"
           style="display:block;text-decoration:none;text-align:center">Add a Sofa & Check Out →</a>`}
    <div class="fnote">Accessories ship with your sofa delivery, or on their own.</div>`;
}

/* ═══════════ WAITLIST ═══════════ */
let wPrefs = { wType: "Sectional", wBud: "$300–600" };
function wPick(el, group) {
  document.querySelectorAll("#" + group + " .wchip").forEach(c => c.classList.remove("on"));
  el.classList.add("on"); wPrefs[group] = el.textContent.trim();
}
async function joinWait() {
  const n = $("w1").value.trim(), p = $("w2").value.trim(), area = $("w3").value.trim();
  let ok = true;
  if (!n) { setErr("w1", "We need a name"); ok = false; }
  if (!validPhone(p)) { setErr("w2", "Enter a 10-digit number"); ok = false; }
  if (!ok) { toast("Just a couple of fields to fix", true); return; }

  const restore = busy(document.querySelector("#waitlist .sbtn"), "Adding you…");
  try {
    await submitForm("sofa-waitlist", { name: n, phone: p, area, looking_for: wPrefs.wType, budget: wPrefs.wBud });
  } catch (err) {
    document.querySelector(".wait-card").insertAdjacentHTML("afterbegin", failBox("We couldn't add you just now."));
    restore(); return;
  }
  document.querySelector(".wait-card").innerHTML = `<div style="text-align:center;padding:26px 10px">
    <div style="font-size:3.4rem;margin-bottom:12px">📲</div>
    <div style="font-family:Nunito;font-weight:900;color:var(--gold);font-size:1.25rem;margin-bottom:9px">You're on the list, ${n}!</div>
    <p style="color:var(--muted);font-size:.88rem;line-height:1.7;margin-bottom:16px">
      We'll text <b style="color:var(--text)">${p}</b> the moment a
      <b style="color:var(--text)">${wPrefs.wType.toLowerCase()}</b> in the
      <b style="color:var(--text)">${wPrefs.wBud}</b> range lands${area ? ` near ${area}` : ""} — before it hits the site.</p>
    <div style="background:var(--card);border:1px solid var(--line-2);border-radius:10px;padding:14px;text-align:left">
      <div style="font-size:.82rem;color:var(--muted);line-height:1.7">
        📸 We'll send photos first<br>🤝 No obligation — say no anytime<br>🛑 Reply STOP to leave the list</div></div></div>`;
}

/* ═══════════ CLEANING ═══════════ */
function pickClean(i, el) {
  cleanTier = i;
  document.querySelectorAll(".pcard").forEach(c => c.classList.remove("on"));
  el.classList.add("on"); cleanSum();
}
function tglAddon(el, amt) {
  el.classList.toggle("on");
  const lbl = el.textContent.trim();
  if (el.classList.contains("on")) cleanAddons.push({ lbl, amt });
  else cleanAddons = cleanAddons.filter(a => a.lbl !== lbl);
  cleanSum();
}
function cleanSum() {
  const t = CLEANING.tiers[cleanTier].price + cleanAddons.reduce((s, a) => s + a.amt, 0);
  const e = $("cleanTotal"); if (e) e.textContent = money(t);
  return t;
}
function openClean() {
  const tot = cleanSum(), svc = CLEANING.tiers[cleanTier];
  $("mi").innerHTML = `<div class="mh"><div><div class="mt">Book a Sofa Clean</div>
    <div class="msb">${svc.name} · 90–120 min in your home</div></div>
    <button class="mc" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="csum" style="margin-bottom:16px">
        <div class="cl"><span>${svc.name} deep clean</span><span>${money(svc.price)}</span></div>
        ${cleanAddons.map(a => `<div class="cl"><span>${a.lbl.replace(/\+\$\d+/, "")}</span><span>${money(a.amt)}</span></div>`).join("")}
        <div class="cl tot"><span>Estimated total</span><span>${money(tot)}</span></div></div>
      <div class="dep">💡 This is an estimate. We confirm the final price after seeing photos — and if it isn't worth cleaning, we'll tell you straight.</div>
      <div class="frow">
        <div class="fg"><label class="fl">First Name</label><input class="fi" id="c1" placeholder="Jane" oninput="clrErr(this)"><div class="emsg"></div></div>
        <div class="fg"><label class="fl">📱 Mobile</label><input class="fi" id="c2" type="tel" inputmode="numeric"
          placeholder="647-555-1234" oninput="this.value=fmtPhone(this.value);clrErr(this)"><div class="emsg"></div></div></div>
      <div class="fg"><label class="fl">📍 Address</label><input class="fi" id="c3" placeholder="123 Main St, Toronto" oninput="clrErr(this)"><div class="emsg"></div></div>
      <div class="frow">
        <div class="fg"><label class="fl">Postal Code</label><input class="fi" id="c4" placeholder="M5V 1A1" maxlength="7" style="text-transform:uppercase"></div>
        <div class="fg"><label class="fl">Preferred timing</label><select class="fs" id="c5">
          <option>Flexible / ASAP</option><option>Weekday mornings</option><option>Weekday afternoons</option>
          <option>Weekends</option><option>Evenings</option></select></div></div>
      <div class="fg"><label class="fl">Notes <span class="opt">(optional)</span></label>
        <textarea class="ft" id="c6" placeholder="Fabric type, specific stains, pet hair, parking..."></textarea></div>
      <div class="consent"><label><input type="checkbox" id="c7" checked>
        <span>Text me to confirm the booking. Only about this job. Reply STOP anytime.</span></label></div></div>
    <div class="mf"><button class="sbtn" id="cleanBtn" onclick="submitClean()">Request Booking →</button>
      <div class="trust"><span class="tr">💬 No deposit needed</span><span class="tr">🆓 Free quote first</span><span class="tr">🍁 GTA-wide</span></div>
      ${CONFIG.phone ? `<div class="txtalt"><a href="sms:${CONFIG.phone}">💬 Prefer to text? Message us instead</a><p>Send a photo and we'll quote you back</p></div>` : ""}</div>`;
  $("ov").classList.add("open");
  document.body.style.overflow = "hidden";
}
async function submitClean() {
  const n = $("c1").value.trim(), p = $("c2").value.trim(), a = $("c3").value.trim();
  let ok = true;
  if (!n) { setErr("c1", "We need a name"); ok = false; }
  if (!validPhone(p)) { setErr("c2", "Enter a 10-digit number"); ok = false; }
  if (a.length < 6) { setErr("c3", "Enter your address"); ok = false; }
  if (!ok) { toast("Just a couple of fields to fix", true); return; }

  const tot = cleanSum(), svc = CLEANING.tiers[cleanTier];
  const restore = busy($("cleanBtn"), "Sending…");
  try {
    await submitForm("sofa-cleaning", {
      name: n, phone: p, address: a, postal: $("c4").value,
      service: svc.name, addons: cleanAddons.map(x => x.lbl).join(", ") || "None",
      estimate: money(tot), timing: $("c5").value, notes: $("c6").value,
      sms_consent: $("c7").checked ? "Yes" : "No"
    });
  } catch (err) {
    $("mi").insertAdjacentHTML("afterbegin", failBox("We couldn't send that just now."));
    restore(); return;
  }
  $("mi").innerHTML = `<div class="succ"><div class="sic">🧼</div>
    <div class="stt">Booking requested, ${n}!</div>
    <p class="smg">We'll text <b style="color:var(--text)">${p}</b> to confirm your time slot — usually within the hour.</p>
    <ul class="sstp"><li>📱 We'll text to confirm a date and time</li>
      <li>📷 Send a photo and we'll firm up the quote</li>
      <li>🧼 Estimated total: ${money(tot)} — payable after the job</li>
      <li>💨 Allow 4–6 hours dry time afterwards</li></ul>
    <button class="sbtn" onclick="closeModal()">Done →</button></div>`;
}

/* ═══════════ DONATE ═══════════ */
function tglChk(el) { setTimeout(() => el.classList.toggle("on", el.querySelector("input").checked), 0); }
function donZone(el, coords) {
  const z = $("d_zone"); if (!z) return;
  const r = zoneCheck(el.value, coords || donCoords);
  if (r === null) { z.className = "zone"; return; }
  z.className = r.free ? "zone ok show" : "zone no show";
  z.innerHTML = r.free
    ? (r.exact ? `✅ ${r.km.toFixed(1)} km away — <b>free pickup</b>.` : "✅ We collect from your area — free of charge.")
    : "📍 Outside our usual route, but send it anyway — we'll take a look.";
}
let donCoords = null;
function addPhotos(files) {
  [...files].forEach(f => {
    if (!f.type.startsWith("image/")) return;
    if (donPhotos.length >= 6) { toast("6 photos is plenty — thank you!"); return; }
    if (f.size > 6 * 1024 * 1024) { toast("That photo's too large (max 6 MB)", true); return; }
    const r = new FileReader();
    r.onload = e => { donPhotos.push({ name: f.name, data: e.target.result, file: f }); drawThumbs(); };
    r.readAsDataURL(f);
  });
}
function drawThumbs() {
  const t = $("thumbs"); if (!t) return;
  t.innerHTML = donPhotos.map((p, i) =>
    `<div class="thumb"><img src="${p.data}" alt="${p.name}"><button class="thumb-x" onclick="rmPhoto(${i})">✕</button></div>`).join("");
}
function rmPhoto(i) { donPhotos.splice(i, 1); drawThumbs(); }
function initDrop() {
  const d = $("drop"); if (!d) return;
  ["dragenter", "dragover"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove("over"); }));
  d.addEventListener("drop", e => addPhotos(e.dataTransfer.files));
}

async function submitDonate() {
  const n = $("d_name").value.trim(), p = $("d_phone").value.trim(), a = $("d_addr").value.trim();
  let ok = true;
  if (!n) { setErr("d_name", "We need a name"); ok = false; }
  if (!validPhone(p)) { setErr("d_phone", "Enter a 10-digit number"); ok = false; }
  if (a.length < 6) { toast("Please add a pickup address", true); ok = false; }
  if (!ok) { if (n && p) toast("Just a couple of fields to fix", true); return; }
  if (!donPhotos.length) {
    toast("Please add at least one photo so we can assess it", true);
    $("drop").scrollIntoView({ behavior: "smooth", block: "center" }); return;
  }

  const flags = [];
  if ($("d_pets").checked)  flags.push("Pets in home");
  if ($("d_smoke").checked) flags.push("Smoking in home");
  if ($("d_stain").checked) flags.push("Known stains/damage");
  if ($("d_pest").checked)  flags.push("Past pest treatment");

  const restore = busy(document.querySelector("#donate .sbtn"), "Sending…");
  const fd = new FormData();
  fd.append("form-name", "sofa-donation");
  fd.append("name", n); fd.append("phone", p); fd.append("address", a);
  fd.append("postal", $("d_pc").value); fd.append("unit", $("d_unit").value);
  fd.append("sofa_type", $("d_type").value); fd.append("brand", $("d_brand").value);
  fd.append("age", $("d_age").value); fd.append("condition", $("d_cond").value);
  fd.append("disclosures", flags.join(", ") || "None declared");
  fd.append("building_access", $("d_access").value);
  fd.append("best_time", $("d_when").value);
  fd.append("notes", $("d_notes").value);
  fd.append("sms_consent", $("d_sms").checked ? "Yes" : "No");
  donPhotos.forEach((ph, i) => fd.append("photo" + (i + 1), ph.file, ph.file.name));

  try {
    const res = await fetch("/", { method: "POST", body: fd });
    if (!res.ok) throw new Error(res.status);
    pushAlert("sofa-donation", { name: n, phone: p, address: a });
  } catch (err) {
    document.querySelector(".don-form").insertAdjacentHTML("afterbegin", failBox("We couldn't send that just now."));
    restore(); return;
  }

  const type = $("d_type").value, cond = $("d_cond").value, count = donPhotos.length;
  document.querySelector(".don-form").innerHTML = `<div class="succ" style="padding:30px 10px">
    <div class="sic">❤️</div><div class="stt">Thank you, ${n}!</div>
    <p class="smg">We've got your <b style="color:var(--text)">${type}</b> (${cond.toLowerCase()}) and
      <b style="color:var(--text)">${count} photo${count > 1 ? "s" : ""}</b>. We'll text
      <b style="color:var(--text)">${p}</b> once we've had a look.</p>
    <ul class="sstp"><li>👀 We review your photos — usually same day</li>
      <li>📱 We text you either way, yes or no</li>
      <li>🚚 If it passes, we arrange a free pickup that suits you</li>
      <li>🧼 It gets inspected, cleaned and rehomed</li>
      <li>🍁 You've kept a sofa out of landfill — thank you</li></ul></div>`;
  donPhotos = [];
}

/* ═══════════ REVIEWS ═══════════ */
function renderReviews() {
  const grid = $("revsGrid"), sec = $("reviews");
  if (!grid) return;
  if (!CONFIG.reviews.length) { if (sec) sec.style.display = "none"; return; }
  grid.innerHTML = CONFIG.reviews.map(r => `<article class="revcard">
    <div class="rst">${"★".repeat(r.stars)}</div>
    <p class="rtx">${r.text}</p>
    <div class="rft">
      <div class="rav">${r.author[0]}</div>
      <div><div class="rau">${r.author}</div><div class="rho">${r.hood}</div></div>
      <span class="rverified" title="From our Facebook Marketplace profile">✓ Verified</span>
    </div></article>`).join("");
}

function slide(d) {
  const tr = $("rt"); if (!tr || !CONFIG.reviews.length) return;
  const max = -(Math.max(0, CONFIG.reviews.length - 3));
  roff = Math.max(max, Math.min(0, roff - d));
  tr.style.transform = `translateX(calc(${roff} * (300px + 16px)))`;
}

/* ═══════════ MISC RENDERERS ═══════════ */
function renderRehomed() {
  const el = $("rhList"), strip = document.querySelector(".rehome");
  if (!el) return;
  if (!CONFIG.recentlyRehomed.length) { if (strip) strip.style.display = "none"; return; }
  el.innerHTML = CONFIG.recentlyRehomed.map(([t, h, w]) =>
    `<div class="rh-item"><b>${t}</b> → ${h} <i>· ${w}</i></div>`).join("");
}
function renderIG() {
  const grid = $("igGrid"), native = $("igNative");
  if (!grid) return;
  if (CONFIG.instagramPosts.length && native) {
    native.style.display = "grid"; grid.style.display = "none";
    native.innerHTML = CONFIG.instagramPosts.map(u => {
      const clean = u.trim().split("?")[0].replace(/\/$/, "");
      return `<div class="ig-card"><blockquote class="instagram-media" data-instgrm-permalink="${clean}/"
        data-instgrm-version="14" style="margin:0;width:100%"><div class="ig-loading">Loading…</div></blockquote></div>`;
    }).join("");
    const s = document.createElement("script");
    s.async = true; s.src = "https://www.instagram.com/embed.js";
    s.onload = () => { if (window.instgrm) window.instgrm.Embeds.process(); };
    document.body.appendChild(s);
    return;
  }
  const tiles = [
    { img: "sofa-structube-blue.jpg", cap: "Just in — Structube sectional 🔥" },
    { img: "sofa-friheten-bed.jpg",   cap: "Friheten opens to a double bed 🛏️" },
    { img: "sofa-grey-tufted-bed.jpg", cap: "Cleaned up and listed ✨" },
    { txt: 1, e: "🐱", t: "Defense Sheets", s: "Cats scratch the sheet, not your sofa" },
    { txt: 1, e: "🚚", t: "Delivery days", s: "Across the GTA, every week" },
    { txt: 1, e: "🍁", t: "Proudly Toronto", s: "Behind the scenes" }
  ];
  grid.innerHTML = tiles.map(p => p.txt
    ? `<a class="ig-tile ig-txt-tile" href="${CONFIG.instagram}" target="_blank" rel="noopener">
        <span class="e">${p.e}</span><span class="t">${p.t}</span><span class="s">${p.s}</span></a>`
    : `<a class="ig-tile" href="${CONFIG.instagram}" target="_blank" rel="noopener">
        <img src="assets/${p.img}" alt="${p.cap}" loading="lazy"><span class="ig-cap">${p.cap}</span>
        <span class="ig-ov"><span class="ig-ov-i">📸</span><span class="ig-ov-t">View on Instagram</span></span></a>`).join("");
}
function renderTrustStats() {
  const bar = document.querySelector(".reject-stat");
  if (bar && !CONFIG.showTrustStats) bar.style.display = "none";
}
function hs(n) {
  hstep = n;
  document.querySelectorAll(".hcard").forEach((c, i) => c.classList.toggle("on", i === n));
}
function initSticky() {
  const b = $("sticky"); if (!b) return;
  window.addEventListener("scroll", () => b.classList.toggle("up", (window.scrollY || 0) > 420), { passive: true });
}
function initTicker() {
  const el = $("tk"); if (!el) return;
  const items = [
    "Toronto's preloved sofa shop",
    money(CONFIG.deposit) + " holds your sofa · or pay in full and save " + money(CONFIG.payInFullSaves),
    "Every sofa passes an 8-point inspection",
    "Defense Sheets — protect from claws, spills & wear",
    "North York · Scarborough · Etobicoke · Mississauga · Brampton",
    "Proudly Toronto. Proudly Canadian. 🍁"
  ];
  el.innerHTML = [...items, ...items].map(x => `<span><i></i>${x}</span>`).join("");
}
function initFAQ() {
  const wrap = $("fq");
  if (wrap && CONFIG.faqs && CONFIG.faqs.length) {
    wrap.innerHTML = CONFIG.faqs.map(([q, a]) => `<div class="fq">
      <div class="fq-q">${q}<span>+</span></div>
      <div class="fq-a"><p>${a}</p></div></div>`).join("");
  }
  document.querySelectorAll(".fq").forEach(f =>
    f.addEventListener("click", () => f.classList.toggle("open")));
}
function renderConditionKey(){
  const el = $("condKey"); if (!el || typeof CONDITIONS === "undefined") return;
  el.innerHTML = Object.entries(CONDITIONS).map(([k, v]) =>
    `<div class="ck-row"><span class="ck-tag ck-${k.replace(/\s/g,'').toLowerCase()}">${k}</span>
     <span class="ck-d">${v}</span></div>`).join("")
    + `<div class="ck-foot">We photograph flaws rather than hide them. If something isn't as described
       when we arrive, don't take it — we'll refund your deposit in full, on the spot.</div>`;
}

function renderTaxNote(){
  const el = $("taxNote");
  if (el && CONFIG.taxNote) el.textContent = CONFIG.taxNote;
}

function renderZones(){
  const el = $("dsZones"); if (!el) return;
  el.innerHTML = CONFIG.serviceAreas.map(z => `<span>${z}</span>`).join("");
}

function renderAfterpay(){
  const el = $("apBadge"); if (!el) return;
  const a = CONFIG.afterpay;
  if (!a || !a.enabled) { el.style.display = "none"; return; }
  const mark = a.logo
    ? `<img class="ap-logo" src="${a.logo}" alt="Afterpay">`
    : `<span class="ap-word">afterpay</span>`;
  el.innerHTML = `<span class="ap-txt">or ${a.instalments} interest-free payments with</span>${mark}`;
}

function applyContact() {
  const hasPhone = !!CONFIG.phone, hasEmail = !!CONFIG.email;

  /* No number set → hide every phone link rather than showing a dead one */
  document.querySelectorAll("[data-phone],[data-tel]").forEach(a => {
    if (!hasPhone) { a.style.display = "none"; return; }
    a.style.display = "";
    a.href = (a.hasAttribute("data-tel") ? "tel:" : "sms:") + CONFIG.phone;
  });
  document.querySelectorAll("[data-phone-text]").forEach(a => {
    a.textContent = hasPhone ? CONFIG.phoneDisplay : "";
  });
  document.querySelectorAll("[data-email]").forEach(a => {
    if (!hasEmail) { a.style.display = "none"; return; }
    a.style.display = "";
    a.href = "mailto:" + CONFIG.email;
    if (a.dataset.email === "text") a.textContent = "✉️ " + CONFIG.email;
  });
  /* Hide the whole Contact column and the sticky text button if both blank */
  if (!hasPhone && !hasEmail) {
    document.querySelectorAll("[data-contact-col]").forEach(e => e.style.display = "none");
  }
  if (!hasPhone) {
    document.querySelectorAll(".sc-t,.ds-fit,.txtalt").forEach(e => e.style.display = "none");
  }
  document.querySelectorAll("[data-ig]").forEach(a => a.href = CONFIG.instagram);
  document.querySelectorAll("[data-fb]").forEach(a => a.href = CONFIG.facebook);
  document.querySelectorAll("[data-deposit]").forEach(e => e.textContent = money(CONFIG.deposit));
}

/* ═══════════ BOOT ═══════════ */
function init() {
  applyContact();
  renderAfterpay();
  renderZones();
  renderTaxNote();
  renderConditionKey();
  initTicker();
  renderInv();
  renderReviews();
  renderRehomed();
  renderIG();
  renderTrustStats();
  initFAQ();
  initDrop();
  initSticky();
  badge();
  if (document.querySelector(".hcard")) setInterval(() => hs((hstep + 1) % 4), 4500);
  const y = $("year"); if (y) y.textContent = new Date().getFullYear();
}

window.addEventListener("error", e => console.warn("caught:", e.message));
document.addEventListener("DOMContentLoaded", () => {
  try { init(); } catch (e) { console.warn("init error", e); }
});
