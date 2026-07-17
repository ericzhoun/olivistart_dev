// Daily service job. Keep denormalized enrollment and student ages in sync
// with their dates of birth so reports can read them without recalculating.
export async function handler(_req, ctx) {
  const enrollmentResult = await ctx.db.query(
    `UPDATE enrollments
     SET child_age = EXTRACT(YEAR FROM age(CURRENT_DATE, child_dob::date))::int::text
     WHERE child_dob ~ '^\\d{4}-\\d{2}-\\d{2}$'
       AND child_dob::date <= CURRENT_DATE
       AND child_age IS DISTINCT FROM EXTRACT(YEAR FROM age(CURRENT_DATE, child_dob::date))::int::text
     RETURNING id`
  );

  const studentResult = await ctx.db.query(
    `UPDATE students
     SET age = EXTRACT(YEAR FROM age(CURRENT_DATE, dob::date))::int::text
     WHERE dob ~ '^\\d{4}-\\d{2}-\\d{2}$'
       AND dob::date <= CURRENT_DATE
       AND age IS DISTINCT FROM EXTRACT(YEAR FROM age(CURRENT_DATE, dob::date))::int::text
     RETURNING id`
  );

  return json({ updated: enrollmentResult.rows.length + studentResult.rows.length }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
