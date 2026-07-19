import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { semestersQuery, programsQuery, scheduleQuery } from "../js/api.js";

const readSchedule = () => readFile(new URL("../js/schedule.js", import.meta.url), "utf8");

test("schedule query helpers produce the exact REST paths schedule.js and the bake script share", () => {
  assert.equal(semestersQuery(), "semesters?active=eq.true&order=start_date.desc");
  assert.equal(programsQuery(), "programs?active=eq.true&order=sort_order.asc");
  assert.equal(
    scheduleQuery("abc-123"),
    "class_schedules?semester_id=eq.abc-123&active=eq.true&order=day_of_week.asc,start_time.asc"
  );
});

test("schedule.js uses the shared query helpers instead of inline query strings", async () => {
  const script = await readSchedule();
  assert.match(script, /semestersQuery\(\)/);
  assert.match(script, /programsQuery\(\)/);
  assert.match(script, /scheduleQuery\(/);
  assert.doesNotMatch(script, /class_schedules\?semester_id=eq\.\$\{/);
});

test("schedule failures provide an accessible retry action", async () => {
  const script = await readSchedule();

  assert.match(script, /Unable to load the schedule\. Please try again\./);
  assert.match(script, /Try again/);
  assert.match(script, /retryScheduleLoad/);
});

test("weekly schedule retains multiple classes sharing a day and start time", async () => {
  const script = await readSchedule();
  const match = script.match(/export function schedulesBySlot[\s\S]*?\n}\n/);
  assert.ok(match, "schedule slot grouping helper should be exported");

  const moduleUrl = new URL(`data:text/javascript,${encodeURIComponent(`${match[0]}\nexport default schedulesBySlot;`)}`);
  const { default: schedulesBySlot } = await import(moduleUrl);
  const rows = schedulesBySlot([
    { id: "photography", day_of_week: "Saturday", start_time: "10:00", end_time: "11:30" },
    { id: "visual-discovery", day_of_week: "Saturday", start_time: "10:00", end_time: "12:00" },
  ]);

  assert.deepEqual(rows["Saturday|10:00"].map((schedule) => schedule.id), ["photography", "visual-discovery"]);
});

test("age group labels are prefixed with 'Age' when they are a bare digit range", async () => {
  const script = await readSchedule();
  const match = script.match(/export function schedulesBySlot[\s\S]*?\n}\n[\s\S]*?function formatAgeGroup[\s\S]*?\n}\n/);
  assert.ok(match, "formatAgeGroup helper should be defined");

  const moduleUrl = new URL(`data:text/javascript,${encodeURIComponent(`${match[0]}\nexport default formatAgeGroup;`)}`);
  const { default: formatAgeGroup } = await import(moduleUrl);

  assert.equal(formatAgeGroup("7-12"), "Age 7-12");
  assert.equal(formatAgeGroup("6-16"), "Age 6-16");
  assert.equal(formatAgeGroup("6–10"), "Age 6–10");
  // Already labeled or non-numeric values pass through unchanged.
  assert.equal(formatAgeGroup("Age 7-12"), "Age 7-12");
  assert.equal(formatAgeGroup("Teens"), "Teens");
  assert.equal(formatAgeGroup(""), "");
});

test("parseSnapshot returns null for missing, empty, or malformed snapshot data", async () => {
  const script = await readSchedule();
  const match = script.match(/export function parseSnapshot[\s\S]*?\n}\n/);
  assert.ok(match, "parseSnapshot helper should be exported");

  const moduleUrl = new URL(`data:text/javascript,${encodeURIComponent(`${match[0]}\nexport default parseSnapshot;`)}`);
  const { default: parseSnapshot } = await import(moduleUrl);

  assert.equal(parseSnapshot(""), null);
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot("not json"), null);
  assert.equal(parseSnapshot(JSON.stringify({ semesters: [] })), null);
  assert.equal(parseSnapshot(JSON.stringify({ semesters: [{ id: "s1" }] })), null);

  const valid = JSON.stringify({
    semesters: [{ id: "s1", name: "Summer 2026" }],
    programs: [],
    schedulesBySemester: { s1: [] },
  });
  assert.deepEqual(parseSnapshot(valid), JSON.parse(valid));
});

test("pickDefaultSemester prefers Summer 2026, else falls back to the first semester", async () => {
  const script = await readSchedule();
  const match = script.match(/export function pickDefaultSemester[\s\S]*?\n}\n/);
  assert.ok(match, "pickDefaultSemester helper should be exported");

  const moduleUrl = new URL(`data:text/javascript,${encodeURIComponent(`${match[0]}\nexport default pickDefaultSemester;`)}`);
  const { default: pickDefaultSemester } = await import(moduleUrl);

  const semesters = [{ id: "s1", name: "Fall 2025" }, { id: "s2", name: "Summer 2026" }];
  assert.equal(pickDefaultSemester(semesters).id, "s2");
  assert.equal(pickDefaultSemester([{ id: "s3", name: "Fall 2025" }]).id, "s3");
});
