/**
 * Job Log Analyzer — analyzer.js
 * Features: Beginner / Experienced mode, XP system, badges, level-up
 */

// ===== Pattern Definitions =====
const PATTERNS = [
  // IBM i
  {
    id: "MCH1211", severity: "error",
    regex: /MCH1211/i,
    label: "MCH1211 — Divide by Zero",
    hint: "A divide-by-zero occurred. Check that the divisor variable is validated before the division operation.",
    shortHint: "Divisor is 0. Where does that value come from?",
    manual: "IBM i Message Ref MCH1211: Divide-by-zero. Guard the division with an IF check (e.g., IF DIVISOR <> 0) before executing the operation.",
  },
  {
    id: "MCH3601", severity: "error",
    regex: /MCH3601/i,
    label: "MCH3601 — Null Pointer",
    hint: "A pointer variable was used before being initialized. Look for missing ALLOC or SET ADDRESS statements.",
    shortHint: "Pointer is NULL. Was it ever allocated?",
    manual: "IBM i Message Ref MCH3601: Pointer not set. Use ALLOC or SET ADDRESS to initialize the pointer before referencing it.",
  },
  {
    id: "CPF4131", severity: "error",
    regex: /CPF4131/i,
    label: "CPF4131 — File Open Failed",
    hint: "The file could not be opened. Check: file name, library, and object authority.",
    shortHint: "File open failed. Name, library, or authority issue?",
    manual: "IBM i Message Ref CPF4131: File open failed. Use WRKOBJ / DSPOBJD to verify the object exists and GRTOBJAUT to check authority.",
  },
  {
    id: "CPF5029", severity: "error",
    regex: /CPF5029/i,
    label: "CPF5029 — Record Locked",
    hint: "Another job is holding a lock on this record. Use WRKOBJLCK to identify the blocking job.",
    shortHint: "Record is locked. Which job is holding it?",
    manual: "IBM i Message Ref CPF5029: Record locked. Run WRKOBJLCK OBJTYPE(*FILE) to find the lock holder, then end or wait for that job.",
  },
  {
    id: "CPF0864", severity: "error",
    regex: /CPF0864/i,
    label: "CPF0864 — Subsystem Not Active",
    hint: "The target subsystem is not running. Start it with STRSBS or check WRKSBS.",
    shortHint: "Subsystem is down. How do you start it?",
    manual: "IBM i Message Ref CPF0864: Subsystem not active. Use STRSBS SBSD(<name>) to start it.",
  },
  {
    id: "SQL0104", severity: "error",
    regex: /SQL0104/i,
    label: "SQL0104 — SQL Syntax Error",
    hint: "The SQL statement has a syntax error. Check for typos in keywords, column names, or table names near the flagged token.",
    shortHint: "SQL syntax error near which token?",
    manual: "DB2 for i SQL0104: Unexpected token. Validate the statement in ACS Run SQL Scripts or STRSQL.",
  },
  {
    id: "SQL0204", severity: "error",
    regex: /SQL0204/i,
    label: "SQL0204 — Object Not Found",
    hint: "The referenced table or view does not exist. Verify the schema name, table name, and case sensitivity.",
    shortHint: "Table not found. Schema name correct?",
    manual: "DB2 for i SQL0204: Object not found. Use DSPFD or check the NAMING option (system vs. SQL) in STRSQL.",
  },
  {
    id: "ABEND", severity: "error",
    regex: /\bABEND\b/i,
    label: "ABEND — Abnormal End",
    hint: "The job ended abnormally. Look at the messages immediately before this line to find the root cause.",
    shortHint: "Job abnormally ended. What came just before?",
    manual: "ABEND = Abnormal End. Use DSPJOBLOG to review the full log. Focus on the preceding error messages to trace the failure.",
  },
  {
    id: "CPFxxxx", severity: "error",
    regex: /CPF[0-9A-Z]{4}/,
    label: "CPFxxxx — System Message",
    hint: "An IBM i system message was detected. Look up the message ID with DSPMSGD to get the cause code and recovery steps.",
    shortHint: "System CPF message — what does DSPMSGD say?",
    manual: "Run DSPMSGD MSGID(CPFxxxx) MSGF(QCPFMSG) to read the cause and recovery action for this specific message.",
  },
  // Java / General
  {
    id: "NullPointerException", severity: "error",
    regex: /NullPointerException/i,
    label: "NullPointerException",
    hint: "A null reference was accessed. Check the stack trace to identify which variable is null and add a null-check.",
    shortHint: "NPE — which variable is null in the stack trace?",
    manual: "Java spec: NullPointerException is thrown when you call a method or access a field on a null reference. Use Optional or a guard clause.",
  },
  {
    id: "OutOfMemoryError", severity: "error",
    regex: /OutOfMemoryError/i,
    label: "OutOfMemoryError",
    hint: "The JVM heap is exhausted. Increase -Xmx or investigate for a memory leak using a heap dump.",
    shortHint: "Heap full. Leak or just needs more memory?",
    manual: "JVM: Use -Xmx<size>m to raise the heap limit. Take a heap dump via VisualVM or IBM Health Center to locate leak sources.",
  },
  {
    id: "SocketTimeoutException", severity: "error",
    regex: /SocketTimeoutException/i,
    label: "SocketTimeoutException",
    hint: "A network connection timed out. Verify the target host, port, and firewall settings.",
    shortHint: "Connection timed out. Is the host reachable?",
    manual: "Java SocketTimeoutException: Review setSoTimeout() value and confirm connectivity with ping / telnet to the target host and port.",
  },
  // Warnings
  {
    id: "WARN_LOCK", severity: "warning",
    regex: /\b(LOCK WAIT|LOCK TIMEOUT|lock wait)\b/i,
    label: "Lock Wait",
    hint: "Lock wait detected. Repeated occurrences may indicate a deadlock. Use WRKOBJLCK to check competing jobs.",
    shortHint: "Lock contention. Deadlock possible?",
    manual: "Use WRKOBJLCK or WRKJOB to identify competing jobs. Standardize transaction order to prevent deadlocks.",
  },
  {
    id: "WARN_DISK", severity: "warning",
    regex: /\b(DISK|ASP)\s*(FULL|USAGE|[0-9]{2,3}%)/i,
    label: "Disk / ASP Usage Warning",
    hint: "Disk usage is high. Delete unused journal receivers and spool files to free space.",
    shortHint: "ASP nearly full. What can be cleaned up?",
    manual: "Run WRKDSKSTS to check usage. Use DLTJRNRCV / DLTSPLF or RCLSTG to reclaim space.",
  },
  {
    id: "WARN_DEPRECATED", severity: "warning",
    regex: /\b(deprecated|廃止予定)\b/i,
    label: "Deprecated API",
    hint: "A deprecated API or command is in use. Plan migration to the recommended replacement before the next major release.",
    shortHint: "Deprecated call — what replaces it?",
    manual: "Check the IBM i Information Center release notes for the successor API or command and schedule migration accordingly.",
  },
];

