// Registration form — post-payment student info + agreement.
// Ported from herfield app/account/registration/[enrollmentId]/RegistrationFormClient.js.
import { apiGet, adminApi, formatPrice, formatTime, getQueryParam } from "./api.js";
import { isLoggedIn, getUser, getToken, requireAuth } from "./auth.js";

const enrollmentId = getQueryParam("enrollment");
const paymentSuccess = getQueryParam("payment") === "success";

// Require login
const user = requireAuth();
if (!user) throw new Error("redirecting to login");

const TERMS_TEXT = `OliVista Studio Art Class Registration Agreement

1. LIABILITY WAIVER
I acknowledge that participation in art classes involves the use of art materials, tools, and equipment that may pose inherent risks. I voluntarily assume all risks associated with my child's participation in the art classes offered by OliVista Studio. I release OliVista Studio, its instructors, and staff from any liability for injuries, damages, or losses that may occur during class activities.

2. MEDICAL EMERGENCY AUTHORIZATION
In the event of a medical emergency, I authorize OliVista Studio staff to seek necessary medical treatment for my child. I understand that I will be notified immediately in case of any emergency. I am responsible for all medical costs incurred.

3. PHOTO/MEDIA RELEASE
I grant OliVista Studio permission to photograph and/or record my child during art classes for promotional purposes, including social media, website, and marketing materials. I understand that my child's name will not be used without separate written consent.

4. PAYMENT AND REFUND POLICY
- Full payment is due at the time of registration.
- Refunds are available up to 7 days before the first class, minus a 10% processing fee.
- No refunds will be issued after the first class session.
- Make-up classes may be available for missed sessions, subject to availability.

5. ATTENDANCE AND MAKE-UP POLICY
- Students are expected to attend all scheduled classes.
- Up to 2 make-up classes may be scheduled per semester, subject to availability.
- No-shows without prior notice will not be eligible for make-up sessions.

6. CODE OF CONDUCT
- Students are expected to behave respectfully toward instructors and peers.
- Disruptive behavior may result in dismissal from the program without refund.
- Parents/guardians are responsible for timely drop-off and pick-up.

7. MATERIALS
- Art materials are provided unless otherwise specified.
- Students are responsible for bringing any specialty items requested by the instructor.

8. CANCELLATION
OliVista Studio reserves the right to cancel or reschedule classes due to low enrollment or unforeseen circumstances. In such cases, a full refund or make-up class will be offered.

By signing below, I confirm that I have read, understood, and agree to all terms and conditions outlined in this registration agreement.`;

const state = {
  enrollment: null,
  schedule: null,
  program: null,
  loading: true,
  error: "",
  submitting: false,
  agreed: false,
  form: {
    child_name: "",
    child_age: "",
    child_dob: "",
    parent_name: user?.display_name || user?.email || "",
    emergency_contact: "",
    allergies: "",
    referred_by: "",
    printed_name: "",
    agreement_date: new Date().toISOString().split("T")[0],
  },
};

const root = document.getElementById("registration-root");

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html != null) e.innerHTML = html;
  return e;
}

function makeField(key, label, opts = {}) {
  const { type = "text", required = false, placeholder = "", value = "", readOnly = false } = opts;
  const lbl = el("label", "", label);
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  if (required) input.required = true;
  if (readOnly) {
    input.readOnly = true;
    input.className = "readonly-input";
  } else {
    input.value = value !== "" ? value : state.form[key] || "";
    input.oninput = (e) => (state.form[key] = e.target.value);
  }
  lbl.appendChild(input);
  return lbl;
}

