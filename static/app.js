// app.js
// Talos Home Hub - H4D33D

"use strict";

const POLL_MS = 1000;
const KEYPAD_TIMEOUT_MS = 30000; // keypad closes after 30 s without a tap
const DEMO_KEYPAD_TIMEOUT_MS = 10000; // shorter in --demo, so it's quick to see
const LIMITS = { home_idle: [15, 900], lock_idle: [30, 3600], brightness: [20, 100] };

const $ = (id) => document.getElementById(id);
const app = window.webkit?.messageHandlers?.talos; // only inside the Talos app (app.py)

let lockState = { configured: true, locked: false, pin_length: 0, break_seconds: 0 };
let settings = {};
let homeVisible = false; // set by app.py while Google Home is on screen
let lastTouch = Date.now();
let demo = false; // the server says when it's running with --demo

async function post(path, body = {}) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: "Talos server not reachable" };
  }
}

// Pi-Health formatting helpers =======================================================

// temp
function formatNumber(value, decimals, suffix) {
  return Number.isFinite(value) ? value.toFixed(decimals) + suffix : "—";
}

// sd card memory
function formatGB(used, total) {
  if (!Number.isFinite(used) || !Number.isFinite(total)) return "—";
  return `${(used / 1e9).toFixed(1)} / ${(total / 1e9).toFixed(1)} GB`;
}

// precentages
function formatPercent(used, total) {
  return Number.isFinite(used) && Number.isFinite(total) && total > 0
    ? Math.round((100 * used) / total) + "%"
    : "—";
}

