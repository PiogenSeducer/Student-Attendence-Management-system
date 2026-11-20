const STORAGE_KEY = "attendanceData";

// ---------- State ----------
let state = { className: "Class 12-A", students: [], records: {} };
// records looks like: { "2026-11-20": { studentId: "P" or "A" } }

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.students) && saved.records) state = saved;
  } catch (e) { /* start fresh if storage is empty or broken */ }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ---------- Helpers ----------
const $ = id => document.getElementById(id);

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

function getStats(student) {
  let present = 0, absent = 0;
  Object.values(state.records).forEach(day => {
    if (day[student.id] === "P") present++;
    if (day[student.id] === "A") absent++;
  });
  const total = present + absent;
  const percent = total ? (present / total) * 100 : null;
  return { present, absent, total, percent };
}

function getStatus(percent) {
  if (percent === null) return { label: "No data", cls: "none" };
  if (percent >= 75) return { label: "Good", cls: "good" };
  if (percent >= 50) return { label: "Warning", cls: "warn" };
  return { label: "Low", cls: "low" };
}

function nextRoll() {
  let n = state.students.length + 1;
  let roll;
  do {
    roll = "s" + String(n).padStart(3, "0");
    n++;
  } while (state.students.some(s => s.roll.toLowerCase() === roll));
  return roll;
}

// ---------- Rendering ----------
function renderHeader() {
  $("className").textContent = state.className;
  const count = state.students.length;
  $("studentCount").textContent = count + (count === 1 ? " Student" : " Students");
}

function renderStats() {
  const all = state.students.map(s => getStats(s).percent).filter(p => p !== null);
  const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  $("statTotal").textContent = state.students.length;
  $("statAvg").textContent = avg.toFixed(1) + "%";
  $("statGood").textContent = all.filter(p => p >= 75).length;
  $("statLow").textContent = all.filter(p => p < 75).length;
}

