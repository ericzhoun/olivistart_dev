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
