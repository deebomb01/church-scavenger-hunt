// ============================================================
//  Move Church Kids Hunt — Google Apps Script Backend
//  Handles leaderboard storage using a Google Sheet.
//
//  SETUP (one-time, ~5 minutes):
//  1. Go to https://script.google.com → New Project
//  2. Paste this entire file into the editor, replacing any existing code
//  3. Click the floppy disk (Save) icon — name it anything
//  4. Click Deploy → New Deployment
//       • Type: Web app
//       • Execute as: Me
//       • Who has access: Anyone
//  5. Click Deploy → copy the Web App URL
//  6. Open js/app.js in this project and paste the URL as the value of scriptUrl:
//       scriptUrl: "https://script.google.com/macros/s/XXXXXX/exec"
//  7. Commit & push to GitHub. Done!
//
//  The script auto-creates a Google Sheet on first submission.
// ============================================================

var SHEET_NAME = "Leaderboard";

function doGet(e) {
  var action = (e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (action === "submit") {
    return respond(submitEntry(e));
  }
  if (action === "leaderboard") {
    return respond(getLeaderboard());
  }

  return respond({ error: "Unknown action. Use ?action=submit or ?action=leaderboard" });
}

// ── SUBMIT ────────────────────────────────────────────────────────────────

function submitEntry(e) {
  var sheet = getOrCreateSheet();

  var teamName = sanitize(e.parameter.team || "Unknown Team", 50);
  var totalMs  = parseInt(e.parameter.totalMs || "0");
  if (isNaN(totalMs) || totalMs < 0) totalMs = 0;

  var formattedTime = formatMs(totalMs);
  var submittedAt   = Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy hh:mm:ss a"
  );

  // Rank = number of existing data rows + 1 (header is row 1)
  var rank = sheet.getLastRow(); // before append, so first entry = 1

  sheet.appendRow([rank, teamName, totalMs, formattedTime, submittedAt]);

  return { success: true, rank: rank, time: formattedTime, team: teamName };
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────

function getLeaderboard() {
  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { entries: [] };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  var entries = data
    .filter(function(row) { return row[1] !== ""; })
    .map(function(row) {
      return {
        rank : row[0],
        team : row[1],
        ms   : Number(row[2]),
        time : row[3],
        at   : row[4]
      };
    })
    .sort(function(a, b) { return a.ms - b.ms; });

  // Re-rank after sort by time
  entries.forEach(function(entry, i) { entry.rank = i + 1; });

  return { entries: entries };
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    var headers = ["Rank", "Team Name", "Time (ms)", "Time (mm:ss)", "Submitted At"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function formatMs(ms) {
  var totalSec = Math.floor(ms / 1000);
  var min = Math.floor(totalSec / 60);
  var sec = totalSec % 60;
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
