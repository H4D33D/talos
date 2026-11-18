// demo.js - Talos Home Hub - H4D33D
// Live browser demo for GitHub: no Python server needed.
// On GitHub Pages there is no Talos server, so this file answers the page's
// /api/... requests inside the browser with fake data.

"use strict";

(() => {
  const onPages = location.hostname.endsWith("github.io") || new URLSearchParams(location.search).has("demo");
  if (!onPages) return;

  const started = Date.now() / 1000;
  const lock = { pin: null, locked: true, wrong: 0, breakUntil: 0 };
  const settings = { home_idle: 60, lock_idle: 120, sleep_mode: "clock", brightness: 100 };
  const sensor = { lastActivity: null, presenceSince: null, wasActive: false };

  const lockState = () => ({
    configured: lock.pin !== null,
    locked: lock.locked || lock.pin === null,
    pin_length: lock.pin ? lock.pin.length : 0,
    break_seconds: Math.max(0, Math.round(lock.breakUntil - Date.now() / 1000)),
  });

  // The same 60-second scene and indicator rules as run_demo() and SensorState.
  function sensorSnapshot(now) {
    const second = Math.floor(now) % 60;
    const pir = (second >= 15 && second <= 17) || (second >= 30 && second < 33);
    const presence = second >= 30 && second <= 48;
    const active = pir || presence;
    if (active || sensor.wasActive) sensor.lastActivity = now;
    sensor.wasActive = active;
    if (presence && sensor.presenceSince === null) sensor.presenceSince = now;
    if (!presence) sensor.presenceSince = null;

    const ago = sensor.lastActivity === null ? Infinity : now - sensor.lastActivity;
    const held = sensor.presenceSince === null ? 0 : now - sensor.presenceSince;
    const lux = second >= 52 ? 2 : 14;
    return {
      indicator1: active
        ? { state: "red", label: "THROTTLE", detail: "" }
        : ago < 60
          ? { state: "yellow", label: "CAUTION", detail: `${Math.floor(ago)}s ago` }
          : { state: "green", label: "IDLE", detail: "" },
      indicator2: held >= 10
        ? { state: "red", label: "BOTTLENECK", detail: `${Math.floor(held)}s elapsed` }
        : { state: "green", label: "CLEAR", detail: "" },
      lux: { state: lux > 10 ? "on" : "off", value: lux },
      battery: 87,
    };
  }

  function status() {
    const now = Date.now() / 1000;
    const hour = new Date().getHours();
    const isDay = hour >= 7 && hour < 19; // demo: day from 07:00 to 19:00 local time
    return {
      demo: true,
      time: now,
      internet: true,
      health: {
        cpu_temp: 50 + 4 * Math.sin(now / 60),
        cpu_usage: 12 + 10 * Math.abs(Math.sin(now / 25)),
        ram_used: 1.7e9, ram_total: 3.8e9,
        disk_used: 11.2e9, disk_total: 58.4e9,
        uptime: 3 * 86400 + (now - started),
      },
      sensor: sensorSnapshot(now),
      daylight: { is_day: isDay, sunrise: "07:00", sunset: "19:00", next_change: isDay ? "19:00" : "07:00" },
      lock: lockState(),
      settings: { ...settings },
    };
  }

  // The same actions as server.py, kept in this tab only.
  function action(path, body) {
    if (path === "/api/lock/lock") {
      lock.locked = true;
      return { ok: true, ...lockState() };
    }
    if (path === "/api/lock/unlock") {
      if (Date.now() / 1000 < lock.breakUntil) return { ok: false, error: "On a break", ...lockState() };
      const ok = String(body.pin) === lock.pin;
      if (ok) {
        lock.locked = false;
        lock.wrong = 0;
      } else if (++lock.wrong % 5 === 0) {
        lock.breakUntil = Date.now() / 1000 + 600;
      }
      return { ok, ...lockState() };
    }
    if (path === "/api/lock/set-pin") {
      if (lock.pin !== null && lock.locked) return { ok: false, error: "Unlock first", ...lockState() };
      lock.pin = String(body.pin);
      lock.locked = false;
      return { ok: true, ...lockState() };
    }
    if (lock.locked) return { ok: false, error: "Unlock first", ...lockState() };
    if (path === "/api/settings") {
      Object.assign(settings, body);
      return { ok: true, settings: { ...settings } };
    }
    if (path === "/api/google-home/restart") return { ok: true, started: true };
    if (path.startsWith("/api/system/")) return { ok: false, error: "Demo mode: Pi controls are off" };
    return { ok: false, error: "Not found" };
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    const path = new URL(url, location.href).pathname;
    if (!path.startsWith("/api/")) return realFetch(url, options);
    const data = options.method === "POST" ? action(path, JSON.parse(options.body || "{}")) : status();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  };
})();