// ===== XP / Level System =====
const LEVELS = [
  { level: 1, rank: "Rookie",      xpNeeded: 100,  emoji: "🔰" },
  { level: 2, rank: "Learner",     xpNeeded: 250,  emoji: "📘" },
  { level: 3, rank: "Analyst",     xpNeeded: 500,  emoji: "🔍" },
  { level: 4, rank: "Troubleshooter", xpNeeded: 900, emoji: "🛠️" },
  { level: 5, rank: "Expert",      xpNeeded: 1500, emoji: "⚡" },
  { level: 6, rank: "Master",      xpNeeded: Infinity, emoji: "🏆" },
];

const BADGES = {
  first:       { label: "1st Run",      condition: (s) => s.totalRuns >= 1 },
  streak3:     { label: "Streak×3",     condition: (s) => s.totalRuns >= 3 },
  errorhunter: { label: "Error Hunter", condition: (s) => s.totalErrors >= 10 },
  flawless:    { label: "Flawless",     condition: (s) => s.flawlessRuns >= 1 },
};

// ===== State (persisted to localStorage) =====
function loadState() {
  try {
    return JSON.parse(localStorage.getItem("jla_state") || "null") || {
      xp: 0, totalRuns: 0, totalErrors: 0, flawlessRuns: 0,
      unlockedBadges: [],
    };
  } catch { return { xp: 0, totalRuns: 0, totalErrors: 0, flawlessRuns: 0, unlockedBadges: [] }; }
}
function saveState(state) {
  localStorage.setItem("jla_state", JSON.stringify(state));
}

let state = loadState();
let currentMode = "beginner"; // "beginner" | "experienced"

