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
  programs: { title: "Programs", endpoint: "programs?order=sort_order.asc", fields: [["name","Name"],["slug","Slug"],["description","Description","textarea"],["image_url","Image URL"],["sort_order","Sort Order","number"],["num_classes","Number of Classes","number"],["session_type","Session Type"],["early_bird_discount_pct","Early-Bird Discount %","number"],["early_bird_deadline","Early-Bird Deadline","date"]], cols: ["name","num_classes","session_type","active"], labels: ["Name","Classes","Session","Active"] },
  semesters: { title: "Semesters", endpoint: "semesters?order=start_date.desc", fields: [["name","Name"],["start_date","Start Date","date"],["end_date","End Date","date"]], cols: ["name","start_date","end_date","active"], labels: ["Name","Start","End","Active"] },
  schedules: { title: "Class Schedules", endpoint: "class_schedules?order=created_at.desc", fields: [["program_id","Program ID"],["semester_id","Semester ID"],["day_of_week","Day of Week"],["start_time","Start Time","time"],["end_time","End Time","time"],["age_group","Age Group"],["price_cents","Price (cents)","number"],["max_seats","Max Seats","number"],["notes","Notes","textarea"]], cols: ["program_id","semester_id","day_of_week","start_time","age_group","price_cents","max_seats","active"], labels: ["Program","Semester","Day","Start","Age","Price","Seats","Active"] },
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function scheduleForm(values, programs, semesters, title, isEditing = false) {
  const selectedDays = isEditing ? [values.day_of_week] : [];
  return `<form id="record-form" class="admin-form">
    <h3>${title}</h3>
    <label>Program<select name="program_id" required><option value="">Select a program</option>${programs.map((p) => `<option value="${esc(p.id)}" ${p.id === values.program_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label>Semester<select name="semester_id" required><option value="">Select a semester</option>${semesters.map((s) => `<option value="${esc(s.id)}" ${s.id === values.semester_id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
    <fieldset class="day-picker"><legend>${isEditing ? "Day of week" : "Days of week"}</legend><p class="hint">${isEditing ? "Editing changes this schedule's day." : "A separate schedule will be created for each selected day."}</p><div>${DAYS.map((day) => `<label><input type="checkbox" name="days" value="${day}" ${selectedDays.includes(day) ? "checked" : ""}> ${day}</label>`).join("")}</div></fieldset>
    <div class="form-row"><label>Start time<input name="start_time" type="time" required value="${esc(values.start_time || "10:00")}"></label><label>End time<input name="end_time" type="time" required value="${esc(values.end_time || "11:30")}"></label></div>
    <div class="form-row"><label>Age group<input name="age_group" required value="${esc(values.age_group || "")}" placeholder="e.g. Ages 6-10"></label><label>Max seats<input name="max_seats" type="number" min="1" required value="${esc(values.max_seats || 8)}"></label></div>
    <div class="form-row"><label>Price per class (cents)<input name="price_cents" type="number" min="0" required value="${esc(values.price_cents || 35000)}"></label><label>Early-bird discount %<input name="early_bird_discount_pct" type="number" min="0" max="100" value="${esc(values.early_bird_discount_pct || 0)}"></label></div>
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
  app.innerHTML = `<div class="admin-crud-header"><h1>${c.title}</h1>${button(`+ New ${c.title.slice(0,-1)}`, "new-record")}</div><div id="form-slot"></div>${table(c.labels.concat("Actions"), items.map((item) => `<tr>${c.cols.map((key) => `<td>${key.includes("date") ? date(item[key]) : key === "price_cents" ? formatPrice(item[key]) : esc(item[key] ?? (key === "active" ? "✓" : "-"))}</td>`).join("")}<td>${button("Edit", `edit:${item.id}`)} ${button("Delete", `delete:${item.id}`, "btn btn-sm btn-danger")}</td></tr>`).join(""))}`;
  app.addEventListener("click", crudActions, { once: true });
  async function crudActions(e) {
    const action = e.target.dataset.action || "";
    if (action === "new-record") {
      document.querySelector("#form-slot").innerHTML = id === "schedules" ? scheduleForm({}, programs, semesters, "New Class Schedules") : form(c.fields, {}, `New ${c.title.slice(0,-1)}`);
      bindForm();
    } else if (action.startsWith("edit:")) {
      const item = items.find((x) => String(x.id) === action.slice(5));
      document.querySelector("#form-slot").innerHTML = id === "schedules" ? scheduleForm(item, programs, semesters, "Edit Class Schedule", true) : form(c.fields, item, `Edit ${c.title.slice(0,-1)}`);
      bindForm(item.id);
    } else if (action.startsWith("delete:") && confirm(`Delete this ${c.title.slice(0,-1).toLowerCase()}?`)) {
      await adminApi(`${id === "schedules" ? "class_schedules" : id}/${action.slice(7)}`, { method: "DELETE" });
      render();
    }
  }
  function bindForm(editId) {
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
        body.early_bird_deadline = body.early_bird_deadline || null;
        if (editId) await adminApi(`class_schedules/${editId}`, { method: "PATCH", body: { ...body, day_of_week: days[0] } });
        else await Promise.all(days.map((day_of_week) => adminApi("class_schedules", { method: "POST", body: { ...body, day_of_week } })));
      } else {
        await adminApi(`${id}${editId ? `/${editId}` : ""}`, { method: editId ? "PATCH" : "POST", body });
      }
      render();
    });
  }
}
async function enrollments() { const items = await adminApi("enrollments?order=created_at.desc"); app.innerHTML = `<div class="admin-crud-header"><h1>Enrollments</h1></div>${table(["Student","Email","Status","Date","Actions"], items.map((e) => `<tr><td>${esc(e.student_name)}</td><td>${esc(e.student_email)}</td><td><span class="status-badge status-${e.status}">${esc(e.status)}</span></td><td>${date(e.created_at)}</td><td>${e.status === "pending" ? button("Confirm", `confirm:${e.id}`) : ""} ${["pending","confirmed"].includes(e.status) ? button("Cancel", `cancel:${e.id}`, "btn btn-sm btn-danger") : ""}</td></tr>`).join(""))}`; app.addEventListener("click", async (e) => { const a = e.target.dataset.action || ""; if (a.startsWith("confirm:") || a.startsWith("cancel:")) { await adminApi(`enrollments/${a.slice(8)}`, { method: "PATCH", body: { status: a.startsWith("confirm:") ? "confirmed" : "cancelled" } }); render(); } }, { once: true }); }
async function students() { const items = await adminApi("enrollments?order=created_at.desc"); const map = new Map(); items.forEach((e) => { const key = e.student_email || e.student_name; const s = map.get(key) || { name: e.student_name, email: e.student_email, phone: e.student_phone, total: 0, confirmed: 0, pending: 0, last: e.created_at }; s.total++; if (e.status === "confirmed") s.confirmed++; if (e.status === "pending") s.pending++; map.set(key, s); }); app.innerHTML = `<h1>Students</h1>${table(["Name","Email","Phone","Total","Confirmed","Pending","Last Active"], [...map.values()].map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone || "-")}</td><td>${s.total}</td><td>${s.confirmed}</td><td>${s.pending}</td><td>${date(s.last)}</td></tr>`).join(""))}`; }
async function sessions() { const [items, schedules, programs] = await Promise.all([adminApi("class_sessions?order=class_date.asc&limit=200"), adminApi("class_schedules"), adminApi("programs")]); const name = (id) => { const s = schedules.find((x) => x.id === id); const p = s && programs.find((x) => x.id === s.program_id); return p ? `${p.name} - ${s.day_of_week} ${formatTime(s.start_time)}` : "-"; }; app.innerHTML = `<div class="admin-crud-header"><h1>Class Sessions</h1></div>${table(["Program / Schedule","Date","Status","Actions"], items.map((s) => `<tr><td>${esc(name(s.schedule_id))}</td><td>${date(s.class_date)}</td><td><span class="status-badge status-${s.status === "scheduled" ? "confirmed" : "cancelled"}">${esc(s.status)}</span></td><td>${button("Attendance", `attendance:${s.id}`)}</td></tr>`).join(""))}`; }
async function render() { if (!guard()) return; renderNav(); try { const id = query(); if (id === "dashboard") await dashboard(); else if (configs[id]) await crud(id); else if (id === "enrollments") await enrollments(); else if (id === "students") await students(); else if (id === "sessions") await sessions(); else app.innerHTML = `<h1>${id[0].toUpperCase() + id.slice(1)}</h1><p class="muted">Section unavailable.</p>`; } catch (err) { app.innerHTML = `<p class="auth-error">${esc(err.message)}</p>`; } }
window.addEventListener("hashchange", render); document.querySelector("#admin-logout").addEventListener("click", async () => { await logout(); location.href = "index.html"; }); render();
