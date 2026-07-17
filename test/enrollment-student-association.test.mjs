import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { handler } from "../backend/functions/manage-students.js";

function request(body) {
  return new Request("https://example.test/manage-students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("a parent can associate an owned student with an existing enrollment", async () => {
  const queries = [];
  const ctx = {
    user: { id: "parent-1", email: "parent@example.com" },
    db: {
      async query(sql, values) {
        queries.push({ sql, values });
        return { rows: [{ id: "enrollment-1", student_id: "student-1" }], rowCount: 1 };
      },
    },
  };

  const response = await handler(request({
    action: "assign-enrollment",
    enrollment_id: "enrollment-1",
    student_id: "student-1",
  }), ctx);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    enrollment: { id: "enrollment-1", student_id: "student-1" },
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /UPDATE enrollments SET student_id = \$1/);
  assert.match(queries[0].sql, /id = \$2 AND user_id = \$3/);
  assert.match(queries[0].sql, /EXISTS \(SELECT 1 FROM students/);
  assert.deepEqual(queries[0].values, ["student-1", "enrollment-1", "parent-1"]);
});

test("the enrollment card lets a parent assign it to one of their students", async () => {
  const account = await readFile(new URL("../js/account.js", import.meta.url), "utf8");

  assert.match(account, /Associate with student/);
  assert.match(account, /function renderEnrollmentStudentAssignment\(en\)/);
  assert.match(account, /action: "assign-enrollment", enrollment_id: en\.id, student_id: studentId/);
});
