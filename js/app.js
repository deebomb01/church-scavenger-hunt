// ─── HUNT CONFIGURATION ────────────────────────────────────────────────────
const HUNT_CONFIG = {
  name: "Move Church Kids Scavenger Hunt",
  huntDurationMs: 45 * 60 * 1000, // 45-minute countdown
  scriptUrl: "https://script.google.com/macros/s/AKfycbxvT2FeXbBdqv-F7FUI8OMllj4AenqLJ25wDf92ErL8lBaSzXKfBI4xd3mmj_ZMSvto_w/exec",
  locations: [
    {
      id: 1,
      name: "Main Entrance",
      icon: "🚪",
      clue: "I stand at the start of every visit and the end of every goodbye. No matter who you are or where you came from, you walked through me to get here today. Find the very first thing you saw when you arrived.",
      lat: 38.6765,
      lng: -77.3350
    },
    {
      id: 2,
      name: "Playground",
      icon: "⛹️",
      clue: "When the lesson ends and energy has nowhere to go, little feet race here to run, swing, and shout with joy. Look for me outside under the open sky — where laughter never fades away.",
      lat: 38.6757,
      lng: -77.3357
    },
    {
      id: 3,
      name: "Children's Wing",
      icon: "📚",
      clue: "Small chairs, big lessons, and colorful walls. This is where the next generation comes each week to hear God's Word and grow in faith. Listen for the sound of tiny voices.",
      lat: 38.6763,
      lng: -77.3343
    },
    {
      id: 4,
      name: "Sanctuary",
      icon: "🙏",
      clue: "This room was built for one purpose — to lift voices and bow hearts. It holds the most seats and carries the biggest sound in the building. Follow the sound of worship to find it.",
      lat: 38.6759,
      lng: -77.3349
    },
    {
      id: 5,
      name: "Fellowship Hall",
      icon: "🍽️",
      clue: "Every great church has a table. This is where meals are shared, neighbors become family, and no one leaves hungry. Find the room that smells like a feast.",
      lat: 38.6764,
      lng: -77.3355
    }
  ]
};

// Admin password — change this before your event
const ADMIN_PASSWORD = "movechurch2025";

// ─── TEAM / PROGRESS STORAGE ───────────────────────────────────────────────

function getTeam() {
  try {
    const t = localStorage.getItem("hunt_team");
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}

function setTeam(name) {
  const team = { name: name.trim(), startTime: Date.now() };
  localStorage.setItem("hunt_team", JSON.stringify(team));
  return team;
}

function requireTeam() {
  const team = getTeam();
  if (!team) {
    const inLocation = window.location.pathname.includes("/location/");
    window.location.href = inLocation ? "../index.html" : "index.html";
    return null;
  }
  return team;
}

function getProgress() {
  try {
    const p = localStorage.getItem("hunt_progress");
    return p ? JSON.parse(p) : {};
  } catch { return {}; }
}

function markVisited(locationId) {
  const progress = getProgress();
  if (!progress[locationId]) {
    progress[locationId] = Date.now();
    localStorage.setItem("hunt_progress", JSON.stringify(progress));
    // Fire-and-forget backend checkin
    const team = getTeam();
    if (team) {
      submitCheckin(team.name, locationId, Date.now() - team.startTime);
    }
  }
  return progress;
}

function isComplete() {
  const progress = getProgress();
  return HUNT_CONFIG.locations.every(loc => !!progress[loc.id]);
}

function clearHunt() {
  localStorage.removeItem("hunt_team");
  localStorage.removeItem("hunt_progress");
}

function visitedCount() {
  return Object.keys(getProgress()).length;
}

// ─── PROGRESS BAR UI ───────────────────────────────────────────────────────

function renderProgressBar(containerId, currentId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const progress = getProgress();
  let html = '<div class="progress-track">';
  HUNT_CONFIG.locations.forEach((loc, i) => {
    const visited = !!progress[loc.id];
    const isCurrent = loc.id === currentId;
    let cls = "progress-dot";
    if (visited) cls += " visited";
    else if (isCurrent) cls += " current";
    const label = visited ? "✓" : loc.id;
    html += `<div class="${cls}" title="${visited ? loc.name : "Not found yet"}">${label}</div>`;
    if (i < HUNT_CONFIG.locations.length - 1) {
      html += `<div class="progress-line${visited ? " visited" : ""}"></div>`;
    }
  });
  html += "</div>";
  el.innerHTML = html;
}

// ─── COUNTDOWN TIMER ───────────────────────────────────────────────────────

function getTimeRemaining() {
  const team = getTeam();
  if (!team) return null;
  const elapsed = Date.now() - team.startTime;
  return Math.max(0, HUNT_CONFIG.huntDurationMs - elapsed);
}

function formatCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

function startCountdownTimer(elementId, onExpire) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  function tick() {
    const remaining = getTimeRemaining();
    if (remaining === null) return;
    el.textContent = formatCountdown(remaining);
    // Color feedback
    if (remaining <= 5 * 60 * 1000) {
      el.style.color = "#EF4444";
    } else if (remaining <= 10 * 60 * 1000) {
      el.style.color = "#F59E0B";
    } else {
      el.style.color = "";
    }
    if (remaining === 0 && typeof onExpire === "function") {
      onExpire();
    }
  }

  tick();
  return setInterval(tick, 1000);
}

// ─── TIME FORMATTING ───────────────────────────────────────────────────────

function formatTimeShort(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

// ─── LEADERBOARD / CHECKIN API ─────────────────────────────────────────────

function submitCheckin(teamName, locationId, timeMs) {
  const url = HUNT_CONFIG.scriptUrl;
  if (!url) return;
  const params = new URLSearchParams({ action: "checkin", team: teamName, location: locationId, timeMs });
  fetch(url + "?" + params.toString()).catch(() => {});
}

async function submitCompletion(teamName, startTime, endTime) {
  const url = HUNT_CONFIG.scriptUrl;
  if (!url) return null;
  const params = new URLSearchParams({
    action: "submit", team: teamName,
    startTime, endTime, totalMs: endTime - startTime
  });
  try {
    const res = await fetch(url + "?" + params.toString());
    return await res.json();
  } catch { return null; }
}

async function fetchLeaderboard() {
  const url = HUNT_CONFIG.scriptUrl;
  if (!url) return null;
  try {
    const res = await fetch(url + "?action=leaderboard");
    const data = await res.json();
    return data.entries || [];
  } catch { return null; }
}

async function fetchAdminProgress() {
  const url = HUNT_CONFIG.scriptUrl;
  if (!url) return null;
  try {
    const res = await fetch(url + "?action=progress");
    return await res.json();
  } catch { return null; }
}
