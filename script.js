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

// Two training locations — change to your real venue names
const LOCATIONS = [
  { id: "loc1", name: "Замарстинівська 55Б", address: "вул. Замарстинівська, 55Б" },
  { id: "loc2", name: "ТЦ Спартак", address: "вул. І. Мазепи, 1Б" },
];

// Admin access code (client-side gate — change after deploy)
// Note: real security comes from Firestore rules, not this code.
const ADMIN_CODE = "13579";

// Available time slots (60-min sessions)
const TIME_SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00"];

// Days Mon–Sat (no Sunday)
const DAYS_UA = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAYS_FULL_UA = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

// ============================================================
// FIREBASE INIT
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const bookingsRef = collection(db, "bookings");

// ============================================================
// STATE
// ============================================================

const state = {
  bookings: [],          // live array of {id, location, date, time, name, ...}
  selectedLocation: null,
  selectedDate: null,    // YYYY-MM-DD
  selectedTime: null,
  weekOffset: 0,         // 0 = current week, 1 = next, -1 = previous
  isAdmin: false,
};

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
  const [h] = time.split(":").map(Number);
  const dt = new Date(`${dateISO}T${String(h).padStart(2, "0")}:00:00`);
  return dt.getTime() < Date.now();
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
    b.innerHTML = `${loc.name}<span class="tile-sub">${loc.address}</span>`;
    b.addEventListener("click", () => {
      state.selectedLocation = loc.id;
      state.selectedTime = null;
      renderLocations();
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
  el.slotsStatus.textContent = "";

  // Find bookings matching location + date
  const taken = new Set(
    state.bookings
      .filter(b => b.location === state.selectedLocation && b.date === state.selectedDate)
      .map(b => b.time)
  );

  TIME_SLOTS.forEach((time) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.textContent = time;
    const past = isPast(state.selectedDate, time);
    if (taken.has(time)) {
      b.classList.add("booked");
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
  const q = query(bookingsRef, orderBy("date"), orderBy("time"));
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
// SUBMIT BOOKING
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

  // Race-condition guard: re-check slot is still free
  const stillTaken = state.bookings.some(
    b => b.location === data.location && b.date === data.date && b.time === data.time
  );
  if (stillTaken) {
    showFormMessage("Цей слот щойно зайняли. Обери інший час.", "error");
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
// ADMIN
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
});

el.refreshAdmin.addEventListener("click", async () => {
  // onSnapshot already keeps things live; this forces a one-shot refresh
  try {
    const snap = await getDocs(query(bookingsRef, orderBy("date"), orderBy("time")));
    state.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminList();
  } catch (err) {
    console.error(err);
  }
});

function showAdmin() {
  el.clientView.classList.add("hidden");
  el.adminView.classList.remove("hidden");
  renderAdminList();
}

function renderAdminList() {
  el.adminList.innerHTML = "";

  // Show only upcoming bookings sorted by date+time
  const now = Date.now();
  const upcoming = state.bookings
    .filter(b => {
      if (!b.date || !b.time) return false;
      const [h] = b.time.split(":").map(Number);
      const dt = new Date(`${b.date}T${String(h).padStart(2, "0")}:00:00`);
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
      ? `<a href="https://instagram.com/${b.instagram.replace(/^@/, "")}" target="_blank" rel="noopener">IG: ${b.instagram}</a>`
      : "";
    const tgLink = b.telegram
      ? `<a href="https://t.me/${b.telegram.replace(/^@/, "")}" target="_blank" rel="noopener">TG: ${b.telegram}</a>`
      : "";
    const phoneLink = b.phone
      ? `<a href="tel:${b.phone.replace(/[^+0-9]/g, "")}">${b.phone}</a>`
      : "";

    row.innerHTML = `
      <div class="info">
        <div class="when">${dayName} · ${fmtDateShort(date)} · ${b.time} · ${locName}</div>
        <div class="who"><strong style="color:var(--text)">${escapeHtml(b.name)}</strong></div>
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ============================================================
// WEEK NAV
// ============================================================

el.prevWeek.addEventListener("click", () => {
  if (state.weekOffset > 0) {
    state.weekOffset -= 1;
  } else if (state.weekOffset === 0) {
    // Allow going to current week only (no past weeks)
    return;
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
// BOOTSTRAP
// ============================================================

renderLocations();
renderDays();
renderTimes();
subscribeBookings();
