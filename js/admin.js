import { adminApi, formatPrice, formatTime } from "./api.js";
import { getUser, isAdmin, logout } from "./auth.js";

const nav = [
  ["dashboard", "Dashboard"], ["programs", "Programs"], ["semesters", "Semesters"],
  ["schedules", "Schedules"], ["sessions", "Sessions"], ["enrollments", "Enrollments"], ["students", "Students"],
];
const app = document.querySelector("#admin-app");
const esc = (v = "") => String(v).replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));
const date = (v) => v ? new Date(v).toLocaleDateString() : "-";
const query = () => location.hash.slice(1) || "dashboard";
const button = (label, action = "", cls = "btn btn-sm") => `<button class="${cls}" data-action="${action}">${label}</button>`;

function guard() {
  if (!isAdmin()) { location.href = `login.html?next=${encodeURIComponent("admin.html")}`; return false; }
  return true;
}
function renderNav() { document.querySelector("#admin-nav").innerHTML = nav.map(([id, label]) => `<a href="#${id}" class="${query() === id ? "active" : ""}">${label}</a>`).join(""); }
function table(headers, rows) { return `<div class="admin-table-wrapper"><table class="admin-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="muted">No records found.</td></tr>`}</tbody></table></div>`; }
function form(fields, values = {}, title = "Edit record") { return `<form id="record-form" class="admin-form"><h3>${title}</h3>${fields.map(([key, label, type = "text", extra = ""]) => `<label>${label}<${type === "textarea" ? "textarea" : "input"} name="${key}" type="${type}" value="${esc(values[key] ?? "")}" ${extra}>${type === "textarea" ? esc(values[key] ?? "") : ""}</${type === "textarea" ? "textarea" : "input"}></label>`).join("")}<div class="form-actions"><button class="btn btn-sm">Save</button>${button("Cancel", "cancel-form", "btn btn-sm btn-secondary")}</div></form>`; }

async function dashboard() {
  const [programs, schedules, enrollments] = await Promise.all([adminApi("programs?select=id"), adminApi("class_schedules?select=id"), adminApi("enrollments?select=id")]);
  app.innerHTML = `<h1>Dashboard</h1><div class="stat-grid">${[[programs.length,"Programs","programs"],[schedules.length,"Class Schedules","schedules"],[enrollments.length,"Enrollments","enrollments"]].map(([n,l,id]) => `<a href="#${id}" class="stat-card"><span class="stat-number">${n}</span><span class="stat-label">${l}</span></a>`).join("")}</div><section class="dashboard-quick-links"><h2>Quick Actions</h2><div class="quick-link-grid"><a class="quick-link" href="#schedules"><h3>Manage Schedules →</h3><p>Add class times, prices, and capacity.</p></a><a class="quick-link" href="#programs"><h3>Manage Programs →</h3><p>Create or update art program types.</p></a><a class="quick-link" href="#enrollments"><h3>View Enrollments →</h3><p>Review students and payment status.</p></a></div></section>`;
}
const configs = {
  programs: { title: "Programs", endpoint: "programs?order=sort_order.asc", fields: [["name","Name"],["slug","Slug"],["description","Description","textarea"],["image_url","Image URL"],["sort_order","Sort Order","number"],["num_classes","Number of Classes","number"],["early_bird_discount_pct","Early-Bird Discount %","number"],["early_bird_deadline","Early-Bird Deadline","date"]], cols: ["name","num_classes","active"], labels: ["Name","Classes","Active"] },
  semesters: { title: "Semesters", endpoint: "semesters?order=start_date.desc", fields: [["name","Name"],["start_date","Start Date","date"],["end_date","End Date","date"]], cols: ["name","start_date","end_date","active"], labels: ["Name","Start","End","Active"] },
  schedules: { title: "Class Schedules", endpoint: "class_schedules?order=created_at.desc", fields: [], cols: ["program_id","semester_id","day_of_week","session_type","start_time","age_group","price_cents","max_seats","active"], labels: ["Program","Semester","Day","Session","Start","Age","Price","Seats","Active"] },
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SESSION_TYPES = {
  standard: { label: "Standard Session", minutes: 60 },
  extended: { label: "Extended Session", minutes: 90 },
  full: { label: "Full Session", minutes: 120 },
};
const HOURLY_RATE = 35;

function sessionTypeFor(values) {
  if (SESSION_TYPES[values.session_type]) return values.session_type;
  if (!values.start_time || !values.end_time) return "standard";
  const [startHours, startMinutes] = values.start_time.split(":").map(Number);
  const [endHours, endMinutes] = values.end_time.split(":").map(Number);
  const duration = ((endHours * 60 + endMinutes) - (startHours * 60 + startMinutes) + 1440) % 1440;
  return Object.entries(SESSION_TYPES).find(([, type]) => type.minutes === duration)?.[0] || "standard";
}

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const result = (hours * 60 + mins + minutes) % 1440;
  return `${String(Math.floor(result / 60)).padStart(2, "0")}:${String(result % 60).padStart(2, "0")}`;
}

function scheduleForm(values, programs, semesters, title, isEditing = false) {
  const selectedDays = isEditing ? (values.days || [values.day_of_week]) : [];
  const sessionType = sessionTypeFor(values);
  const priceDollars = values.price_cents != null ? (values.price_cents / 100).toFixed(2) : (SESSION_TYPES[sessionType].minutes / 60 * HOURLY_RATE).toFixed(2);
  return `<form id="record-form" class="admin-form">
    <h3>${title}</h3>
    <label>Program<select name="program_id" required><option value="">Select a program</option>${programs.map((p) => `<option value="${esc(p.id)}" ${p.id === values.program_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label>Semester<select name="semester_id" required><option value="">Select a semester</option>${semesters.map((s) => `<option value="${esc(s.id)}" ${s.id === values.semester_id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
    <fieldset class="day-picker"><legend>${isEditing ? "Day of week" : "Days of week"}</legend><p class="hint">${isEditing ? "Editing changes this schedule's day." : "A separate schedule will be created for each selected day."}</p><div>${DAYS.map((day) => `<label><input type="checkbox" name="days" value="${day}" ${selectedDays.includes(day) ? "checked" : ""}> ${day}</label>`).join("")}</div></fieldset>
    <label>Session type<select name="session_type" id="session-type" required>${Object.entries(SESSION_TYPES).map(([key, type]) => `<option value="${key}" ${key === sessionType ? "selected" : ""}>${type.label}</option>`).join("")}</select></label>
    <div class="form-row"><label>Start time<input name="start_time" id="start-time" type="time" required value="${esc(values.start_time || "10:00")}"></label><label>End time<input name="end_time" id="end-time" type="time" required readonly value="${esc(values.end_time || addMinutes(values.start_time || "10:00", SESSION_TYPES[sessionType].minutes))}"></label></div>
    <div class="form-row"><label>Age group<input name="age_group" required value="${esc(values.age_group || "")}" placeholder="e.g. Ages 6-10"></label><label>Max seats<input name="max_seats" type="number" min="1" required value="${esc(values.max_seats || 8)}"></label></div>
    <div class="form-row"><label>Price per class ($)<input name="price_dollars" id="price-dollars" type="number" min="0" step="0.01" required value="${esc(priceDollars)}"><span class="hint">Calculated at $35/hour. You can adjust it if needed.</span></label><label>Early-bird discount %<input name="early_bird_discount_pct" type="number" min="0" max="100" value="${esc(values.early_bird_discount_pct || 0)}"></label></div>
    <label>Early-bird deadline<input name="early_bird_deadline" type="date" value="${esc(values.early_bird_deadline ? values.early_bird_deadline.slice(0, 10) : "")}"></label>
    <label>Notes<textarea name="notes">${esc(values.notes || "")}</textarea></label>
    <div class="form-actions"><button class="btn btn-sm">${isEditing ? "Update" : "Create schedules"}</button>${button("Cancel", "cancel-form", "btn btn-sm btn-secondary")}</div>
  </form>`;
}

async function crud(id) {
  const c = configs[id];
  const [items, programs, semesters] = await Promise.all([
    adminApi(c.endpoint),
    id === "schedules" ? adminApi("programs?order=sort_order.asc") : Promise.resolve([]),
    id === "schedules" ? adminApi("semesters?order=start_date.desc") : Promise.resolve([]),
  ]);
  const displayValue = (item, key) => {
    if (id === "schedules" && key === "program_id") return programs.find((p) => p.id === item.program_id)?.name || "-";
    if (id === "schedules" && key === "semester_id") return semesters.find((s) => s.id === item.semester_id)?.name || "-";
    if (id === "schedules" && key === "session_type") return SESSION_TYPES[sessionTypeFor(item)].label;
    if (key.includes("date")) return date(item[key]);
    if (key === "price_cents") return formatPrice(item[key]);
    return item[key] ?? (key === "active" ? "✓" : "-");
  };
  const dayOrder = Object.fromEntries(DAYS.map((day, index) => [day, index]));
  const scheduleGroups = id === "schedules" ? Object.values(items.reduce((groups, item) => {
    const key = JSON.stringify([item.program_id, item.semester_id, item.session_type || sessionTypeFor(item), item.start_time, item.end_time, item.age_group, item.price_cents, item.max_seats, item.early_bird_discount_pct, item.early_bird_deadline, item.notes, item.active]);
    if (!groups[key]) groups[key] = { item, members: [] };
    groups[key].members.push(item);
    return groups;
  }, {})).map((group) => ({ ...group, days: group.members.map((item) => item.day_of_week).sort((a, b) => dayOrder[a] - dayOrder[b]) })) : [];
  const tableRows = id === "schedules"
    ? scheduleGroups.map((group) => `<tr>${c.cols.map((key) => `<td>${esc(key === "day_of_week" ? group.days.join(", ") : displayValue(group.item, key))}</td>`).join("")}<td>${button("Edit", `edit-group:${group.members.map((item) => item.id).join(",")}`)} ${button("Delete", `delete-group:${group.members.map((item) => item.id).join(",")}`, "btn btn-sm btn-danger")}</td></tr>`).join("")
    : items.map((item) => `<tr>${c.cols.map((key) => `<td>${esc(displayValue(item, key))}</td>`).join("")}<td>${button("Edit", `edit:${item.id}`)} ${button("Delete", `delete:${item.id}`, "btn btn-sm btn-danger")}</td></tr>`).join("");
  app.innerHTML = `<div class="admin-crud-header"><h1>${c.title}</h1>${button(`+ New ${c.title.slice(0,-1)}`, "new-record")}</div><div id="form-slot"></div>${table(c.labels.concat("Actions"), tableRows)}`;
  app.addEventListener("click", crudActions, { once: true });
  async function crudActions(e) {
    const action = e.target.dataset.action || "";
    if (action === "new-record") {
      document.querySelector("#form-slot").innerHTML = id === "schedules" ? scheduleForm({}, programs, semesters, "New Class Schedules") : form(c.fields, {}, `New ${c.title.slice(0,-1)}`);
      bindForm();
    } else if (action.startsWith("edit-group:")) {
      const ids = action.slice("edit-group:".length).split(",");
      const group = scheduleGroups.find((candidate) => candidate.members.every((item) => ids.includes(item.id)) && candidate.members.length === ids.length);
      document.querySelector("#form-slot").innerHTML = scheduleForm({ ...group.item, days: group.days }, programs, semesters, "Edit Class Schedules", true);
      bindForm(group.members);
    } else if (action.startsWith("edit:")) {
      const item = items.find((x) => String(x.id) === action.slice(5));
      document.querySelector("#form-slot").innerHTML = id === "schedules" ? scheduleForm(item, programs, semesters, "Edit Class Schedule", true) : form(c.fields, item, `Edit ${c.title.slice(0,-1)}`);
      bindForm(item.id);
    } else if (action.startsWith("delete-group:") && confirm("Delete these class schedules?")) {
      const ids = action.slice("delete-group:".length).split(",");
      await Promise.all(ids.map((scheduleId) => adminApi(`class_schedules/${scheduleId}`, { method: "DELETE" })));
      render();
    } else if (action.startsWith("delete:") && confirm(`Delete this ${c.title.slice(0,-1).toLowerCase()}?`)) {
      await adminApi(`${id === "schedules" ? "class_schedules" : id}/${action.slice(7)}`, { method: "DELETE" });
      render();
    }
  }
  function bindForm(editId) {
    if (id === "schedules") {
      const sessionType = document.querySelector("#session-type");
      const startTime = document.querySelector("#start-time");
      const endTime = document.querySelector("#end-time");
      const priceDollars = document.querySelector("#price-dollars");
      const updateSessionDetails = () => {
        const type = SESSION_TYPES[sessionType.value];
        endTime.value = addMinutes(startTime.value, type.minutes);
        priceDollars.value = (type.minutes / 60 * HOURLY_RATE).toFixed(2);
      };
      sessionType.addEventListener("change", updateSessionDetails);
      startTime.addEventListener("change", updateSessionDetails);
    }
    document.querySelector("#record-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const body = Object.fromEntries(data);
      ["sort_order", "num_classes", "early_bird_discount_pct", "price_cents", "max_seats"].forEach((k) => { if (k in body) body[k] = Number(body[k]) || 0; });
      body.active = true;
      if (id === "schedules") {
        const days = data.getAll("days");
        if (!days.length) { alert("Select at least one day of the week."); return; }
        delete body.days;
        body.price_cents = Math.round(Number(body.price_dollars) * 100);
        delete body.price_dollars;
        body.early_bird_deadline = body.early_bird_deadline || null;
        const existingSchedules = Array.isArray(editId) ? editId : [];
        if (existingSchedules.length) {
          const existingByDay = new Map(existingSchedules.map((schedule) => [schedule.day_of_week, schedule]));
          const selectedDays = new Set(days);
          await Promise.all([
            ...existingSchedules.filter((schedule) => !selectedDays.has(schedule.day_of_week)).map((schedule) => adminApi(`class_schedules/${schedule.id}`, { method: "DELETE" })),
            ...days.map((day_of_week) => {
              const existing = existingByDay.get(day_of_week);
              return existing
                ? adminApi(`class_schedules/${existing.id}`, { method: "PATCH", body: { ...body, day_of_week } })
                : adminApi("class_schedules", { method: "POST", body: { ...body, day_of_week } });
            }),
          ]);
        } else {
          await Promise.all(days.map((day_of_week) => adminApi("class_schedules", { method: "POST", body: { ...body, day_of_week } })));
        }
      } else {
        await adminApi(`${id}${editId ? `/${editId}` : ""}`, { method: editId ? "PATCH" : "POST", body });
      }
      render();
    });
  }
}
async function enrollments() { const items = await adminApi("enrollments?order=created_at.desc"); app.innerHTML = `<div class="admin-crud-header"><h1>Enrollments</h1></div>${table(["Student","Email","Status","Date","Actions"], items.map((e) => `<tr><td>${esc(e.student_name)}</td><td>${esc(e.student_email)}</td><td><span class="status-badge status-${e.status}">${esc(e.status)}</span></td><td>${date(e.created_at)}</td><td>${e.status === "pending" ? button("Confirm", `confirm:${e.id}`) : ""} ${["pending","confirmed"].includes(e.status) ? button("Cancel", `cancel:${e.id}`, "btn btn-sm btn-danger") : ""}</td></tr>`).join(""))}`; app.addEventListener("click", async (e) => { const a = e.target.dataset.action || ""; if (a.startsWith("confirm:") || a.startsWith("cancel:")) { await adminApi(`enrollments/${a.slice(8)}`, { method: "PATCH", body: { status: a.startsWith("confirm:") ? "confirmed" : "cancelled" } }); render(); } }, { once: true }); }
async function students() { const items = await adminApi("enrollments?order=created_at.desc"); const map = new Map(); items.forEach((e) => { const key = e.student_email || e.student_name; const s = map.get(key) || { name: e.student_name, email: e.student_email, phone: e.student_phone, total: 0, confirmed: 0, pending: 0, last: e.created_at }; s.total++; if (e.status === "confirmed") s.confirmed++; if (e.status === "pending") s.pending++; map.set(key, s); }); app.innerHTML = `<h1>Students</h1>${table(["Name","Email","Phone","Total","Confirmed","Pending","Last Active"], [...map.values()].map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone || "-")}</td><td>${s.total}</td><td>${s.confirmed}</td><td>${s.pending}</td><td>${date(s.last)}</td></tr>`).join(""))}`; }
async function sessions() {
  const [items, schedules, programs] = await Promise.all([adminApi("class_sessions?order=class_date.asc&limit=200"), adminApi("class_schedules"), adminApi("programs")]);
  const name = (id) => {
    const schedule = schedules.find((item) => item.id === id);
    const program = schedule && programs.find((item) => item.id === schedule.program_id);
    return program ? `${program.name} - ${schedule.day_of_week} ${formatTime(schedule.start_time)}` : "-";
  };
  app.innerHTML = `<div class="admin-crud-header"><h1>Class Sessions</h1></div>${table(["Program / Schedule", "Date", "Status", "Actions"], items.map((session) => `<tr><td>${esc(name(session.schedule_id))}</td><td>${date(session.class_date)}</td><td><span class="status-badge status-${session.status === "scheduled" ? "confirmed" : "cancelled"}">${esc(session.status)}</span></td><td>${button("Attendance", `attendance:${session.id}`)}</td></tr>`).join(""))}`;
  app.addEventListener("click", (event) => {
    const action = event.target.dataset.action || "";
    if (action.startsWith("attendance:")) attendance(action.slice("attendance:".length));
  }, { once: true });
}

async function attendance(sessionId) {
  const [sessionRows, bookings] = await Promise.all([
    adminApi(`class_sessions?id=eq.${sessionId}`),
    adminApi(`bookings?session_id=eq.${sessionId}&order=booked_at.asc`),
  ]);
  const session = sessionRows[0];
  if (!session) throw new Error("Session not found.");
  const [scheduleRows, enrollmentResults] = await Promise.all([
    adminApi(`class_schedules?id=eq.${session.schedule_id}`),
    Promise.all([...new Set(bookings.map((booking) => booking.enrollment_id))].map((id) => adminApi(`enrollments?id=eq.${id}`))),
  ]);
  const schedule = scheduleRows[0];
  const programRows = schedule ? await adminApi(`programs?id=eq.${schedule.program_id}`) : [];
  const enrollments = enrollmentResults.flat();
  const enrollmentFor = (id) => enrollments.find((enrollment) => enrollment.id === id);
  const activeBookings = bookings.filter((booking) => ["scheduled", "attended", "no_show"].includes(booking.status));
  const attendanceRows = activeBookings.map((booking) => {
    const enrollment = enrollmentFor(booking.enrollment_id);
    const label = booking.status === "scheduled" ? "Pending" : booking.status === "attended" ? "Attended" : "No-show";
    const statusClass = booking.status === "scheduled" ? "pending" : booking.status === "attended" ? "confirmed" : "cancelled";
    return `<tr><td>${esc(enrollment?.student_name || "-")}</td><td>${esc(enrollment?.student_email || "-")}${enrollment?.student_phone ? `<br>${esc(enrollment.student_phone)}` : ""}</td><td>${esc(booking.type === "home" ? "Home" : "Make-up")}</td><td><span class="status-badge status-${statusClass}">${label}</span></td><td>${button("✓ Attended", `mark:${booking.id}:attended`)} ${button("✗ No-show", `mark:${booking.id}:no_show`, "btn btn-sm btn-danger")}</td></tr>`;
  }).join("");
  const skipped = bookings.filter((booking) => ["skipped", "cancelled"].includes(booking.status));
  app.innerHTML = `<div class="admin-crud-header"><h1>Attendance Sheet</h1>${button("← Back to Sessions", "back-to-sessions")}</div><section class="attendance-session-info"><h3>${esc(programRows[0]?.name || "Class session")}</h3><p class="muted">${esc(schedule ? `${schedule.day_of_week} ${formatTime(schedule.start_time)}-${formatTime(schedule.end_time)} · ${schedule.age_group}` : "")}</p><p class="muted">${date(session.class_date)}</p></section>${activeBookings.length ? table(["Student", "Contact", "Type", "Status", "Actions"], attendanceRows) : `<div class="empty-state"><p>No students booked for this session.</p></div>`}${skipped.length ? `<section class="attendance-section-muted"><h3>Skipped / Cancelled</h3>${table(["Student", "Type", "Status"], skipped.map((booking) => `<tr><td>${esc(enrollmentFor(booking.enrollment_id)?.student_name || "-")}</td><td>${esc(booking.type)}</td><td><span class="status-badge status-cancelled">${esc(booking.status)}</span></td></tr>`).join(""))}</section>` : ""}`;
  app.addEventListener("click", async (event) => {
    const action = event.target.dataset.action || "";
    if (action === "back-to-sessions") { await sessions(); return; }
    if (!action.startsWith("mark:")) return;
    const [, bookingId, status] = action.split(":");
    event.target.disabled = true;
    try {
      await adminApi("fn/mark-attendance", { method: "POST", body: { booking_id: bookingId, status } });
      await attendance(sessionId);
    } catch (error) {
      event.target.disabled = false;
      alert(error.message || "Could not update attendance.");
    }
  }, { once: true });
}
async function render() { if (!guard()) return; renderNav(); try { const id = query(); if (id === "dashboard") await dashboard(); else if (configs[id]) await crud(id); else if (id === "enrollments") await enrollments(); else if (id === "students") await students(); else if (id === "sessions") await sessions(); else app.innerHTML = `<h1>${id[0].toUpperCase() + id.slice(1)}</h1><p class="muted">Section unavailable.</p>`; } catch (err) { app.innerHTML = `<p class="auth-error">${esc(err.message)}</p>`; } }
window.addEventListener("hashchange", render); document.querySelector("#admin-logout").addEventListener("click", async () => { await logout(); location.href = "index.html"; }); render();
