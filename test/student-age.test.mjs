import assert from "node:assert/strict";
import { test } from "node:test";

import { calculateAge } from "../js/student-age.js";
import { handler as completeRegistration } from "../backend/functions/complete-registration.js";
import { handler as syncStudentAges } from "../backend/functions/sync-student-ages.js";

test("calculateAge accounts for whether the birthday has occurred this year", () => {
  assert.equal(calculateAge("2015-10-20", new Date("2026-10-19T12:00:00Z")), 10);
  assert.equal(calculateAge("2015-10-20", new Date("2026-10-20T12:00:00Z")), 11);
});

test("calculateAge accepts leap-day birthdays and rejects invalid dates", () => {
  assert.equal(calculateAge("2020-02-29", new Date("2025-02-28T12:00:00Z")), 4);
  assert.equal(calculateAge("2020-02-29", new Date("2025-03-01T12:00:00Z")), 5);
  assert.equal(calculateAge("2020-02-30", new Date("2026-07-16T12:00:00Z")), null);
});

test("registration saves an age derived from date of birth, not a submitted age", async () => {
  const queries = [];
  const response = await completeRegistration(new Request("https://example.test/complete-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_id: "enrollment-1",
      child_name: "Student Example",
      child_age: "99",
      child_dob: "2015-10-20",
    }),
  }), {
    user: { id: "parent-1" },
    db: {
      async query(sql, values) {
        queries.push({ sql, values });
        return { rows: [{ id: "enrollment-1" }] };
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(queries.length, 1);
  assert.equal(queries[0].values.includes("99"), false);
  assert.equal(queries[0].values.includes(String(calculateAge("2015-10-20"))), true);
});

test("daily age sync recalculates every enrollment with a date of birth", async () => {
  const queries = [];
  const response = await syncStudentAges(new Request("https://example.test/sync-student-ages"), {
    db: {
      async query(sql) {
        queries.push(sql);
        return { rows: [{ id: "enrollment-1" }, { id: "enrollment-2" }] };
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { updated: 2 });
  assert.match(queries[0], /UPDATE enrollments/);
  assert.match(queries[0], /CURRENT_DATE/);
});
