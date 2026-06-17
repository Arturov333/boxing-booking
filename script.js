// ============================================================
// CONFIG — edit these values
// ============================================================

// Firebase config: paste from Firebase Console → Project Settings → Web App
const firebaseConfig = {
  apiKey: "AIzaSyDAxpNTXpuZC1AtVBGf9rwJ44X_kuJUgo4",
  authDomain: "boxing-booking-17e44.firebaseapp.com",
  projectId: "boxing-booking-17e44",
  storageBucket: "boxing-booking-17e44.firebasestorage.app",
  messagingSenderId: "584917261723",
  appId: "1:584917261723:web:579502b6925cd4945d953e",
  measurementId: "G-CR3WK3SH0F",
};

// Two training locations (identity only — working hours live in the schedule below).
const LOCATIONS = [
  { id: "loc1", name: "Замарстинівська 55Б", address: "вул. Замарстинівська, 55Б" },
  { id: "loc2", name: "Total Fitness",        address: "просп. Чорновола, 67Г · Львів" },
];

// Admin access code (client-side gate — change after deploy)
// Note: real security comes from Firestore rules, not this code.
const ADMIN_CODE = "13579";

// ------------------------------------------------------------
// SCHEDULE — DEFAULT working hours, per location, per weekday.
// ------------------------------------------------------------
// This is the "hardcoded" base: the client (site visitor) NEVER changes it.
// The trainer (admin) CAN edit it in the admin panel; edits are saved to
// Firestore (settings/schedule.hours) and synced to everyone. If nothing is
// saved yet, these defaults are used.
//
// Model: each location has its own per-day window {s: start, e: end}. A day with
// no entry = the location is closed that day. This per-day-per-location model is
// the base logic (so adding/moving locations by weekday is built in).
//
// Weekday numbers match JS Date.getDay(): 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб.
// (0=Нд — both locations closed; no entry.)
//
// Start times are generated every 60 хв from `s` to `e` inclusive — the listed
// end time is itself a valid start. The trainer can change any of this in the
// admin panel, so the exact end-as-last-start convention is easy to adjust.
const DEFAULT_HOURS = {
  loc1: { // Замарстинівська
    1: { s: "13:00", e: "17:00" }, // Пн
    2: { s: "12:30", e: "16:30" }, // Вт
    3: { s: "12:00", e: "17:00" }, // Ср
    4: { s: "12:30", e: "16:30" }, // Чт
    5: { s: "12:00", e: "17:00" }, // Пт
    6: { s: "13:30", e: "17:30" }, // Сб
  },
  loc2: { // Total Fitness (Чорновола) — пн–сб 12:00–17:00
    1: { s: "12:00", e: "17:00" },
    2: { s: "12:00", e: "17:00" },
    3: { s: "12:00", e: "17:00" },
    4: { s: "12:00", e: "17:00" },
    5: { s: "12:00", e: "17:00" },
    6: { s: "12:00", e: "17:00" },
  },
};

// Live schedule (defaults until Firestore settings/schedule.hours overrides it).
let scheduleHours = cloneHours(DEFAULT_HOURS);

// Start-time step within a working window (minutes).
const SLOT_STEP_MIN = 60;

// Session duration & cross-location travel buffer (minutes).
// A session can run up to TRAINING_MAX_MIN. The trainer can't be in two places:
//  - same location: next booking must start ≥ TRAINING_MAX_MIN after another
//  - other location: must also add TRAVEL_MIN on top (duration + travel)
// Example: booking at Чорновола 12:00 blocks Замарстинівська until 13:40 (12:00 + 80 + 20).
const TRAINING_MAX_MIN = 80;
const TRAVEL_MIN = 20;
const SLOT_BLOCK_SAME = TRAINING_MAX_MIN;               // 80
const SLOT_BLOCK_CROSS = TRAINING_MAX_MIN + TRAVEL_MIN; // 100
const DURATION_LABEL = "60–80 хв";

// Days Mon–Sat (no Sunday)
const DAYS_UA = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAYS_FULL_UA = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

// ============================================================
// FIREBASE INIT (compat SDK — loaded via classic <script> in index.html)
// ============================================================
// We keep modular-style helper names (collection/addDoc/onSnapshot/...) as thin
// shims over the compat API, so all the code below stays unchanged.
// Why compat (classic script) instead of ES modules: an external ES module
// (<script type="module" src="script.js">) is BLOCKED by CORS when the page is
// opened as a local file (file://) — that broke booking & reviews on local open.
// A classic script works both from file:// and from https (Vercel / GitHub Pages).

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function collection(dbi, name) { return dbi.collection(name); }
function doc(dbi, name, id) { return dbi.collection(name).doc(id); }
function addDoc(ref, data) { return ref.add(data); }
function deleteDoc(ref) { return ref.delete(); }
function serverTimestamp() { return firebase.firestore.FieldValue.serverTimestamp(); }
function orderBy(field) { return { __orderBy: field }; }
function query(ref) {
  let q = ref;
  for (let i = 1; i < arguments.length; i++) {
    const c = arguments[i];
    if (c && c.__orderBy) q = q.orderBy(c.__orderBy);
  }
  return q;
}
function onSnapshot(q, next, err) { return q.onSnapshot(next, err); }
function getDocs(q) { return q.get(); }

