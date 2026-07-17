import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readSchedule = () => readFile(new URL("../js/schedule.js", import.meta.url), "utf8");

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
