// ─── HUNT CONFIGURATION ────────────────────────────────────────────────────
// After deploying to GitHub Pages, update scriptUrl with your Google Apps Script URL.
const HUNT_CONFIG = {
  name: "Move Church Kids Scavenger Hunt",
  scriptUrl: "", // TODO: Paste your Google Apps Script deployment URL here
  locations: [
    {
      id: 1,
      name: "Main Entrance",
      icon: "🚪",
      hint: "Where every journey begins — find the front door!",
      lat: 38.6450,
      lng: -77.2966
    },
    {
      id: 2,
      name: "Playground",
      icon: "⛹️",
      hint: "Where kids love to run, jump, and play outside!",
      lat: 38.6440,
      lng: -77.2973
    },
    {
      id: 3,
      name: "Children's Wing",
      icon: "📚",
      hint: "The hallway where little ones learn and grow in faith!",
      lat: 38.6448,
      lng: -77.2958
    },
    {
      id: 4,
      name: "Sanctuary",
      icon: "🙏",
      hint: "The sacred place where we gather together to worship!",
      lat: 38.6442,
      lng: -77.2963
    },
    {
      id: 5,
      name: "Fellowship Hall",
      icon: "🍽️",
      hint: "Where we eat, laugh, and share life together!",
      lat: 38.6447,
      lng: -77.2971
    }
  ]
};

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
  }
  return progress;
}

function isComplete() {
  const progress = getProgress();
  return HUNT_CONFIG.locations.every(function(loc) { return !!progress[loc.id]; });
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
  var el = document.getElementById(containerId);
  if (!el) return;
  var progress = getProgress();
  var html = '<div class="progress-track">';
  HUNT_CONFIG.locations.forEach(function(loc, i) {
    var visited = !!progress[loc.id];
    var isCurrent = loc.id === currentId;
    var cls = "progress-dot";
    if (visited) cls += " visited";
    else if (isCurrent) cls += " current";
    var label = visited ? "✓" : loc.id;
    html += '<div class="' + cls + '" title="' + loc.name + '">' + label + "</div>";
    if (i < HUNT_CONFIG.locations.length - 1) {
      html += '<div class="progress-line' + (visited ? " visited" : "") + '"></div>';
    }
  });
  html += "</div>";
  el.innerHTML = html;
}

// ─── TIME FORMATTING ───────────────────────────────────────────────────────

function formatTimeShort(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

// ─── LEADERBOARD API (Google Apps Script) ──────────────────────────────────

async function submitCompletion(teamName, startTime, endTime) {
  var url = HUNT_CONFIG.scriptUrl;
  if (!url) return null;
  var totalMs = endTime - startTime;
  var params = new URLSearchParams({
    action: "submit",
    team: teamName,
    startTime: startTime,
    endTime: endTime,
    totalMs: totalMs
  });
  try {
    var res = await fetch(url + "?" + params.toString());
    return await res.json();
  } catch (e) {
    console.warn("Leaderboard submit failed:", e);
    return null;
  }
}

async function fetchLeaderboard() {
  var url = HUNT_CONFIG.scriptUrl;
  if (!url) return null;
  try {
    var res = await fetch(url + "?action=leaderboard");
    var data = await res.json();
    return data.entries || [];
  } catch (e) {
    console.warn("Leaderboard fetch failed:", e);
    return null;
  }
}
