// Account page — enrollments, credits, upcoming classes, make-up booking.
// Ported from herfield app/account/AccountPageClient.js, compiled to vanilla JS.
import { apiGet, callFunction, formatPrice, formatTime, getQueryParam } from "./api.js";
import { isLoggedIn, getUser, isAdmin, logout, getToken, refreshToken, requireAuth, claimEnrollments } from "./auth.js";

// Require login — redirect to login.html if not authenticated.
const user = requireAuth();
if (!user) throw new Error("redirecting to login");

const paymentStatus = getQueryParam("payment");
const registrationStatus = getQueryParam("registration");

const state = {
  user,
  enrollments: [],
  bookings: [],
  sessions: [], // session rows for bookings
  schedules: [],
  programs: [],
  loading: true,
  error: "",
  actionError: "",
  // make-up UI state, keyed by enrollment id
  showMakeup: {}, // { [enrollmentId]: { loading, sessions: [] } | false }
};

const root = document.getElementById("account-root");

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html != null) e.innerHTML = html;
  return e;
}

// ---- lookups ----
function getScheduleForSession(sessionId) {
  const sess = state.sessions.find((s) => s.id === sessionId);
  if (!sess) return null;
  return state.schedules.find((sc) => sc.id === sess.schedule_id);
}

function getProgramForSession(sessionId) {
  const sched = getScheduleForSession(sessionId);
  if (!sched) return null;
  return state.programs.find((p) => p.id === sched.program_id);
}

function getSessionDate(sessionId) {
  const sess = state.sessions.find((s) => s.id === sessionId);
  return sess ? sess.class_date : null;
}

function getCreditBalance(enrollment) {
  if (enrollment.status !== "confirmed") return 0;
  const attended = state.bookings.filter(
    (b) => b.enrollment_id === enrollment.id && b.status === "attended"
  ).length;
  return (enrollment.num_classes_enrolled || 0) - attended;
}