// ===== XP helpers =====
function getLevelInfo(xp) {
  let cumulative = 0;
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const next = cumulative + LEVELS[i].xpNeeded;
    if (xp < next) {
      return { ...LEVELS[i], xpInLevel: xp - cumulative, xpForLevel: LEVELS[i].xpNeeded };
    }
    cumulative = next;
  }
  const last = LEVELS[LEVELS.length - 1];
  return { ...last, xpInLevel: 0, xpForLevel: 1 };
}

function addXP(amount) {
  const before = getLevelInfo(state.xp);
  state.xp += amount;
  const after = getLevelInfo(state.xp);
  saveState(state);
  renderXPBar();
  showToast(`+${amount} XP`);
  if (after.level > before.level) {
    setTimeout(() => showToast(`🎉 Level Up!  Lv.${after.level} ${after.rank}`, 2800), 1200);
  }
}

function renderXPBar() {
  const info = getLevelInfo(state.xp);
  document.getElementById("xp-level-label").textContent = `Lv.${info.level}`;
  document.getElementById("xp-rank-label").textContent = info.rank;
  document.getElementById("xp-avatar").textContent = info.emoji;
  const pct = info.xpForLevel === Infinity ? 100 : Math.round((info.xpInLevel / info.xpForLevel) * 100);
  document.getElementById("xp-fill").style.width = pct + "%";
  document.getElementById("xp-numbers").textContent =
    info.xpForLevel === Infinity
      ? `${state.xp} XP — MAX`
      : `${info.xpInLevel} / ${info.xpForLevel} XP`;
}

function checkBadges() {
  let newBadge = false;
  for (const [id, def] of Object.entries(BADGES)) {
    if (!state.unlockedBadges.includes(id) && def.condition(state)) {
      state.unlockedBadges.push(id);
      newBadge = true;
      setTimeout(() => showToast(`🏅 Badge Unlocked: ${def.label}`, 2400), 600);
    }
  }
  if (newBadge) saveState(state);
  renderBadges();
}

function renderBadges() {
  document.querySelectorAll(".badge").forEach((el) => {
    const id = el.dataset.badge;
    el.classList.toggle("unlocked", state.unlockedBadges.includes(id));
  });
}

