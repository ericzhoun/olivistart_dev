// Weekly class schedule — calendar grid view.
// Ported from herfield app/art-class/CalendarView.js, compiled to vanilla JS.
import { apiGet, formatPrice, formatTime } from "./api.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };

// Color palette per program (cycles through accent-themed colors)
const PROGRAM_COLORS = [
  { bg: "#f0e6d3", border: "#9f752c", text: "#7a5a1f" }, // gold
  { bg: "#dfe8da", border: "#5a8a4a", text: "#3d6b2e" }, // sage green
  { bg: "#e8d9d9", border: "#a05050", text: "#7a3838" }, // muted red
  { bg: "#d9e2e8", border: "#4a6a8a", text: "#2e4d6b" }, // dusty blue
  { bg: "#ece0e8", border: "#8a5a78", text: "#6b3a58" }, // muted purple
  { bg: "#e8e0d2", border: "#8a7a4a", text: "#6b5e2e" }, // olive
  { bg: "#dae8e5", border: "#4a8a82", text: "#2e6b65" }, // teal
];

function getColorForProgram(programId, programList) {
  const idx = programList.findIndex((p) => p.id === programId);
  return PROGRAM_COLORS[idx % PROGRAM_COLORS.length] || PROGRAM_COLORS[0];
}

export function schedulesBySlot(schedules) {
  return schedules.reduce((slots, schedule) => {
    const key = `${schedule.day_of_week}|${schedule.start_time}`;
    (slots[key] ||= []).push(schedule);
    return slots;
  }, {});
}

// Format the age group label, e.g. "7-12" -> "Age 7-12".
// Values that already include a label (e.g. "Age 7-12", "Teens") are returned unchanged.
function formatAgeGroup(ageGroup) {
  if (!ageGroup) return "";
  const trimmed = ageGroup.trim();
  if (/^\d+[-–]\d+$/.test(trimmed)) {
    return `Age ${trimmed}`;
  }
  return trimmed;
}

const state = {
  semesters: [],
  programs: [],
  schedules: [],
  selectedSemester: null,
  loading: true,
  error: "",
};

const root = document.getElementById("calendar-root");

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html != null) e.innerHTML = html;
  return e;
}

