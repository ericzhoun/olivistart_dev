// Daily service job. Keep each registration's denormalized age in sync with
// its date of birth so admin reports can read it without a client calculation.
export async function handler(_req, ctx) {
  const result = await ctx.db.query(
    `UPDATE enrollments
     SET child_age = EXTRACT(YEAR FROM age(CURRENT_DATE, child_dob::date))::int::text
     WHERE child_dob ~ '^\\d{4}-\\d{2}-\\d{2}$'
       AND child_dob::date <= CURRENT_DATE
       AND child_age IS DISTINCT FROM EXTRACT(YEAR FROM age(CURRENT_DATE, child_dob::date))::int::text
     RETURNING id`
  );

  return json({ updated: result.rows.length }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