const bookingsRef = collection(db, "bookings");
const reviewsRef = collection(db, "reviews");
const settingsDoc = doc(db, "settings", "schedule"); // { hours: { loc1: {...}, loc2: {...} } }

// ============================================================
// STATE
// ============================================================

const state = {
  bookings: [],          // live array of {id, location, date, time, name, ...}
  reviews: [],           // live array of {id, name, text, rating, order, ...}
  reviewRating: 0,       // current selection in the review modal
  selectedLocation: null,
  selectedDate: null,    // YYYY-MM-DD
  selectedTime: null,
  weekOffset: 0,         // 0 = current week, 1 = next, -1 = previous
  isAdmin: false,
};

// ============================================================
// SCHEDULE HELPERS
// ============================================================

function cloneHours(h) {
  const out = {};
  for (const loc in h) {
    out[loc] = {};
    for (const d in h[loc]) out[loc][d] = { s: h[loc][d].s, e: h[loc][d].e };
  }
  return out;
}

function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// All start times inside a window, every SLOT_STEP_MIN, end inclusive.
function genSlots(startTime, endTime, step) {
  const out = [];
  const s = timeToMin(startTime), e = timeToMin(endTime);
  for (let m = s; m <= e; m += (step || SLOT_STEP_MIN)) out.push(minToTime(m));
  return out;
}

// Generic time options (for <select> dropdowns), every 30 хв.
function genTimeOptions(startMin, endMin) {
  const out = [];
  for (let m = startMin; m <= endMin; m += 30) out.push(minToTime(m));
  return out;
}

function weekdayOf(dateISO) {
  return new Date(dateISO + "T00:00:00").getDay(); // 0=Sun..6=Sat
}

// Working window {s,e} for a location on a given ISO date, or null if closed.
function windowFor(locationId, dateISO) {
  if (!dateISO) return null;
  const wd = weekdayOf(dateISO);
  const loc = scheduleHours[locationId];
  return (loc && loc[wd]) ? loc[wd] : null;
}

// Bookable start times for a location on a date (respects the live schedule).
function slotsForDate(locationId, dateISO) {
  const w = windowFor(locationId, dateISO);
  return w ? genSlots(w.s, w.e, SLOT_STEP_MIN) : [];
}

function isDayAllowed(locationId, dateISO) {
  return windowFor(locationId, dateISO) !== null;
}

// Weekdays (1..6) a location is open — for display on the location tile.
function openDaysFor(locationId) {
  const loc = scheduleHours[locationId] || {};
  return [1, 2, 3, 4, 5, 6].filter((d) => loc[d]);
}

function dayNamesFor(locationId) {
  const open = openDaysFor(locationId);
  if (open.length === 6) return "Пн–Сб";
  if (open.length === 0) return "вихідний";
  return open.map((d) => DAYS_UA[d - 1]).join(" · ");
}

// ============================================================
// DATE HELPERS
// ============================================================