function render() {
  root.innerHTML = "";

  if (state.loading) {
    root.appendChild(el("p", "muted", "Loading…"));
    return;
  }

  if (state.error && !state.enrollment) {
    root.appendChild(el("p", "auth-error", state.error));
    const back = el("a", "btn", "Back to Account");
    back.href = "account.html";
    root.appendChild(back);
    return;
  }

  root.appendChild(el("h2", "", "Complete Your Registration"));

  if (paymentSuccess) {
    const b = el("div", "payment-success-banner");
    b.appendChild(el("p", "", "✓ Payment successful! Please complete the registration form below."));
    root.appendChild(b);
  }
  if (state.error) {
    root.appendChild(el("p", "auth-error", state.error));
  }

  // Class summary
  if (state.enrollment) {
    const sum = el("div", "registration-summary");
    sum.appendChild(el("h4", "", "Class Summary"));
    if (state.program) sum.appendChild(el("p", "", `<strong>${state.program.name}</strong>`));
    if (state.schedule) {
      sum.appendChild(el("p", "muted",
        `${state.schedule.day_of_week} ${formatTime(state.schedule.start_time)}–${formatTime(state.schedule.end_time)} · ${state.schedule.age_group}`));
    }
    const pricing = el("div", "registration-summary-pricing");
    if (state.enrollment.num_classes_enrolled) {
      pricing.appendChild(el("span", "", `${state.enrollment.num_classes_enrolled} classes`));
    }
    if (state.enrollment.total_paid_cents) {
      pricing.appendChild(el("span", "price-highlight", `${formatPrice(state.enrollment.total_paid_cents)} paid`));
    }
    sum.appendChild(pricing);
    root.appendChild(sum);
  }

  // Form
  const form = el("form", "registration-form");
  form.onsubmit = handleSubmit;

  // Student info
  form.appendChild(el("h4", "", "Student Information"));
  const studentRow = el("div", "form-row");
  studentRow.appendChild(makeField("child_name", "Child's Name *", { required: true, placeholder: "Child's full name" }));
  studentRow.appendChild(makeField("child_age", "Age *", { required: true, placeholder: "e.g. 8" }));
  studentRow.appendChild(makeField("child_dob", "Date of Birth", { type: "date" }));
  form.appendChild(studentRow);

  // Parent/guardian
  form.appendChild(el("h4", "", "Parent/Guardian Information"));
  const parentRow = el("div", "form-row");
  parentRow.appendChild(makeField("parent_name", "Parent/Guardian Name *", { required: true }));
  parentRow.appendChild(makeField(null, "Email", { type: "email", value: user?.email || "", readOnly: true }));
  parentRow.appendChild(makeField(null, "Phone", { type: "tel", value: state.enrollment?.student_phone || "", readOnly: true }));
  form.appendChild(parentRow);

  form.appendChild(makeField("emergency_contact", "Emergency Contact (if different)", { placeholder: "Name and phone number" }));

  // Allergies textarea
  const allergyLbl = el("label", "", "Allergies or Medical Conditions (Optional)");
  const allergyTa = document.createElement("textarea");
  allergyTa.rows = 2;
  allergyTa.placeholder = "List any allergies or medical conditions we should know about";
  allergyTa.value = state.form.allergies;
  allergyTa.oninput = (e) => (state.form.allergies = e.target.value);
  allergyLbl.appendChild(allergyTa);
  form.appendChild(allergyLbl);

  form.appendChild(makeField("referred_by", "Referred by (existing parent's name, if applicable)"));

  // Agreement
  const agreement = el("div", "agreement-section");
  agreement.appendChild(el("h4", "", "Registration Agreement"));
  const scrollbox = el("div", "terms-scrollbox");
  scrollbox.appendChild(el("pre", "terms-text", TERMS_TEXT));
  agreement.appendChild(scrollbox);

  const checkLbl = el("label", "checkbox-label agreement-checkbox");
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = state.agreed;
  check.onchange = (e) => { state.agreed = e.target.checked; };
  checkLbl.appendChild(check);
  checkLbl.appendChild(document.createTextNode(
    " I have read and agree to the terms and conditions above. This constitutes a binding agreement."));
  agreement.appendChild(checkLbl);

  const sigRow = el("div", "form-row signature-row");
  sigRow.appendChild(makeField("printed_name", "Printed Name (Signature) *", { required: true, placeholder: "Type your full legal name" }));
  sigRow.appendChild(makeField("agreement_date", "Date *", { type: "date", required: true }));
  agreement.appendChild(sigRow);
  form.appendChild(agreement);

  // Actions
  const actions = el("div", "form-actions");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn auth-btn";
  submit.disabled = state.submitting || !state.agreed;
  submit.textContent = state.submitting ? "Submitting…" : "Complete Registration";
  actions.appendChild(submit);
  const skip = el("a", "btn btn-secondary", "Skip for now");
  skip.href = "account.html";
  actions.appendChild(skip);
  form.appendChild(actions);

  root.appendChild(form);
}

async function handleSubmit(e) {
  e.preventDefault();
  state.error = "";
  if (!state.agreed) {
    state.error = "Please check the agreement box to confirm you accept the terms.";
    render();
    return;
  }
  if (!state.form.printed_name.trim()) {
    state.error = "Please enter your printed name as a signature.";
    render();
    return;
  }
  state.submitting = true;
  render();
  try {
    await adminApi(`enrollments/${enrollmentId}`, {
      method: "PATCH",
      body: {
        child_name: state.form.child_name,
        child_age: state.form.child_age,
        child_dob: state.form.child_dob,
        parent_name: state.form.parent_name,
        emergency_contact: state.form.emergency_contact,
        allergies: state.form.allergies,
        referred_by: state.form.referred_by,
        agreement_signed: true,
        agreement_date: new Date().toISOString(),
        registration_complete: true,
      },
    });
    window.location.href = "account.html?registration=complete";
  } catch (err) {
    state.error = err.message;
    state.submitting = false;
    render();
  }
}

async function init() {
  if (!enrollmentId) {
    state.error = "No enrollment specified.";
    state.loading = false;
    render();
    return;
  }
  try {
    const token = getToken();
    const enrollments = await apiGet(`enrollments?id=eq.${enrollmentId}`, token);
    if (enrollments.length === 0) {
      state.error = "Enrollment not found.";
      state.loading = false;
      render();
      return;
    }
    const en = enrollments[0];
    state.enrollment = en;

    if (en.registration_complete) {
      window.location.href = "account.html?registration=complete";
      return;
    }

    const sched = await apiGet(`class_schedules?id=eq.${en.schedule_id}`);
    if (sched.length > 0) {
      state.schedule = sched[0];
      const prog = await apiGet(`programs?id=eq.${sched[0].program_id}`);
      if (prog.length > 0) state.program = prog[0];
    }
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

init();
