// ============================================================
//  Move Church Kids Hunt — Google Apps Script Backend
//
//  SETUP (one-time, ~5 minutes):
//  1. Go to https://script.google.com → New Project
//  2. Paste this entire file, replacing any existing code
//  3. Click Deploy → New Deployment
//       • Type: Web app
//       • Execute as: Me
//       • Who has access: Anyone
//  4. Copy the Web App URL and paste it into js/app.js as scriptUrl
//  5. Commit & push to GitHub. Done!
//
//  This script manages two sheets:
//   "Leaderboard" — final finish times
//   "Checkins"    — individual location check-ins (for admin tracking)
// ============================================================

var LEADERBOARD_SHEET = "Leaderboard";
var CHECKINS_SHEET    = "Checkins";

function doGet(e) {
  var action = (e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (action === "submit")      return respond(submitEntry(e));
  if (action === "leaderboard") return respond(getLeaderboard());
  if (action === "checkin")     return respond(saveCheckin(e));
  if (action === "progress")    return respond(getAdminProgress());

  return respond({ error: "Unknown action. Use: submit | leaderboard | checkin | progress" });
}

// ── FINAL FINISH ─────────────────────────────────────────────────────────

function submitEntry(e) {
  var sheet = getOrCreateLeaderboard();

  var teamName  = sanitize(e.parameter.team || "Unknown Team", 50);
  var totalMs   = parseInt(e.parameter.totalMs || "0");
  if (isNaN(totalMs) || totalMs < 0) totalMs = 0;

  // Prevent duplicate submissions for the same team
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toLowerCase() === teamName.toLowerCase()) {
        return { success: false, duplicate: true, message: "Team already submitted." };
      }
    }
  }

  var rank         = sheet.getLastRow(); // header = row 1, first entry → rank 1
  var formatted    = formatMs(totalMs);
  var submittedAt  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy hh:mm:ss a");

  sheet.appendRow([rank, teamName, totalMs, formatted, submittedAt]);

  return { success: true, rank: rank, time: formatted, team: teamName };
}

// ── LEADERBOARD (public) ─────────────────────────────────────────────────

function getLeaderboard() {
  var sheet   = getOrCreateLeaderboard();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) return { entries: [] };

  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  var entries = data
    .filter(function(r) { return r[1] !== ""; })
    .map(function(r) { return { rank: r[0], team: r[1], ms: Number(r[2]), time: r[3], at: r[4] }; })
    .sort(function(a, b) { return a.ms - b.ms; });

  entries.forEach(function(e, i) { e.rank = i + 1; });

  return { entries: entries };
}

// ── CHECKINS (location-level tracking) ───────────────────────────────────

function saveCheckin(e) {
  var sheet      = getOrCreateCheckins();
  var teamName   = sanitize(e.parameter.team || "Unknown", 50);
  var locationId = parseInt(e.parameter.location || "0");
  var timeMs     = parseInt(e.parameter.timeMs  || "0");

  // Prevent duplicate checkins for same team + location
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var existing = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toLowerCase() === teamName.toLowerCase() &&
          Number(existing[i][1]) === locationId) {
        return { success: true, duplicate: true };
      }
    }
  }

  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy hh:mm:ss a");
  sheet.appendRow([teamName, locationId, timeMs, ts]);

  return { success: true };
}

// ── ADMIN PROGRESS ───────────────────────────────────────────────────────

function getAdminProgress() {
  var checkinSheet     = getOrCreateCheckins();
  var leaderboardSheet = getOrCreateLeaderboard();

  // Build checkin map: { teamName → [locationIds] }
  var checkinMap = {};
  var lastCRow = checkinSheet.getLastRow();
  if (lastCRow > 1) {
    checkinSheet.getRange(2, 1, lastCRow - 1, 4).getValues().forEach(function(row) {
      var name  = String(row[0]);
      var locId = Number(row[1]);
      if (!name) return;
      if (!checkinMap[name]) checkinMap[name] = [];
      if (checkinMap[name].indexOf(locId) === -1) checkinMap[name].push(locId);
    });
  }

  // Build finisher map: { teamName → { rank, time, ms } }
  var finisherMap = {};
  var lastLRow = leaderboardSheet.getLastRow();
  if (lastLRow > 1) {
    leaderboardSheet.getRange(2, 1, lastLRow - 1, 5).getValues().forEach(function(row) {
      if (!row[1]) return;
      finisherMap[String(row[1])] = { rank: row[0], time: row[3], ms: Number(row[2]) };
    });
  }

  // Include finishers even if they have no separate checkin rows
  Object.keys(finisherMap).forEach(function(name) {
    if (!checkinMap[name]) checkinMap[name] = [];
  });

  var teams = Object.keys(checkinMap).map(function(name) {
    var locs     = checkinMap[name];
    var finisher = finisherMap[name] || null;
    return {
      name           : name,
      locationsFound : locs,
      count          : locs.length,
      finished       : !!finisher,
      finishTime     : finisher ? finisher.time : null,
      finishMs       : finisher ? finisher.ms   : null,
      rank           : finisher ? finisher.rank  : null
    };
  });

  // Sort: finishers first (by rank), then by locations found (desc)
  teams.sort(function(a, b) {
    if (a.finished && b.finished) return a.rank - b.rank;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.count - a.count;
  });

  return { teams: teams, timestamp: new Date().toISOString() };
}

// ── SHEET HELPERS ─────────────────────────────────────────────────────────

function getOrCreateLeaderboard() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LEADERBOARD_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(LEADERBOARD_SHEET);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Rank", "Team Name", "Time (ms)", "Time (mm:ss)", "Submitted At"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateCheckins() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHECKINS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CHECKINS_SHEET);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Team Name", "Location ID", "Time Elapsed (ms)", "Timestamp"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── UTILS ─────────────────────────────────────────────────────────────────

function formatMs(ms) {
  var s   = Math.floor(ms / 1000);
  var min = Math.floor(s / 60);
  var sec = s % 60;
  return min + ":" + (sec < 10 ? "0" : "") + sec;
}

function sanitize(str, maxLen) {
  return String(str).replace(/[<>"']/g, "").substring(0, maxLen);
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