function startOfWeek(date) {
  // Monday as start of week
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDateShort(date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentWeekDays() {
  const today = new Date();
  const monday = startOfWeek(today);
  const targetMonday = addDays(monday, state.weekOffset * 7);
  return Array.from({ length: 6 }, (_, i) => addDays(targetMonday, i)); // Mon..Sat
}

function isPast(dateISO, time) {
  const [h, m] = time.split(":").map(Number);
  const dt = new Date(`${dateISO}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00`);
  return dt.getTime() < Date.now();
}

// Cross-location conflict: a candidate slot is blocked if it overlaps any existing
// booking, accounting for session duration (same location) + travel time (other location).
// Returns: "" (free) | "taken" (exact same location+time) | "buffer" (blocked by duration/travel).
function slotConflict(locationId, dateISO, time) {
  const S = timeToMin(time);
  let result = "";
  for (const b of state.bookings) {
    if (b.date !== dateISO || !b.time) continue;
    if (b.location === locationId && b.time === time) return "taken";
    const gap = b.location === locationId ? SLOT_BLOCK_SAME : SLOT_BLOCK_CROSS;
    if (Math.abs(S - timeToMin(b.time)) < gap) result = "buffer";
  }
  return result;
}

// ============================================================
// RENDER
// ============================================================

const el = {
  locationGrid: document.getElementById("location-grid"),
  dayGrid: document.getElementById("day-grid"),
  timeGrid: document.getElementById("time-grid"),
  weekLabel: document.getElementById("week-label"),
  prevWeek: document.getElementById("prev-week"),
  nextWeek: document.getElementById("next-week"),
  slotsStatus: document.getElementById("slots-status"),
  form: document.getElementById("booking-form"),
  submitBtn: document.getElementById("submit-btn"),
  summary: document.getElementById("booking-summary"),
  formMessage: document.getElementById("form-message"),
  // admin
  openAdmin: document.getElementById("open-admin"),
  adminModal: document.getElementById("admin-modal"),
  adminCodeInput: document.getElementById("admin-code-input"),
  adminLogin: document.getElementById("admin-login"),
  adminCancel: document.getElementById("admin-cancel"),
  adminError: document.getElementById("admin-error"),
  clientView: document.getElementById("client-view"),
  adminView: document.getElementById("admin-view"),
  adminList: document.getElementById("admin-list"),
  refreshAdmin: document.getElementById("refresh-admin"),
  closeAdmin: document.getElementById("close-admin"),
};

function renderLocations() {
  el.locationGrid.innerHTML = "";
  LOCATIONS.forEach((loc) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    if (state.selectedLocation === loc.id) b.classList.add("selected");
    const sub = `${loc.address} · ${dayNamesFor(loc.id)}`;
    b.innerHTML = `${loc.name}<span class="tile-sub">${sub}</span>`;
    b.addEventListener("click", () => {
      state.selectedLocation = loc.id;
      state.selectedTime = null;
      // if the previously chosen day isn't a working day for this location, drop it
      if (!isDayAllowed(loc.id, state.selectedDate)) state.selectedDate = null;
      renderLocations();
      renderDays();
      renderTimes();
      updateSubmit();
    });
    el.locationGrid.appendChild(b);
  });
}

function renderDays() {
  const days = getCurrentWeekDays();
  const first = days[0];
  const last = days[5];
  el.weekLabel.textContent = `${fmtDateShort(first)} — ${fmtDateShort(last)}`;

  el.dayGrid.innerHTML = "";
  days.forEach((date, i) => {
    const iso = fmtDateISO(date);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    if (state.selectedDate === iso) b.classList.add("selected");
    // Disable past whole days
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay.getTime() < Date.now()) b.disabled = true;
    // Disable days the selected location does not work
    if (state.selectedLocation && !isDayAllowed(state.selectedLocation, iso)) {
      b.disabled = true;
    }
    b.innerHTML = `${DAYS_UA[i]}<span class="tile-sub">${fmtDateShort(date)}</span>`;
    b.addEventListener("click", () => {
      state.selectedDate = iso;
      state.selectedTime = null;
      renderDays();
      renderTimes();
      updateSubmit();
    });
    el.dayGrid.appendChild(b);
  });
}

function renderTimes() {
  el.timeGrid.innerHTML = "";
  if (!state.selectedLocation || !state.selectedDate) {
    el.slotsStatus.textContent = "Спочатку обери локацію та день";
    return;
  }

  const slots = slotsForDate(state.selectedLocation, state.selectedDate);
  if (slots.length === 0) {
    el.slotsStatus.textContent = "Цей зал у цей день не працює — обери інший день";
    return;
  }
  el.slotsStatus.textContent = `Тривалість тренування — ${DURATION_LABEL}`;

  slots.forEach((time) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.textContent = time;
    const past = isPast(state.selectedDate, time);
    const conflict = slotConflict(state.selectedLocation, state.selectedDate, time);
    if (conflict === "taken") {
      b.classList.add("booked");      // exact slot already booked here → "Зайнято"
      b.disabled = true;
    } else if (conflict === "buffer") {
      b.classList.add("unavail");     // blocked by duration/travel buffer → "Недоступно"
      b.disabled = true;
    } else if (past) {
      b.disabled = true;
      b.classList.add("booked");
    } else {
      if (state.selectedTime === time) b.classList.add("selected");
      b.addEventListener("click", () => {
        state.selectedTime = time;
        renderTimes();
        updateSubmit();
      });
    }
    el.timeGrid.appendChild(b);
  });
}

function updateSubmit() {
  const ready = state.selectedLocation && state.selectedDate && state.selectedTime;
  el.submitBtn.disabled = !ready;
  if (ready) {
    const loc = LOCATIONS.find(l => l.id === state.selectedLocation);
    const dayIndex = new Date(state.selectedDate).getDay();
    const dayName = DAYS_FULL_UA[(dayIndex + 6) % 7]; // Mon=0
    el.summary.classList.remove("hidden");
    el.summary.innerHTML = `
      <strong>${loc.name}</strong> · ${loc.address}<br />
      <strong>${dayName}</strong>, ${fmtDateShort(new Date(state.selectedDate))} о <strong>${state.selectedTime}</strong>
    `;
  } else {
    el.summary.classList.add("hidden");
  }
}

// ============================================================
// FIRESTORE SUBSCRIPTIONS
// ============================================================

function subscribeBookings() {
  // Order by date only (single-field index is automatic in Firestore);
  // time is sorted client-side in renderAdminList, so no composite index needed.
  const q = query(bookingsRef, orderBy("date"));
  onSnapshot(q, (snap) => {
    state.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTimes();
    if (state.isAdmin) renderAdminList();
  }, (err) => {
    console.error("Firestore subscription error:", err);
    el.slotsStatus.textContent = "Помилка з'єднання з базою. Перевір налаштування Firebase.";
  });
}