// up time
function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}D ${hours}H` : `${hours}H ${minutes}M`;
}

// Rendering - Indictaors, Lux, Daylight, Health Stats, Connection Status ==================

function renderHealth(health) {
  $("cpu-temp").textContent = formatNumber(health.cpu_temp, 0, "°C");
  $("cpu-usage").textContent = formatNumber(health.cpu_usage, 0, "%");
  $("ram-percent").textContent = formatPercent(health.ram_used, health.ram_total);
  $("disk-percent").textContent = formatPercent(health.disk_used, health.disk_total);
  $("ram").textContent = formatGB(health.ram_used, health.ram_total);
  $("disk").textContent = formatGB(health.disk_used, health.disk_total);
  $("uptime").textContent = formatUptime(health.uptime);
}

function renderIndicator(id, indicator) {
  const element = $(id);
  element.dataset.state = indicator.state;
  element.querySelector(".indicator-label").textContent = indicator.label;
  element.querySelector(".indicator-detail").textContent = indicator.detail;
}

function renderLux(lux) {
  renderIndicator("lux", {
    state: lux.state,
    label: lux.value === null ? "NO LINK" : `${Math.round(lux.value)} LUX`,
    detail: "",
  });
}

function renderDaylight(daylight) {
  // The picture shows day or night; the text is just the next sunset or sunrise.
  const next = daylight.is_day ? "SUNSET" : "SUNRISE";
  renderIndicator("daylight", {
    state: daylight.is_day ? "sun" : "moon",
    label: daylight.next_change ? `${next} ${daylight.next_change}` : "—",
    detail: "",
  });
}

function renderConnection(internet) {
  const state = internet === null ? "offline" : internet ? "connected" : "disconnected";
  const label = internet === null ? "CHECKING" : internet ? "CONNECTED" : "DISCONNECTED";
  $("connection").dataset.state = state;
  $("connection-label").textContent = label;
}

function showOffline() {
  for (const id of ["indicator1", "indicator2", "lux"]) {
    renderIndicator(id, { state: "unknown", label: "NO LINK", detail: "" });
  }
  $("battery").textContent = "—";
  $("connection").dataset.state = "offline";
  $("connection-label").textContent = "OFFLINE";
}

// Lock Screen Functionality ================================================================

// lock state / lock color / invisible layer / closing pop ups on lock / keypad set up / lock break
function syncLock(state) {
  const wasLocked = lockState.locked;
  lockState = state;
  const locked = state.locked || !state.configured;
  $("lock-button").dataset.locked = String(locked);
  $("lock-button").querySelector("span").textContent = locked ? "LOCKED" : "LOCK";
  $("locked").hidden = !locked;
  if (locked && !wasLocked) {
    for (const id of ["quick", "settings", "confirm"]) $(id).close();
  }
  if (!state.configured && keypad.mode !== "setup") openKeypad("setup");
  if (state.break_seconds > 0) keypad.breakUntil = Date.now() + state.break_seconds * 1000;
}

// tells server to lock - updates on screen
async function lockNow() {
  const result = await post("/api/lock/lock");
  if (result.ok) syncLock(result);
}

$("lock-button").addEventListener("click", lockNow);
$("locked").addEventListener("click", () => openKeypad("unlock"));

// Auto-lock after the set time without a touch (not while Google Home is showing;
// app.py handles that).
document.addEventListener("pointerdown", () => (lastTouch = Date.now()), true);
document.addEventListener("keydown", () => (lastTouch = Date.now()), true);

// talos auto locks when no input has been detected (default is 120s)
function checkAutoLock() {
  const idle = (settings.lock_idle || 120) * 1000;
  if (lockState.configured && !lockState.locked && !homeVisible && Date.now() - lastTouch >= idle) {
    lockNow();
  }
}

// Called by app.py when Google Home comes to the front or goes away.
// records time and resets idle timer
window.setHomeVisible = (visible) => {
  homeVisible = visible;
  lastTouch = Date.now();
};

// Keypad ==========================================================================

const keypad = { mode: null, pin: "", length: 6, busy: false, wrong: false, breakUntil: 0, timer: null };

// opens keypad...
function openKeypad(mode) {
  keypad.mode = mode;
  keypad.pin = "";
  keypad.busy = false;
  keypad.length = mode === "unlock" ? lockState.pin_length : 6;
  $("keypad").dataset.mode = mode;
  $("keypad").dataset.result = mode === "unlock" && keypad.wrong ? "wrong" : "";
  $("keypad-title").textContent = mode === "change" ? "NEW PASSCODE" : "SET YOUR PASSCODE";
  $("keypad-home").hidden = mode === "setup"; // first-time setup can't be skipped
  $("keypad").hidden = false;
  renderKeypad();
  restartKeypadTimer();
}

// closes keypad...
function closeKeypad() {
  $("keypad").hidden = true;
  keypad.mode = null;
  keypad.pin = "";
  clearTimeout(keypad.timer);
}

// restarts keypad...
function restartKeypadTimer() {
  clearTimeout(keypad.timer);
  if (keypad.mode !== "setup") keypad.timer = setTimeout(closeKeypad, demo ? DEMO_KEYPAD_TIMEOUT_MS : KEYPAD_TIMEOUT_MS);
}

// draws keypad pin dots / redraws based on situation
function renderKeypad() {
  const dots = $("keypad-dots");
  const left = Math.ceil((keypad.breakUntil - Date.now()) / 1000);
  if (keypad.mode === "unlock" && left > 0) {
    dots.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; // break
  } else {
    dots.replaceChildren();
    for (let i = 0; i < keypad.length; i++) {
      const dot = document.createElement("span");
      dot.className = i < keypad.pin.length ? "dot filled" : "dot";
      dots.append(dot);
    }
  }
  for (const button of document.querySelectorAll("#keypad-lengths button")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.length) === keypad.length));
  }
}

// runs on every button press / button logic
function pressKey(key) {
  restartKeypadTimer();
  if (keypad.busy || (keypad.mode === "unlock" && keypad.breakUntil > Date.now())) return;
  if (key === "home") {
    const changing = keypad.mode === "change";
    closeKeypad(); // back to the locked dashboard or sleep clock
    if (changing) $("settings").showModal(); // or back to settings
    return;
  }
  if (key === "back") {
    keypad.pin = keypad.pin.slice(0, -1);
  } else if (keypad.pin.length < keypad.length) {
    keypad.pin += key;
  }
  renderKeypad();
  if (keypad.pin.length === keypad.length) submitPin();
}

// sends keypad pin to sever
async function submitPin() {
  keypad.busy = true;
  const pin = keypad.pin;
  keypad.pin = "";
  try {
    if (keypad.mode === "unlock") {
      const result = await post("/api/lock/unlock", { pin });
      if ("locked" in result) syncLock(result);
      if (result.ok) {
        keypad.wrong = false;
        $("keypad").dataset.result = "right"; // green for 0.3 s, then unlocked
        setTimeout(() => {
          closeKeypad();
          hideSleep();
          lastTouch = Date.now();
        }, 300);
        return;
      }
      keypad.wrong = true; // stays red until the right code
      $("keypad").dataset.result = "wrong";
    } else {
      const result = await post("/api/lock/set-pin", { pin });
      if (result.ok) {
        syncLock(result);
        closeKeypad();
        lastTouch = Date.now();
      }
    }
  } finally {
    keypad.busy = false;
    renderKeypad();
  }
}

for (const button of document.querySelectorAll("#keypad [data-key]")) {
  const key = button.dataset.key;
  if (key === "back") {
    // Tap ⌫ deletes one digit; hold it to clear everything.
    let held = null;
    button.addEventListener("pointerdown", () => {
      held = setTimeout(() => {
        held = "cleared";
        keypad.pin = "";
        renderKeypad();
      }, 600);
    });
    button.addEventListener("click", () => {
      if (held !== "cleared") pressKey("back");
      clearTimeout(held);
      held = null;
    });
  } else {
    button.addEventListener("click", () => pressKey(key));
  }
}

for (const button of document.querySelectorAll("#keypad-lengths button")) {
  button.addEventListener("click", () => {
    keypad.length = Number(button.dataset.length);
    keypad.pin = "";
    renderKeypad();
  });
}

// Quick Access (𐤀) ============================================================

// closes pop up menu, when user taps 'empty' space
function closeOnBackdrop(dialog) {
  dialog.addEventListener("click", (event) => {
    // Close only on a tap outside the box (taps on its padding also target the dialog).
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}

closeOnBackdrop($("quick"));
closeOnBackdrop($("settings"));

$("quick-open").addEventListener("click", () => {
  $("quick-message").textContent = "";
  $("quick").showModal();
});

let pendingAction = null;

//user confirmation, on selected action
function askConfirm(action) {
  pendingAction = action;
  $("confirm-title").textContent = action === "reboot" ? "RESTART PI?" : "SHUT DOWN PI?";
  $("confirm").showModal();
}

$("confirm-no").addEventListener("click", () => $("confirm").close());
$("confirm-yes").addEventListener("click", async () => {
  $("confirm").close();
  const result = await post(`/api/system/${pendingAction}`);
  $("quick-message").textContent = result.ok ? "" : result.error;
});

// Fullscreen - enter or exit
function setFullscreen(enter) {
  if (app) {
    app.postMessage(enter ? "fullscreen-enter" : "fullscreen-exit");
  } else if (enter) {
    document.documentElement.requestFullscreen?.();
  } else if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}

// maps buttons on quick access pop up
const quickActions = {
  "restart-home": async () => {
    const result = await post("/api/google-home/restart");
    $("quick-message").textContent = result.ok
      ? result.started ? "Restarting Google Home…" : "Already restarting…"
      : result.error;
  },
  settings: () => {
    $("quick").close();
    $("settings").showModal();
  },
  "fullscreen-exit": () => setFullscreen(false),
  "fullscreen-enter": () => setFullscreen(true),
  reboot: () => askConfirm("reboot"),
  poweroff: () => askConfirm("poweroff"),
  lock: () => {
    $("quick").close();
    lockNow();
  },
};

for (const button of document.querySelectorAll("[data-quick]")) {
  button.addEventListener("click", () => quickActions[button.dataset.quick]());
}

// Settings Screen (Brightness, Idle Timer, etc) ================================================

function renderSettings(values) {
  settings = values;
  for (const stepper of document.querySelectorAll(".stepper")) {
    stepper.querySelector("output").textContent = values[stepper.dataset.setting] + stepper.dataset.unit;
  }
  for (const button of document.querySelectorAll('[data-setting="sleep_mode"] button')) {
    button.setAttribute("aria-pressed", String(button.dataset.value === values.sleep_mode));
  }
  $("dimmer").style.opacity = String(1 - values.brightness / 100);
}

async function saveSetting(key, value) {
  const result = await post("/api/settings", { [key]: value });
  if (result.ok) renderSettings(result.settings);
}

for (const stepper of document.querySelectorAll(".stepper")) {
  const key = stepper.dataset.setting;
  for (const button of stepper.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const [low, high] = LIMITS[key];
      const value = settings[key] + Number(button.dataset.delta) * Number(stepper.dataset.step);
      saveSetting(key, Math.min(high, Math.max(low, value)));
    });
  }
}

for (const button of document.querySelectorAll('[data-setting="sleep_mode"] button')) {
  button.addEventListener("click", () => saveSetting("sleep_mode", button.dataset.value));
}

$("change-pin").addEventListener("click", () => {
  $("settings").close();
  openKeypad("change");
});
$("settings-done").addEventListener("click", () => $("settings").close());

// Sleep clock (the clock button) =========================================================

async function openSleep() {
  if (settings.sleep_mode === "off") {
    const result = await post("/api/system/screen-off");
    if (result.ok) return; // the screen is off; a tap wakes it
  }
  // Dim clock, or a black screen (also used if "off screen" isn't set up yet).
  $(settings.sleep_mode === "clock" ? "sleep-clock" : "sleep-black").hidden = false;
  document.fonts.load("10px DSEG7").then(fitSleepClock); // size it once the digital font is ready
}

// Make the sleep clock as big as the screen allows.
function fitSleepClock() {
  if ($("sleep-clock").hidden) return;
  const time = $("sleep-time");
  time.style.fontSize = "100px";
  const scale = Math.min((0.94 * innerWidth) / time.offsetWidth, (0.9 * innerHeight) / time.offsetHeight);
  time.style.fontSize = `${Math.floor(100 * scale)}px`;
}

function hideSleep() {
  $("sleep-clock").hidden = true;
  $("sleep-black").hidden = true;
}

$("clock-button").addEventListener("click", openSleep);
for (const id of ["sleep-clock", "sleep-black"]) {
  // A tap returns to the dashboard; if Talos locked meanwhile, it opens the keypad and the clock stays.
  $(id).addEventListener("click", () => (lockState.locked ? openKeypad("unlock") : hideSleep()));
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lockState.locked) hideSleep();
});

// Google Home & Nav bar ===================================================================
// Inside the Talos app (app.py) the GOOGLE HOME button asks the app to bring the
// Google Home window to the front. In a normal browser it just opens Google Home.

function openGoogleHome() {
  if (app) {
    app.postMessage("google-home");
  } else {
    window.open("https://home.google.com/", "_blank");
  }
}

document.querySelector('[data-page="google-home"]').addEventListener("click", openGoogleHome);

// Main loop ===================================================================================

async function update() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const status = await response.json();
    demo = status.demo;
    renderHealth(status.health);
    renderIndicator("indicator1", status.sensor.indicator1);
    renderIndicator("indicator2", status.sensor.indicator2);
    renderLux(status.sensor.lux);
    renderDaylight(status.daylight);
    renderConnection(status.internet);
    $("battery").textContent = status.sensor.battery === null ? "—" : `${status.sensor.battery}%`;
    renderSettings(status.settings);
    syncLock(status.lock);
  } catch (error) {
    showOffline(); // server not reachable
  }
}

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  $("clock").textContent = `${hh}:${mm}`;
  $("sleep-time").textContent = `${now.getHours() % 12 || 12}:${mm}:${now.getHours() >= 12 ? "P" : "A"}`;
  if (!$("sleep-clock").hidden) fitSleepClock();
  if (keypad.mode) renderKeypad(); // break countdown
  checkAutoLock();
}

updateClock();
update();
setInterval(updateClock, 1000);
setInterval(update, POLL_MS);
