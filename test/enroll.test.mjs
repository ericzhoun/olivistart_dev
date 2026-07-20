import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readEnroll = () => readFile(new URL("../js/enroll.js", import.meta.url), "utf8");

test("enroll.js fetches camp bundle siblings for camp programs", async () => {
  const script = await readEnroll();
  assert.match(script, /campBundleQuery\(/);
  assert.match(script, /program_type === "camp"/);
  assert.match(script, /compareDayOfWeek/);
});

test("enroll.js shows the bundled day list and locks the class count for camps", async () => {
  const script = await readEnroll();
  assert.match(script, /state\.campDays\.join\(", "\)/);
  assert.match(script, /not adjustable/);
});