// ============================================================
// SUBMIT BOOKING (client form)
// ============================================================

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (el.submitBtn.disabled) return;

  const formData = new FormData(el.form);
  const data = {
    location: state.selectedLocation,
    date: state.selectedDate,
    time: state.selectedTime,
    name: (formData.get("name") || "").toString().trim(),
    phone: (formData.get("phone") || "").toString().trim(),
    instagram: (formData.get("instagram") || "").toString().trim(),
    telegram: (formData.get("telegram") || "").toString().trim(),
    createdAt: serverTimestamp(),
  };

  // Race-condition guard: re-check the slot is still free (incl. cross-location buffer)
  if (slotConflict(data.location, data.date, data.time) !== "") {
    showFormMessage("Цей час щойно став недоступний. Обери інший.", "error");
    state.selectedTime = null;
    renderTimes();
    updateSubmit();
    return;
  }

  try {
    el.submitBtn.disabled = true;
    showFormMessage("Записуємо...", "");
    await addDoc(bookingsRef, data);
    showFormMessage(`✓ Записано! ${data.name}, до зустрічі ${fmtDateShort(new Date(data.date))} о ${data.time}`, "success");
    el.form.reset();
    state.selectedTime = null;
    renderTimes();
    updateSubmit();
  } catch (err) {
    console.error(err);
    showFormMessage("Помилка запису. Спробуй ще раз.", "error");
    el.submitBtn.disabled = false;
  }
});

function showFormMessage(text, kind) {
  el.formMessage.textContent = text;
  el.formMessage.className = "form-message " + (kind || "");
}

// ============================================================
// ADMIN — login / view toggle
// ============================================================

el.openAdmin.addEventListener("click", () => {
  if (state.isAdmin) {
    showAdmin();
  } else {
    el.adminModal.classList.remove("hidden");
    el.adminCodeInput.value = "";
    el.adminError.textContent = "";
    setTimeout(() => el.adminCodeInput.focus(), 50);
  }
});

el.adminCancel.addEventListener("click", () => el.adminModal.classList.add("hidden"));
el.adminCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.adminLogin.click();
});
el.adminLogin.addEventListener("click", () => {
  if (el.adminCodeInput.value === ADMIN_CODE) {
    state.isAdmin = true;
    el.adminModal.classList.add("hidden");
    showAdmin();
  } else {
    el.adminError.textContent = "Невірний код";
  }
});

el.closeAdmin.addEventListener("click", () => {
  state.isAdmin = false;
  el.adminView.classList.add("hidden");
  el.clientView.classList.remove("hidden");
  document.body.classList.remove("admin-active");
});

el.refreshAdmin.addEventListener("click", async () => {
  // onSnapshot already keeps things live; this forces a one-shot refresh
  try {
    const snap = await getDocs(query(bookingsRef, orderBy("date")));
    state.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminList();
  } catch (err) {
    console.error(err);
  }
});

function showAdmin() {
  el.clientView.classList.add("hidden");
  el.adminView.classList.remove("hidden");
  document.body.classList.add("admin-active");
  renderAdminList();
  renderScheduleEditor();
  renderAddBookingForm();
  renderAdminReviews();
}

// ============================================================
// ADMIN — bookings list (cancel any booking)
// ============================================================