function renderMarkList() {
  const date = $("dateInput").value;
  const day = state.records[date] || {};
  const list = $("markList");

  if (!state.students.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = state.students.map(s => `
    <div class="mark-row">
      <div class="mark-info">
        <span class="roll">${escapeHtml(s.roll)}</span>
        <span class="student-name">${escapeHtml(s.name)}</span>
      </div>
      <div class="toggle">
        <button type="button" class="p ${day[s.id] === "P" ? "active" : ""}" data-id="${s.id}" data-mark="P" aria-pressed="${day[s.id] === "P"}">Present</button>
        <button type="button" class="a ${day[s.id] === "A" ? "active" : ""}" data-id="${s.id}" data-mark="A" aria-pressed="${day[s.id] === "A"}">Absent</button>
      </div>
    </div>
  `).join("");
}

function renderSummary() {
  const body = $("summaryBody");
  body.innerHTML = state.students.map(s => {
    const st = getStats(s);
    const status = getStatus(st.percent);
    const pctText = st.percent === null ? "–" : st.percent.toFixed(1) + "%";
    return `
      <tr>
        <td>${escapeHtml(s.roll)}</td>
        <td>${escapeHtml(s.name)}</td>
        <td class="num present">${st.present}</td>
        <td class="num absent">${st.absent}</td>
        <td class="num">${st.total}</td>
        <td class="num pct ${status.cls}">${pctText}</td>
        <td class="center"><span class="badge ${status.cls}">${status.label}</span></td>
        <td class="center"><button type="button" class="remove-btn" data-remove="${s.id}">Remove</button></td>
      </tr>`;
  }).join("");
  $("emptyState").hidden = state.students.length > 0;
}

function renderAll() {
  renderHeader();
  renderStats();
  renderMarkList();
  renderSummary();
}

// ---------- Actions ----------
function addStudent(event) {
  event.preventDefault();
  const name = $("nameInput").value.trim().replace(/\s+/g, " ");
  let roll = $("rollInput").value.trim();
  const error = $("addError");

  if (name.length < 2) { error.textContent = "Enter the student's name (at least 2 characters)."; return; }
  if (roll && state.students.some(s => s.roll.toLowerCase() === roll.toLowerCase())) {
    error.textContent = "That roll number is already used. Choose a different one."; return;
  }
  if (!roll) roll = nextRoll();

  error.textContent = "";
  state.students.push({ id: "id" + Date.now() + Math.floor(Math.random() * 1000), roll, name });
  save();
  $("addForm").reset();
  $("nameInput").focus();
  renderAll();
}

function setMark(id, mark) {
  const date = $("dateInput").value;
  if (!date) return;
  if (!state.records[date]) state.records[date] = {};
  if (state.records[date][id] === mark) {
    delete state.records[date][id];             // click again to clear
    if (!Object.keys(state.records[date]).length) delete state.records[date];
  } else {
    state.records[date][id] = mark;
  }
  save();
  renderAll();
}

function markAll(mark) {
  const date = $("dateInput").value;
  if (!date || !state.students.length) return;
  state.records[date] = {};
  state.students.forEach(s => { state.records[date][s.id] = mark; });
  save();
  renderAll();
}

function removeStudent(id) {
  const student = state.students.find(s => s.id === id);
  if (!student || !confirm("Remove " + student.name + " and all their attendance records?")) return;
  state.students = state.students.filter(s => s.id !== id);
  Object.keys(state.records).forEach(date => {
    delete state.records[date][id];
    if (!Object.keys(state.records[date]).length) delete state.records[date];
  });
  save();
  renderAll();
}

function editClass() {
  const name = prompt("Class name:", state.className);
  if (name && name.trim()) {
    state.className = name.trim().slice(0, 30);
    save();
    renderHeader();
  }
}

function loadSample() {
  const names = ["Aarav Sharma", "Sara Khan", "Rohan Verma", "Ayesha Ali", "Karan Singh", "Meera Nair"];
  state.students = names.map((name, i) => ({ id: "sample" + i, roll: "s00" + (i + 1), name }));
  state.records = {};
  const pattern = [
    ["P", "P", "P", "P", "P"],
    ["P", "P", "A", "P", "P"],
    ["P", "A", "A", "P", "A"],
    ["A", "P", "P", "A", "P"],
    ["P", "P", "P", "P", "A"],
    ["A", "A", "P", "A", "P"]
  ];
  for (let d = 0; d < 5; d++) {
    const date = new Date();
    date.setDate(date.getDate() - (4 - d));
    const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    state.records[key] = {};
    state.students.forEach((s, i) => { state.records[key][s.id] = pattern[i][d]; });
  }
  save();
  renderAll();
}

// ---------- Download report ----------
function downloadReport() {
  if (!state.students.length) { alert("Add at least one student before downloading a report."); return; }

  const rows = state.students.map(s => {
    const st = getStats(s);
    return {
      rollNo: s.roll,
      name: s.name,
      presentDays: st.present,
      absentDays: st.absent,
      totalDays: st.total,
      attendancePercent: st.percent === null ? "" : st.percent.toFixed(1),
      status: getStatus(st.percent).label
    };
  });

  let content, type, ext;
  if ($("format").value === "json") {
    content = JSON.stringify({ className: state.className, students: rows }, null, 2);
    type = "application/json"; ext = "json";
  } else {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const header = ["Roll No", "Student Name", "Present Days", "Absent Days", "Total Days", "Attendance %", "Status"];
    content = [header.map(q).join(",")]
      .concat(rows.map(r => Object.values(r).map(q).join(",")))
      .join("\n");
    type = "text/csv"; ext = "csv";
  }

  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "attendance-report." + ext;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ---------- Events ----------
$("addForm").addEventListener("submit", addStudent);
$("dateInput").addEventListener("change", renderMarkList);
$("allPresent").addEventListener("click", () => markAll("P"));
$("allAbsent").addEventListener("click", () => markAll("A"));
$("editClass").addEventListener("click", editClass);
$("download").addEventListener("click", downloadReport);
$("loadSample").addEventListener("click", loadSample);

$("markList").addEventListener("click", e => {
  const btn = e.target.closest("button[data-mark]");
  if (btn) setMark(btn.dataset.id, btn.dataset.mark);
});
$("summaryBody").addEventListener("click", e => {
  const btn = e.target.closest("button[data-remove]");
  if (btn) removeStudent(btn.dataset.remove);
});

// ---------- Start ----------
load();
$("dateInput").value = todayString();
renderAll();
