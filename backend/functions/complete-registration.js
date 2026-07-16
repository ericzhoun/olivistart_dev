// Saves the post-payment registration form for an enrollment the caller owns.
// HTTP trigger: auth "required". Replaces the former client-side service-key
// PATCH (the service key must never ship to browsers).
const FIELDS = [
  "child_name", "child_age", "child_dob", "parent_name",
  "emergency_contact", "allergies", "referred_by",
];

export async function handler(req, ctx) {
  if (!ctx.user) {
    return json({ error: "Authentication required" }, 401);
  }

  let body;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.enrollment_id) {
    return json({ error: "enrollment_id is required" }, 400);
  }

  const sets = [];
  const values = [];
  for (const f of FIELDS) {
    if (body[f] !== undefined) {
      values.push(String(body[f]));
      sets.push(`${f} = $${values.length}`);
    }
  }
  values.push(body.enrollment_id, ctx.user.id);

  const res = await ctx.db.query(
    `UPDATE enrollments
     SET ${sets.length ? sets.join(", ") + "," : ""}
         agreement_signed = true, agreement_date = now(), registration_complete = true
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING id`,
    values
  );
  if (res.rows.length === 0) {
    return json({ error: "Enrollment not found" }, 404);
  }

  return json({ id: res.rows[0].id }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