function renderAdminList() {
  el.adminList.innerHTML = "";

  // Show only upcoming bookings sorted by date+time
  const now = Date.now();
  const upcoming = state.bookings
    .filter(b => {
      if (!b.date || !b.time) return false;
      const [h, m] = b.time.split(":").map(Number);
      const dt = new Date(`${b.date}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00`);
      return dt.getTime() >= now - 1000 * 60 * 60; // include sessions still happening
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (upcoming.length === 0) {
    el.adminList.innerHTML = `<div class="empty-state">Майбутніх записів немає</div>`;
    return;
  }

  upcoming.forEach((b) => {
    const loc = LOCATIONS.find(l => l.id === b.location);
    const locName = loc ? loc.name : b.location;
    const date = new Date(b.date);
    const dayIndex = date.getDay();
    const dayName = DAYS_FULL_UA[(dayIndex + 6) % 7];

    const row = document.createElement("div");
    row.className = "admin-row";

    const igLink = b.instagram
      ? `<a href="https://instagram.com/${b.instagram.replace(/^@/, "")}" target="_blank" rel="noopener">IG: ${escapeHtml(b.instagram)}</a>`
      : "";
    const tgLink = b.telegram
      ? `<a href="https://t.me/${b.telegram.replace(/^@/, "")}" target="_blank" rel="noopener">TG: ${escapeHtml(b.telegram)}</a>`
      : "";
    const phoneLink = b.phone
      ? `<a href="tel:${b.phone.replace(/[^+0-9]/g, "")}">${escapeHtml(b.phone)}</a>`
      : "";
    const manualTag = b.manual ? ` · <span class="tag-manual">вручну</span>` : "";

    row.innerHTML = `
      <div class="info">
        <div class="when">${dayName} · ${fmtDateShort(date)} · ${b.time} · ${escapeHtml(locName)}${manualTag}</div>
        <div class="who"><strong style="color:var(--ink)">${escapeHtml(b.name)}</strong></div>
        <div class="contacts">
          ${phoneLink}${phoneLink && (igLink || tgLink) ? " · " : ""}${igLink}${igLink && tgLink ? " · " : ""}${tgLink}
        </div>
      </div>
      <button class="ghost-btn small danger" data-id="${b.id}">Скасувати</button>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      if (!confirm(`Скасувати запис: ${b.name} — ${b.date} ${b.time}?`)) return;
      try {
        await deleteDoc(doc(db, "bookings", b.id));
      } catch (err) {
        alert("Помилка скасування: " + err.message);
      }
    });

    el.adminList.appendChild(row);
  });
}

// ============================================================
// ADMIN — add a booking manually
// ============================================================

function renderAddBookingForm() {
  const locSel = document.getElementById("ab-location");
  const dateInp = document.getElementById("ab-date");
  if (!locSel || !dateInp || locSel.dataset.ready) return;

  locSel.innerHTML = LOCATIONS.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
  dateInp.min = fmtDateISO(new Date());
  dateInp.value = fmtDateISO(new Date());
  locSel.dataset.ready = "1";

  locSel.addEventListener("change", refreshAddBookingTimes);
  dateInp.addEventListener("change", refreshAddBookingTimes);
  refreshAddBookingTimes();

  const submit = document.getElementById("ab-submit");
  submit.addEventListener("click", submitManualBooking);
}

function refreshAddBookingTimes() {
  const timeSel = document.getElementById("ab-time");
  const locSel = document.getElementById("ab-location");
  const dateInp = document.getElementById("ab-date");
  if (!timeSel || !locSel || !dateInp) return;
  let times = slotsForDate(locSel.value, dateInp.value);
  // If that location is closed that day, still let the admin force any time.
  const closed = times.length === 0;
  if (closed) times = genTimeOptions(8 * 60, 21 * 60);
  timeSel.innerHTML = times.map(t => `<option value="${t}">${t}</option>`).join("");
  const note = document.getElementById("ab-note");
  if (note) note.textContent = closed ? "⚠ Цей зал у цей день за розкладом не працює — час обираєш вручну." : "";
}

async function submitManualBooking() {
  const locSel = document.getElementById("ab-location");
  const dateInp = document.getElementById("ab-date");
  const timeSel = document.getElementById("ab-time");
  const nameInp = document.getElementById("ab-name");
  const phoneInp = document.getElementById("ab-phone");
  const msg = document.getElementById("ab-msg");

  const data = {
    location: locSel.value,
    date: dateInp.value,
    time: timeSel.value,
    name: (nameInp.value || "").trim() || "Запис тренера",
    phone: (phoneInp.value || "").trim(),
    manual: true,
    createdAt: serverTimestamp(),
  };

  if (!data.date || !data.time) {
    msg.textContent = "Обери дату й час"; msg.className = "form-message error"; return;
  }

  const conflict = slotConflict(data.location, data.date, data.time);
  if (conflict !== "") {
    const why = conflict === "taken" ? "цей слот уже зайнятий" : "це конфліктує з буфером між тренуваннями";
    if (!confirm(`Увага: ${why}. Додати все одно?`)) return;
  }

  try {
    msg.textContent = "Додаємо..."; msg.className = "form-message";
    await addDoc(bookingsRef, data);
    msg.textContent = "✓ Запис додано"; msg.className = "form-message success";
    nameInp.value = ""; phoneInp.value = "";
    setTimeout(() => { msg.textContent = ""; }, 2500);
  } catch (err) {
    console.error(err);
    msg.textContent = "Помилка: " + err.message; msg.className = "form-message error";
  }
}

// ============================================================
// ADMIN — schedule editor (full control over working hours)
// ============================================================

function renderScheduleEditor() {
  const wrap = document.getElementById("schedule-editor");
  if (!wrap) return;
  wrap.innerHTML = "";

  const timeOpts = genTimeOptions(7 * 60, 22 * 60); // 07:00..22:00 every 30 хв

  LOCATIONS.forEach((loc) => {
    const block = document.createElement("div");
    block.className = "sched-loc";
    block.innerHTML = `<div class="sched-loc-name">${escapeHtml(loc.name)}</div>`;

    const rows = document.createElement("div");
    rows.className = "sched-rows";

    [1, 2, 3, 4, 5, 6].forEach((d) => {
      const w = (scheduleHours[loc.id] || {})[d] || null;
      const open = !!w;
      const start = w ? w.s : "12:00";
      const end = w ? w.e : "17:00";

      const row = document.createElement("div");
      row.className = "sched-row";
      const optsS = timeOpts.map(t => `<option value="${t}"${t === start ? " selected" : ""}>${t}</option>`).join("");
      const optsE = timeOpts.map(t => `<option value="${t}"${t === end ? " selected" : ""}>${t}</option>`).join("");
      row.innerHTML = `
        <label class="sched-day">
          <input type="checkbox" class="sched-open" data-loc="${loc.id}" data-day="${d}"${open ? " checked" : ""} />
          <span>${DAYS_FULL_UA[d - 1]}</span>
        </label>
        <div class="sched-times">
          <select class="sched-start"${open ? "" : " disabled"}>${optsS}</select>
          <span class="sched-dash">–</span>
          <select class="sched-end"${open ? "" : " disabled"}>${optsE}</select>
        </div>`;

      const chk = row.querySelector(".sched-open");
      const selS = row.querySelector(".sched-start");
      const selE = row.querySelector(".sched-end");
      chk.addEventListener("change", () => {
        selS.disabled = !chk.checked;
        selE.disabled = !chk.checked;
        row.classList.toggle("off", !chk.checked);
      });
      if (!open) row.classList.add("off");

      rows.appendChild(row);
    });

    block.appendChild(rows);
    wrap.appendChild(block);
  });

  const saveBtn = document.getElementById("schedule-save");
  if (saveBtn && !saveBtn.dataset.ready) {
    saveBtn.dataset.ready = "1";
    saveBtn.addEventListener("click", saveSchedule);
  }
  const resetBtn = document.getElementById("schedule-reset");
  if (resetBtn && !resetBtn.dataset.ready) {
    resetBtn.dataset.ready = "1";
    resetBtn.addEventListener("click", () => {
      if (!confirm("Повернути розклад до стандартного (як у коді)?")) return;
      scheduleHours = cloneHours(DEFAULT_HOURS);
      renderScheduleEditor();
    });
  }
}

function collectScheduleFromEditor() {
  const wrap = document.getElementById("schedule-editor");
  const hours = {};
  LOCATIONS.forEach(l => { hours[l.id] = {}; });
  wrap.querySelectorAll(".sched-row").forEach((row) => {
    const chk = row.querySelector(".sched-open");
    const locId = chk.dataset.loc;
    const day = chk.dataset.day;
    if (!chk.checked) return; // closed → no entry
    const s = row.querySelector(".sched-start").value;
    const e = row.querySelector(".sched-end").value;
    if (timeToMin(e) < timeToMin(s)) return; // skip invalid (end before start)
    hours[locId][day] = { s, e };
  });
  return hours;
}

async function saveSchedule() {
  const msg = document.getElementById("schedule-msg");
  const hours = collectScheduleFromEditor();
  scheduleHours = cloneHours(hours);
  applySchedule();
  try {
    if (msg) { msg.textContent = "Зберігаємо..."; msg.className = "form-message"; }
    await settingsDoc.set({ hours }, { merge: true });
    if (msg) { msg.textContent = "✓ Розклад збережено й оновлено для всіх"; msg.className = "form-message success"; }
    refreshAddBookingTimes();
  } catch (err) {
    console.error(err);
    if (msg) { msg.textContent = "Помилка збереження: " + err.message; msg.className = "form-message error"; }
  }
}

function subscribeSettings() {
  onSnapshot(settingsDoc, (snap) => {
    const data = snap && snap.exists ? snap.data() : null;
    if (data && data.hours && typeof data.hours === "object") {
      // Merge saved hours over defaults so a new location still has a fallback.
      const merged = cloneHours(DEFAULT_HOURS);
      for (const loc in data.hours) {
        merged[loc] = {};
        for (const d in data.hours[loc]) {
          const w = data.hours[loc][d];
          if (w && w.s && w.e) merged[loc][d] = { s: w.s, e: w.e };
        }
      }
      scheduleHours = merged;
    } else {
      scheduleHours = cloneHours(DEFAULT_HOURS);
    }
    applySchedule();
  }, (err) => console.error("Settings subscription error:", err));
}

function applySchedule() {
  // Drop a selected day that is no longer valid for the selected location.
  if (state.selectedLocation && state.selectedDate &&
      !isDayAllowed(state.selectedLocation, state.selectedDate)) {
    state.selectedDate = null;
    state.selectedTime = null;
  }
  renderLocations();
  renderDays();
  renderTimes();
  updateSubmit();
  if (state.isAdmin) {
    renderScheduleEditor();
    refreshAddBookingTimes();
  }
}

// ============================================================
// REVIEWS — client submissions, public display, moderation
// ============================================================

const reviewGrid = document.querySelector(".review-grid");

function starsHtml(rating) {
  const r = Math.max(0, Math.min(5, Math.round(rating || 0)));
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= r ? "★" : '<span class="off">★</span>';
  return s;
}

// Sort by explicit `order` (lower = higher on the page); fallback newest-first.
function reviewsSorted() {
  const ord = (x) => (typeof x.order === "number" ? x.order : 0);
  const ts = (x) => (x.createdAt && x.createdAt.seconds ? x.createdAt.seconds : 0);
  return [...state.reviews].sort((a, b) => ord(a) - ord(b) || ts(b) - ts(a));
}

function renderPublicReviews() {
  if (!reviewGrid) return;
  // Remove previously rendered cards / placeholder
  reviewGrid.querySelectorAll(".review.dyn").forEach((n) => n.remove());
  const existingEmpty = reviewGrid.querySelector(".review-empty");

  if (state.reviews.length === 0) {
    // No reviews yet → friendly invitation to be the first
    if (!existingEmpty) {
      const empty = document.createElement("div");
      empty.className = "review-empty";
      empty.innerHTML = "Тут зʼявляться відгуки клієнтів.<br>Стань першим — натисни «Залишити відгук».";
      reviewGrid.appendChild(empty);
    }
    return;
  }

  if (existingEmpty) existingEmpty.remove();
  reviewsSorted().forEach((rev) => {
    const art = document.createElement("article");
    art.className = "review dyn";
    const initial = (rev.name || "?").trim().charAt(0).toUpperCase();
    const tag = rev.tag ? escapeHtml(rev.tag) : "Відгук клієнта";
    art.innerHTML = `
      <div class="review-stars" aria-label="${rev.rating || 0} з 5">${starsHtml(rev.rating)}</div>
      <p class="review-quote">${escapeHtml(rev.text || "")}</p>
      <div class="review-by">
        <span class="review-ava">${escapeHtml(initial)}</span>
        <span class="review-meta"><strong>${escapeHtml(rev.name || "Анонім")}</strong><span class="review-tag">${tag}</span></span>
      </div>`;
    reviewGrid.appendChild(art);
  });
}

function subscribeReviews() {
  onSnapshot(reviewsRef, (snap) => {
    state.reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPublicReviews();
    if (state.isAdmin) renderAdminReviews();
  }, (err) => {
    console.error("Reviews subscription error:", err);
  });
}

function minReviewOrder() {
  let min = 0;
  state.reviews.forEach((r) => { if (typeof r.order === "number" && r.order < min) min = r.order; });
  return min;
}

function renderAdminReviews() {
  const list = document.getElementById("admin-reviews");
  if (!list) return;
  list.innerHTML = "";
  const sorted = reviewsSorted();
  if (sorted.length === 0) {
    list.innerHTML = `<div class="empty-state">Відгуків поки немає. Зʼявляться, коли клієнти їх залишать.</div>`;
    return;
  }
  sorted.forEach((rev, idx) => {
    const row = document.createElement("div");
    row.className = "admin-row review-admin-row";
    const tag = rev.tag ? ` · ${escapeHtml(rev.tag)}` : "";
    row.innerHTML = `
      <div class="reorder">
        <button class="ghost-btn icon up" title="Вгору"${idx === 0 ? " disabled" : ""}>▲</button>
        <button class="ghost-btn icon down" title="Вниз"${idx === sorted.length - 1 ? " disabled" : ""}>▼</button>
      </div>
      <div class="info">
        <div class="when"><span style="color:#E7B563">${starsHtml(rev.rating)}</span> · <strong style="color:var(--ink)">${escapeHtml(rev.name || "Анонім")}</strong>${tag}</div>
        <div class="who">${escapeHtml(rev.text || "")}</div>
      </div>
      <button class="ghost-btn small danger del">Видалити</button>`;

    row.querySelector(".up").addEventListener("click", () => moveReview(rev, -1));
    row.querySelector(".down").addEventListener("click", () => moveReview(rev, 1));
    row.querySelector(".del").addEventListener("click", async () => {
      if (!confirm(`Видалити відгук від ${rev.name || "Анонім"}?`)) return;
      try { await deleteDoc(doc(db, "reviews", rev.id)); }
      catch (err) { alert("Помилка видалення: " + err.message); }
    });
    list.appendChild(row);
  });
}

// Reorder by renumbering every review to its sorted index (robust, no collisions).
async function moveReview(rev, dir) {
  const sorted = reviewsSorted();
  const i = sorted.findIndex((r) => r.id === rev.id);
  const j = i + dir;
  if (j < 0 || j >= sorted.length) return;
  const tmp = sorted[i]; sorted[i] = sorted[j]; sorted[j] = tmp;
  try {
    await Promise.all(sorted.map((r, idx) => doc(db, "reviews", r.id).update({ order: idx })));
  } catch (err) {
    alert("Не вдалося змінити порядок. Переконайся, що у правилах Firestore дозволено 'update' для reviews. " + err.message);
  }
}

function initAdminReviewTools() {
  const submit = document.getElementById("ar-submit");
  const clearBtn = document.getElementById("reviews-clear");

  if (clearBtn) clearBtn.addEventListener("click", async () => {
    const n = state.reviews.length;
    if (n === 0) { alert("Відгуків немає."); return; }
    if (!confirm(`Стерти ВСІ відгуки (${n})? Це не можна відмінити.`)) return;
    try {
      clearBtn.disabled = true;
      await Promise.all(state.reviews.map((r) => deleteDoc(doc(db, "reviews", r.id))));
      alert("✓ Усі відгуки стерто.");
    } catch (err) {
      alert("Помилка: " + err.message + "\n(Перевір, що у Firebase опубліковані правила.)");
    } finally {
      clearBtn.disabled = false;
    }
  });

  if (submit) submit.addEventListener("click", async () => {
    const name = (document.getElementById("ar-name").value || "").trim();
    const text = (document.getElementById("ar-text").value || "").trim();
    const tag = (document.getElementById("ar-tag").value || "").trim();
    const rating = Number(document.getElementById("ar-rating").value) || 5;
    const msg = document.getElementById("ar-msg");
    if (name.length < 2) { msg.textContent = "Вкажи ім'я"; msg.className = "form-message error"; return; }
    if (text.length < 5) { msg.textContent = "Напиши текст відгуку"; msg.className = "form-message error"; return; }
    try {
      msg.textContent = "Додаємо..."; msg.className = "form-message";
      await addDoc(reviewsRef, {
        name, text, rating, tag: tag || "",
        order: minReviewOrder() - 1, // new admin reviews go to the top
        createdAt: serverTimestamp(),
      });
      msg.textContent = "✓ Відгук додано"; msg.className = "form-message success";
      document.getElementById("ar-name").value = "";
      document.getElementById("ar-text").value = "";
      document.getElementById("ar-tag").value = "";
      setTimeout(() => { msg.textContent = ""; }, 2500);
    } catch (err) {
      msg.textContent = "Помилка: " + err.message; msg.className = "form-message error";
    }
  });
}

// ============================================================
// REVIEW MODAL (client-facing)
// ============================================================

function initReviewModal() {
  const modal = document.getElementById("review-modal");
  const openBtn = document.getElementById("open-review");
  const cancelBtn = document.getElementById("review-cancel");
  const submitBtn = document.getElementById("review-submit");
  const nameInput = document.getElementById("review-name");
  const textInput = document.getElementById("review-text");
  const msg = document.getElementById("review-msg");
  const starWrap = document.getElementById("star-input");
  if (!modal || !openBtn || !starWrap) return;

  const stars = [...starWrap.querySelectorAll(".star")];
  const paint = (n) => stars.forEach((s, i) => s.classList.toggle("on", i < n));
  stars.forEach((s) => {
    const v = Number(s.dataset.v);
    s.addEventListener("mouseenter", () => paint(v));
    s.addEventListener("click", () => { state.reviewRating = v; paint(v); });
  });
  starWrap.addEventListener("mouseleave", () => paint(state.reviewRating));

  const open = () => {
    state.reviewRating = 0; paint(0);
    nameInput.value = ""; textInput.value = "";
    msg.textContent = ""; msg.className = "form-message";
    modal.classList.remove("hidden");
    setTimeout(() => nameInput.focus(), 50);
  };
  const close = () => modal.classList.add("hidden");

  openBtn.addEventListener("click", open);
  cancelBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  submitBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    if (!state.reviewRating) { msg.textContent = "Постав оцінку (зірочки)"; msg.className = "form-message error"; return; }
    if (name.length < 2) { msg.textContent = "Вкажи ім'я"; msg.className = "form-message error"; return; }
    if (text.length < 5) { msg.textContent = "Напиши кілька слів відгуку"; msg.className = "form-message error"; return; }
    try {
      submitBtn.disabled = true;
      msg.textContent = "Надсилаємо..."; msg.className = "form-message";
      await addDoc(reviewsRef, {
        name, text, rating: state.reviewRating,
        order: minReviewOrder() - 1, // newest on top
        createdAt: serverTimestamp(),
      });
      msg.textContent = "✓ Дякуємо за відгук!"; msg.className = "form-message success";
      setTimeout(close, 1200);
    } catch (err) {
      console.error(err);
      msg.textContent = "Помилка надсилання. Спробуй ще раз."; msg.className = "form-message error";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// NOTE: video-gallery lightbox logic lives as a standalone inline <script> in
// index.html (independent of this Firebase module), so the gallery always works
// even if Firebase is slow/unavailable or this file is cached.

// ============================================================
// WEEK NAV
// ============================================================

el.prevWeek.addEventListener("click", () => {
  if (state.weekOffset > 0) {
    state.weekOffset -= 1;
  } else if (state.weekOffset === 0) {
    return; // no past weeks
  }
  state.selectedDate = null;
  state.selectedTime = null;
  renderDays();
  renderTimes();
  updateSubmit();
});
el.nextWeek.addEventListener("click", () => {
  if (state.weekOffset < 4) { // max 4 weeks ahead
    state.weekOffset += 1;
    state.selectedDate = null;
    state.selectedTime = null;
    renderDays();
    renderTimes();
    updateSubmit();
  }
});

// ============================================================
// THEME TOGGLE (dark / light, persisted)
// ============================================================

const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
}

// ============================================================
// BOOTSTRAP
// ============================================================

renderLocations();
renderDays();
renderTimes();
subscribeBookings();
subscribeReviews();
subscribeSettings();
initReviewModal();
initAdminReviewTools();