function getUpcomingBookings(enrollmentId) {
  return state.bookings
    .filter((b) => b.enrollment_id === enrollmentId && b.status === "scheduled")
    .map((b) => {
      const date = getSessionDate(b.session_id);
      const sched = getScheduleForSession(b.session_id);
      return { ...b, date, schedule: sched };
    })
    .filter((b) => b.date && new Date(b.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function isWithin24h(sessionId) {
  const date = getSessionDate(sessionId);
  const sched = getScheduleForSession(sessionId);
  if (!date || !sched) return true;
  const sessionDateTime = new Date(date + "T" + sched.start_time + ":00");
  return (sessionDateTime - new Date()) / (1000 * 60 * 60) < 24;
}

// ---- main render ----
function render() {
  root.innerHTML = "";
  state.actionError = ""; // cleared on full re-render

  // Header
  const header = el("div", "account-header");
  header.appendChild(el("h2", "", "My Account"));
  header.appendChild(el("p", "account-email", state.user.email));
  const logoutBtn = el("button", "btn btn-sm", "Log Out");
  logoutBtn.onclick = handleLogout;
  header.appendChild(logoutBtn);
  if (isAdmin()) {
    const adminLink = el("a", "btn btn-sm", "Open Admin CMS");
    adminLink.href = "admin.html";
    header.appendChild(adminLink);
  }
  root.appendChild(header);

  if (paymentStatus === "success") {
    const b = el("div", "payment-success-banner");
    b.appendChild(el("p", "", "✓ Payment successful! Please complete your registration below."));
    root.appendChild(b);
  }
  if (paymentStatus === "cancelled") {
    const b = el("div", "payment-cancel-banner");
    b.appendChild(el("p", "", "Payment was cancelled. You can try again anytime."));
    root.appendChild(b);
  }
  if (registrationStatus === "complete") {
    const b = el("div", "payment-success-banner");
    b.appendChild(el("p", "", "✓ Registration complete! Your enrollment is confirmed."));
    root.appendChild(b);
  }

  root.appendChild(el("h3", "", "My Enrollments"));

  if (state.loading) {
    root.appendChild(el("p", "muted", "Loading…"));
    return;
  }
  if (state.error) {
    root.appendChild(el("p", "auth-error", state.error));
    return;
  }
  if (state.enrollments.length === 0) {
    const empty = el("div", "empty-state");
    empty.appendChild(el("p", "", "You haven't enrolled in any classes yet."));
    const browse = el("a", "btn", "Browse Classes");
    browse.href = "schedule.html";
    empty.appendChild(browse);
    root.appendChild(empty);
    return;
  }

  const list = el("div", "enrollment-list");
  state.enrollments.forEach((en) => {
    list.appendChild(renderEnrollmentCard(en));
  });
  root.appendChild(list);
}

function renderEnrollmentCard(en) {
  const creditBalance = getCreditBalance(en);
  const upcoming = getUpcomingBookings(en.id);
  const sched = state.schedules.find((s) => s.id === en.schedule_id);
  const program = state.programs.find((p) => p.id === sched?.program_id);

  const card = el("div", "enrollment-card enrollment-card-expanded");

  // Header row
  const cardHeader = el("div", "enrollment-card-header");
  const info = el("div", "enrollment-info");
  info.appendChild(el("h4", "", program ? program.name : en.student_name));
  info.appendChild(el("p", "muted", en.student_email || ""));
  if (en.num_classes_enrolled) {
    info.appendChild(el("p", "muted",
      `${en.num_classes_enrolled} classes purchased` +
      (en.total_paid_cents ? ` · ${formatPrice(en.total_paid_cents)} paid` : "")));
  }
  cardHeader.appendChild(info);

  const statusCol = el("div", "enrollment-status");
  statusCol.appendChild(el("span", `status-badge status-${en.status}`, en.status));
  if (en.registration_complete) {
    statusCol.appendChild(el("span", "status-badge status-registered", "Registered"));
  } else {
    const reg = el("a", "btn btn-sm", "Complete Registration");
    reg.href = `registration.html?enrollment=${en.id}`;
    statusCol.appendChild(reg);
  }
  cardHeader.appendChild(statusCol);
  card.appendChild(cardHeader);

  // Credit balance
  if (en.status === "confirmed") {
    const credit = el("div", `credit-balance ${creditBalance < 0 ? "credit-negative" : "credit-positive"}`);
    credit.appendChild(el("span", "credit-label", "Credits Remaining"));
    credit.appendChild(el("span", "credit-value", String(creditBalance)));
    card.appendChild(credit);
  } else if (en.status === "pending") {
    card.appendChild(el("p", "muted",
      "Payment pending — credits will be available once payment is confirmed."));
  } else {
    card.appendChild(el("p", "muted", "This enrollment was cancelled."));
  }

  // Upcoming classes
  if (en.status === "confirmed" && upcoming.length > 0) {
    const wrap = el("div", "upcoming-classes");
    wrap.appendChild(el("h5", "", "Upcoming Classes"));
    upcoming.forEach((b) => {
      const within24 = isWithin24h(b.session_id);
      const sess = state.sessions.find((s) => s.id === b.session_id);
      const row = el("div", "upcoming-class-row");

      const left = el("div", "upcoming-class-info");
      left.appendChild(el("span", "upcoming-class-date",
        new Date(b.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })));
      left.appendChild(el("span", "muted",
        b.schedule ? `${formatTime(b.schedule.start_time)}–${formatTime(b.schedule.end_time)}` : ""));
      left.appendChild(el("span", `booking-type-badge booking-type-${b.type}`,
        b.type === "home" ? "Home" : "Make-up"));
      row.appendChild(left);

      const actions = el("div", "upcoming-class-actions");
      if (b.type === "home") {
        const skipBtn = el("button", "btn btn-sm btn-secondary", "Skip");
        skipBtn.disabled = within24;
        skipBtn.title = within24 ? "Cannot skip within 24h of class" : "";
        skipBtn.onclick = () => handleSkip(en.id, b.session_id);
        actions.appendChild(skipBtn);
      } else {
        const cancelBtn = el("button", "btn btn-sm btn-danger", "Cancel");
        cancelBtn.disabled = within24;
        cancelBtn.title = within24 ? "Cannot cancel within 24h of class" : "";
        cancelBtn.onclick = () => handleCancelMakeup(en.id, b.session_id);
        actions.appendChild(cancelBtn);
      }
      row.appendChild(actions);

      if (sess?.status === "cancelled") {
        row.appendChild(el("span", "status-badge status-cancelled", "Session Cancelled"));
      }
      wrap.appendChild(row);
    });
    card.appendChild(wrap);
  }

  // Make-up booking section
  if (en.status === "confirmed") {
    card.appendChild(renderMakeupSection(en));
  }

  return card;
}

function renderMakeupSection(en) {
  const section = el("div", "makeup-section");
  const makeupState = state.showMakeup[en.id];
  const btn = el("button", "btn btn-sm",
    makeupState ? "Hide Make-up Options" : "Book a Make-up Class");
  btn.onclick = () => {
    if (makeupState) {
      delete state.showMakeup[en.id];
      render();
    } else {
      loadMakeupSessions(en);
    }
  };
  section.appendChild(btn);

  if (makeupState) {
    const list = el("div", "makeup-list");
    if (makeupState.loading) {
      list.appendChild(el("p", "muted", "Loading available sessions…"));
    } else if (makeupState.sessions.length === 0) {
      list.appendChild(el("p", "muted", "No make-up sessions available right now. Check back later!"));
    } else {
      makeupState.sessions.forEach((sess) => {
        const row = el("div", "makeup-session-row");
        const info = el("div", "makeup-session-info");
        info.appendChild(el("span", "makeup-session-date",
          new Date(sess.class_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })));
        info.appendChild(el("span", "muted",
          `${formatTime(sess.schedule.start_time)}–${formatTime(sess.schedule.end_time)}`));
        info.appendChild(el("span", "muted", sess.schedule.age_group));
        info.appendChild(el("span", "muted", `${sess.available} spots open`));
        row.appendChild(info);

        const bookBtn = el("button", "btn btn-sm", "Book");
        bookBtn.onclick = () => handleBookMakeup(en.id, sess.id);
        row.appendChild(bookBtn);
        list.appendChild(row);
      });
    }
    section.appendChild(list);
  }
  return section;
}

// ---- actions ----
async function handleLogout() {
  await logout();
  window.location.href = "index.html";
}

async function handleSkip(enrollmentId, sessionId) {
  await doBookAction("skip", enrollmentId, sessionId);
}

async function handleCancelMakeup(enrollmentId, sessionId) {
  await doBookAction("cancel", enrollmentId, sessionId);
}

async function handleBookMakeup(enrollmentId, sessionId) {
  await doBookAction("makeup", enrollmentId, sessionId);
}

async function doBookAction(action, enrollmentId, sessionId) {
  // optimistic: disable nothing globally — just reload on success/failure
  try {
    const token = getToken();
    await callFunction("book-class", {
      action,
      enrollment_id: enrollmentId,
      session_id: sessionId,
    }, token);
    delete state.showMakeup[enrollmentId];
    await loadData();
  } catch (err) {
    showActionError(err.message);
  }
}

function showActionError(msg) {
  // Insert an action-error banner at the top of the root, below the header.
  const existing = root.querySelector(".action-error");
  if (existing) existing.remove();
  const banner = el("p", "auth-error action-error", msg);
  const header = root.querySelector(".account-header");
  if (header && header.nextSibling) {
    root.insertBefore(banner, header.nextSibling);
  } else {
    root.appendChild(banner);
  }
}

async function loadMakeupSessions(enrollment) {
  state.showMakeup[enrollment.id] = { loading: true, sessions: [] };
  render();
  try {
    const token = getToken();
    const sched = state.schedules.find((s) => s.id === enrollment.schedule_id);
    if (!sched) {
      state.showMakeup[enrollment.id] = { loading: false, sessions: [] };
      render();
      return;
    }
    const progSchedules = state.schedules.filter((s) => s.program_id === sched.program_id);
    const schedIds = progSchedules.map((s) => s.id);

    const today = new Date().toISOString().split("T")[0];
    const sessPromises = schedIds.map((sid) =>
      apiGet(`class_sessions?schedule_id=eq.${sid}&class_date=gte.${today}&status=eq.scheduled&order=class_date.asc`, token)
    );
    const allSessions = (await Promise.all(sessPromises)).flat();

    const now = new Date();
    const available = allSessions.filter((sess) => {
      const s = state.schedules.find((sc) => sc.id === sess.schedule_id);
      if (!s) return false;
      const dt = new Date(sess.class_date + "T" + s.start_time + ":00");
      if ((dt - now) / (1000 * 60 * 60) < 24) return false;
      const alreadyBooked = state.bookings.some(
        (b) => b.session_id === sess.id && b.enrollment_id === enrollment.id && b.status === "scheduled"
      );
      return !alreadyBooked;
    });

    const withCapacity = await Promise.all(
      available.map(async (sess) => {
        const s = state.schedules.find((sc) => sc.id === sess.schedule_id);
        try {
          const bks = await apiGet(`bookings?session_id=eq.${sess.id}&status=in.(scheduled,attended)&select=id`, token);
          const booked = bks.length;
          return { ...sess, schedule: s, booked, available: s.max_seats - booked };
        } catch {
          return { ...sess, schedule: s, booked: 0, available: s.max_seats };
        }
      })
    );

    state.showMakeup[enrollment.id] = { loading: false, sessions: withCapacity.filter((s) => s.available > 0) };
  } catch (err) {
    state.showMakeup[enrollment.id] = { loading: false, sessions: [] };
    showActionError(err.message);
  }
  render();
}

// ---- data load ----
async function loadData() {
  state.loading = true;
  state.error = "";
  render();
  try {
    // Access tokens expire. Refresh before any protected account request so a
    // previously signed-in parent never sees a raw 401 response.
    const token = await refreshToken();
    if (!token) {
      const here = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login.html?next=${here}`;
      return;
    }

    // Attach any unclaimed guest enrollments for this email (best-effort).
    await claimEnrollments();
    const [ens, bks] = await Promise.all([
      apiGet("enrollments?order=created_at.desc", token),
      apiGet("bookings?order=booked_at.desc", token),
    ]);
    state.enrollments = ens;
    state.bookings = bks;

    // Sync any pending enrollments whose payment may have completed since the
    // webhook path is unreliable (billing has no webhook forward). If any
    // flipped to confirmed, reload bookings/sessions so the UI is consistent.
    const pending = ens.filter((e) => e.status === "pending" && e.id);
    if (pending.length > 0) {
      let changed = false;
      await Promise.all(pending.map(async (e) => {
        try {
          const r = await callFunction("sync-enrollment-payment", { enrollment_id: e.id }, token);
          if (r.synced) changed = true;
        } catch { /* best-effort; stay pending */ }
      }));
      if (changed) {
        // Re-fetch so statuses, bookings, and sessions reflect the flip.
        const [ens2, bks2] = await Promise.all([
          apiGet("enrollments?order=created_at.desc", token),
          apiGet("bookings?order=booked_at.desc", token),
        ]);
        state.enrollments = ens2;
        state.bookings = bks2;
      }
    }

    if (bks.length > 0) {
      // Fetch session details for bookings
      const sessionIds = [...new Set(bks.map((b) => b.session_id))];
      const sessResults = await Promise.all(
        sessionIds.map((sid) => apiGet(`class_sessions?id=eq.${sid}`, token))
      );
      const allSessions = sessResults.flat();
      state.sessions = allSessions;

      // Fetch schedule details
      const schedIds = [...new Set(allSessions.map((s) => s.schedule_id))];
      if (schedIds.length > 0) {
        const schedResults = await Promise.all(
          schedIds.map((sid) => apiGet(`class_schedules?id=eq.${sid}`))
        );
        state.schedules = schedResults.flat();

        // Fetch programs
        const progIds = [...new Set(state.schedules.map((s) => s.program_id))];
        if (progIds.length > 0) {
          const progResults = await Promise.all(
            progIds.map((pid) => apiGet(`programs?id=eq.${pid}`))
          );
          state.programs = progResults.flat();
        }
      }
    }
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

loadData();