function render() {
  root.innerHTML = "";

  // Semester tabs
  if (state.semesters.length > 0) {
    const tabs = el("div", "calendar-semester-tabs");
    state.semesters.forEach((s) => {
      const btn = el("button",
        `semester-tab ${state.selectedSemester === s.id ? "active" : ""}`, s.name);
      btn.type = "button";
      btn.onclick = () => changeSemester(s.id);
      tabs.appendChild(btn);
    });
    root.appendChild(tabs);
  }

  if (state.loading) {
    root.appendChild(el("p", "muted", "Loading calendar…"));
    return;
  }

  if (state.error) {
    const error = el("div", "calendar-load-error");
    error.appendChild(el("p", "auth-error", "Unable to load the schedule. Please try again."));
    const retry = el("button", "btn", "Try again");
    retry.type = "button";
    retry.addEventListener("click", retryScheduleLoad);
    error.appendChild(retry);
    root.appendChild(error);
    return;
  }

  const activeSemester = state.semesters.find((s) => s.id === state.selectedSemester);
  if (activeSemester) {
    const p = el("p", "calendar-semester", activeSemester.name);
    if (activeSemester.start_date && activeSemester.end_date) {
      const fmt = (d) => new Date(d).toLocaleDateString();
      const span = el("span", "muted",
        ` (${fmt(activeSemester.start_date)} – ${fmt(activeSemester.end_date)})`);
      p.appendChild(span);
    }
    root.appendChild(p);
  }

  if (state.schedules.length === 0) {
    const empty = el("div", "empty-state");
    empty.appendChild(el("p", "", "No classes scheduled for this semester. Please check back soon!"));
    const cta = el("a", "btn", "Contact Olivia");
    cta.href = "contact.html";
    empty.appendChild(cta);
    root.appendChild(empty);
    return;
  }

  // Legend
  const legend = el("div", "calendar-legend");
  state.programs.forEach((p) => {
    const color = getColorForProgram(p.id, state.programs);
    const item = el("span", "legend-item");
    const dot = el("span", "legend-dot");
    dot.style.background = color.bg;
    dot.style.borderColor = color.border;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(p.name));
    legend.appendChild(item);
  });
  root.appendChild(legend);

  // ---- Desktop weekly grid ----
  const byDay = {};
  DAYS.forEach((d) => (byDay[d] = []));
  state.schedules.forEach((s) => { if (byDay[s.day_of_week]) byDay[s.day_of_week].push(s); });

  const allTimes = [...new Set(state.schedules.map((s) => s.start_time))].sort();
  const slotMap = schedulesBySlot(state.schedules);

  const wrapper = el("div", "calendar-grid-wrapper");
  const grid = el("div", "calendar-grid");

  grid.appendChild(el("div", "calendar-cell calendar-corner", "Time"));
  DAYS.forEach((day) => {
    grid.appendChild(el("div", "calendar-cell calendar-day-header", DAY_SHORT[day]));
  });

  allTimes.forEach((time) => {
    grid.appendChild(el("div", "calendar-cell calendar-time-label", formatTime(time)));
    DAYS.forEach((day) => {
      const schedules = slotMap[`${day}|${time}`] || [];
      if (schedules.length === 0) {
        grid.appendChild(el("div", "calendar-cell calendar-empty"));
        return;
      }
      const cell = el("div", "calendar-cell calendar-class-cell");
      schedules.forEach((sched) => {
        const prog = state.programs.find((p) => p.id === sched.program_id);
        const color = getColorForProgram(sched.program_id, state.programs);
        const a = el("a", "calendar-class");
        a.href = `enroll.html?schedule=${sched.id}`;
        a.style.background = color.bg;
        a.style.borderColor = color.border;
        a.style.color = color.text;
        a.appendChild(el("span", "calendar-class-program", prog ? prog.name : "Class"));
        a.appendChild(el("span", "calendar-class-time",
          `${formatTime(sched.start_time)}–${formatTime(sched.end_time)}`));
        a.appendChild(el("span", "calendar-class-age", formatAgeGroup(sched.age_group)));
        a.appendChild(el("span", "calendar-class-price", formatPrice(sched.price_cents)));
        cell.appendChild(a);
      });
      grid.appendChild(cell);
    });
  });
  wrapper.appendChild(grid);
  root.appendChild(wrapper);

  // ---- Mobile list grouped by day ----
  const mobile = el("div", "calendar-mobile");
  DAYS.filter((d) => byDay[d].length > 0).forEach((day) => {
    const group = el("div", "calendar-day-group");
    group.appendChild(el("h4", "calendar-day-title", day));
    const list = el("div", "calendar-day-classes");
    byDay[day].forEach((sched) => {
      const prog = state.programs.find((p) => p.id === sched.program_id);
      const color = getColorForProgram(sched.program_id, state.programs);
      const card = el("a", "calendar-class-mobile");
      card.href = `enroll.html?schedule=${sched.id}`;
      card.style.borderLeftColor = color.border;
      card.style.background = color.bg;
      const header = el("div", "calendar-class-mobile-header");
      header.style.color = color.text;
      header.appendChild(el("span", "calendar-class-program", prog ? prog.name : "Class"));
      header.appendChild(el("span", "calendar-class-price", formatPrice(sched.price_cents)));
      card.appendChild(header);
      const details = el("div", "calendar-class-mobile-details");
      details.appendChild(el("span", "", `${formatTime(sched.start_time)}–${formatTime(sched.end_time)}`));
      details.appendChild(el("span", "muted", formatAgeGroup(sched.age_group)));
      card.appendChild(details);
      list.appendChild(card);
    });
    group.appendChild(list);
    mobile.appendChild(group);
  });
  root.appendChild(mobile);
}

async function changeSemester(semesterId) {
  state.selectedSemester = semesterId;
  state.loading = true;
  render();
  try {
    state.schedules = await apiGet(
      `class_schedules?semester_id=eq.${semesterId}&active=eq.true&order=day_of_week.asc,start_time.asc`
    );
    state.error = "";
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function init() {
  try {
    const [sems, programs] = await Promise.all([
      apiGet("semesters?active=eq.true&order=start_date.desc"),
      apiGet("programs?active=eq.true&order=sort_order.asc"),
    ]);
    state.semesters = sems;
    state.programs = programs;

    if (sems.length > 0) {
      const summer2026 = sems.find((semester) => semester.name.trim().toLowerCase() === "summer 2026");
      const defaultSemester = summer2026 || sems[0];
      state.selectedSemester = defaultSemester.id;
      state.schedules = await apiGet(
        `class_schedules?semester_id=eq.${defaultSemester.id}&active=eq.true&order=day_of_week.asc,start_time.asc`
      );
    }
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function retryScheduleLoad() {
  state.loading = true;
  state.error = "";
  render();
  await init();
}

init();