// ===== Toast =====
let toastTimer = null;
function showToast(msg, duration = 1800) {
  const el = document.getElementById("xp-toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

// ===== Line Classifier =====
function classifyLine(line) {
  for (const p of PATTERNS) {
    if (p.regex.test(line)) return { severity: p.severity, pattern: p };
  }
  if (/\b(error|FAILED|EXCEPTION)\b/i.test(line)) {
    return { severity: "error", pattern: {
      id: "GENERIC_ERROR", label: "Error (generic)",
      hint: "An error was detected. Review surrounding lines for context.",
      shortHint: "Generic error — what's the context?",
      manual: "Use DSPJOBLOG to view the full log and trace earlier messages back to the root cause.",
    }};
  }
  if (/\b(warn|warning)\b/i.test(line)) {
    return { severity: "warning", pattern: {
      id: "GENERIC_WARN", label: "Warning (generic)",
      hint: "A warning was detected. It may affect subsequent steps if ignored.",
      shortHint: "Warning — could this cause downstream issues?",
      manual: "Review the warning details and confirm no business impact.",
    }};
  }
  if (/\b(COMPLETED|NORMAL|SUCCESS|OK|started|running)\b/i.test(line)) return { severity: "ok", pattern: null };
  if (/\b(INFO|notice)\b/i.test(line)) return { severity: "info", pattern: null };
  return { severity: "normal", pattern: null };
}

// ===== DOM refs =====
const logInput     = document.getElementById("log-input");
const analyzeBtn   = document.getElementById("analyze-btn");
const clearBtn     = document.getElementById("clear-btn");
const outputSect   = document.getElementById("output-section");
const detailSect   = document.getElementById("detail-section");
const logDisplay   = document.getElementById("log-display");
const detailList   = document.getElementById("detail-list");
const summaryBadge = document.getElementById("summary-badge");
const btnBeginner  = document.getElementById("btn-beginner");
const btnExperienced = document.getElementById("btn-experienced");
const modeDesc     = document.getElementById("mode-desc");

// ===== Mode toggle =====
btnBeginner.addEventListener("click", () => setMode("beginner"));
btnExperienced.addEventListener("click", () => setMode("experienced"));

function setMode(mode) {
  currentMode = mode;
  btnBeginner.classList.toggle("active", mode === "beginner");
  btnExperienced.classList.toggle("active", mode === "experienced");
  modeDesc.textContent = mode === "beginner"
    ? "Beginner — full explanation + manual reference shown for each finding"
    : "Experienced — hints only. Think it through yourself!";
}

// ===== Analyze =====
analyzeBtn.addEventListener("click", () => {
  const raw = logInput.value;
  if (!raw.trim()) return;

  const lines = raw.split("\n");
  const findings = [];

  // Build highlighted log
  logDisplay.innerHTML = "";
  lines.forEach((line, i) => {
    const { severity, pattern } = classifyLine(line);
    const span = document.createElement("span");
    span.textContent = line || " ";

    if (severity === "error") {
      span.className = "line-error";
      findings.push({ lineIndex: i + 1, line, severity, pattern });
      const idx = findings.length - 1;
      span.addEventListener("click", () => scrollToDetail(idx));
    } else if (severity === "warning") {
      span.className = "line-warning";
      findings.push({ lineIndex: i + 1, line, severity, pattern });
      const idx = findings.length - 1;
      span.addEventListener("click", () => scrollToDetail(idx));
    } else if (severity === "info") {
      span.className = "line-info";
    } else if (severity === "ok") {
      span.className = "line-ok";
    } else {
      span.className = "line-normal";
    }
    logDisplay.appendChild(span);
  });

  // Update stats
  const errCount  = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warning").length;
  state.totalRuns++;
  state.totalErrors += errCount;
  if (errCount === 0 && warnCount === 0) state.flawlessRuns++;
  saveState(state);

  // XP calculation
  // Base: 10 per run. Bonus: 5 per finding resolved (incentivise investigation).
  // Experienced mode gives 1.5× XP as a reward for taking the harder path.
  const base = 10 + findings.length * 5;
  const multiplier = currentMode === "experienced" ? 1.5 : 1;
  addXP(Math.round(base * multiplier));
  checkBadges();

  // Summary badge
  summaryBadge.classList.remove("hidden", "ok");
  if (errCount === 0 && warnCount === 0) {
    summaryBadge.textContent = "✅ No Issues";
    summaryBadge.classList.add("ok");
  } else {
    summaryBadge.textContent =
      `🔴 ${errCount} Error${errCount !== 1 ? "s" : ""}` +
      (warnCount > 0 ? `  ⚠️ ${warnCount} Warning${warnCount !== 1 ? "s" : ""}` : "");
  }

  // Build detail cards
  detailList.innerHTML = "";
  if (findings.length === 0) {
    detailList.innerHTML = `<p style="color:var(--muted);font-size:.88rem;">No errors or warnings detected.</p>`;
  } else {
    findings.forEach((f, idx) => detailList.appendChild(buildDetailCard(f, idx)));
  }

  outputSect.classList.remove("hidden");
  detailSect.classList.remove("hidden");
  outputSect.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ===== Detail Card =====
function buildDetailCard(finding, idx) {
  const { lineIndex, line, severity, pattern } = finding;
  const card = document.createElement("div");
  card.className = `detail-card severity-${severity}`;
  card.id = `detail-${idx}`;

  const sevLabel = severity === "error" ? "ERROR" : "WARNING";
  const truncated = line.trim().slice(0, 90) + (line.trim().length > 90 ? "…" : "");

  // Experienced mode: show hint only (short version)
  const bodyHTML = currentMode === "experienced"
    ? `<div class="detail-label">${escapeHtml(pattern.label)}</div>
       <p class="detail-hint-only">${escapeHtml(pattern.shortHint)}</p>`
    : `<div class="detail-label">${escapeHtml(pattern.label)}</div>
       <p class="detail-hint">${escapeHtml(pattern.hint)}</p>
       <div class="detail-manual">${escapeHtml(pattern.manual)}</div>`;

  card.innerHTML = `
    <div class="detail-header">
      <span class="severity-tag ${severity}">${sevLabel}</span>
      <span class="detail-code" title="${escapeHtml(line)}">Line ${lineIndex}: ${escapeHtml(truncated)}</span>
    </div>
    <div class="detail-body">${bodyHTML}</div>
  `;
  return card;
}

function scrollToDetail(idx) {
  const el = document.getElementById(`detail-${idx}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ===== Clear =====
clearBtn.addEventListener("click", () => {
  logInput.value = "";
  outputSect.classList.add("hidden");
  detailSect.classList.add("hidden");
  summaryBadge.classList.add("hidden");
  logDisplay.innerHTML = "";
  detailList.innerHTML = "";
  logInput.focus();
});

// ===== HTML escape =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===== Init =====
renderXPBar();
renderBadges();
