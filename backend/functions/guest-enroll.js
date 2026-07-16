// Guest checkout: creates an unclaimed pending enrollment (user_id NULL) and a
// Stripe Checkout session via the platform billing API using the service role.
// HTTP trigger: auth "none" (public). Pricing is computed server-side from the
// database; client-sent prices are never trusted.
export async function handler(req, ctx) {
  let body;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const schedule_id = body.schedule_id;
  const student_name = String(body.student_name || "").trim();
  const student_email = String(body.student_email || "").trim().toLowerCase();
  const student_phone = String(body.student_phone || "").trim();
  let numClasses = parseInt(body.num_classes_enrolled, 10);

  if (!schedule_id) return json({ error: "schedule_id is required" }, 400);
  if (!student_name) return json({ error: "Student name is required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
    return json({ error: "A valid email is required" }, 400);
  }

  // 1. Schedule + program (pricing source of truth)
  const scheduleRes = await ctx.db.query(
    `SELECT cs.*, p.name AS program_name, p.num_classes AS program_num_classes,
            p.early_bird_discount_pct AS program_early_bird_pct,
            p.early_bird_deadline AS program_early_bird_deadline
     FROM class_schedules cs
     JOIN programs p ON cs.program_id = p.id
     WHERE cs.id = $1 AND cs.active = true`,
    [schedule_id]
  );
  if (scheduleRes.rows.length === 0) {
    return json({ error: "Class schedule not found" }, 404);
  }
  const schedule = scheduleRes.rows[0];

  const maxClasses = schedule.program_num_classes || 8;
  if (!Number.isFinite(numClasses) || numClasses < 1) numClasses = maxClasses;
  numClasses = Math.min(numClasses, maxClasses);

  // 2. Capacity: confirmed seats plus pending holds younger than 60 minutes
  const countRes = await ctx.db.query(
    `SELECT COUNT(*) AS held FROM enrollments
     WHERE schedule_id = $1
       AND (status = 'confirmed'
            OR (status = 'pending' AND created_at > now() - interval '60 minutes'))`,
    [schedule_id]
  );
  if (parseInt(countRes.rows[0].held, 10) >= schedule.max_seats) {
    return json({ error: "Class is full", spots_available: 0 }, 409);
  }

  // 3. Server-side pricing with early-bird discount
  const perClass = schedule.price_cents;
  const ebPct = schedule.early_bird_discount_pct || schedule.program_early_bird_pct || 0;
  const ebDeadline = schedule.early_bird_deadline || schedule.program_early_bird_deadline;
  const isEarlyBird = ebPct > 0 && (!ebDeadline || new Date() <= new Date(ebDeadline));
  const subtotal = perClass * numClasses;
  const discountAmount = isEarlyBird ? Math.round((subtotal * ebPct) / 100) : 0;
  const total = subtotal - discountAmount;

  // 4. Unclaimed pending enrollment
  const enrollRes = await ctx.db.query(
    `INSERT INTO enrollments (schedule_id, user_id, student_name, student_email, student_phone,
                              status, num_classes_enrolled, price_per_class_cents, discount_pct, total_paid_cents)
     VALUES ($1, NULL, $2, $3, $4, 'pending', $5, $6, $7, $8)
     RETURNING id`,
    [schedule_id, student_name, student_email, student_phone,
     numClasses, perClass, isEarlyBird ? ebPct : 0, total]
  );
  const enrollmentId = enrollRes.rows[0].id;

  const apiBase = ctx.env.BUTTERBASE_API_URL || "https://api.butterbase.ai";
  const appId = ctx.env.BUTTERBASE_APP_ID;
  const siteUrl = ctx.env.SITE_URL || "https://olivistart.com";
  const serviceHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ctx.env.SERVICE_KEY}`,
  };

  // 5. Dynamically priced product
  const productName = `${schedule.program_name} - ${numClasses} class${numClasses > 1 ? "es" : ""}` +
    (isEarlyBird ? ` (${ebPct}% early-bird)` : "");
  const productRes = await fetch(`${apiBase}/v1/${appId}/billing/products`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      name: productName,
      priceCents: total,
      description: `${schedule.program_name} art class - ${numClasses} x $${(perClass / 100).toFixed(2)}/class` +
        (isEarlyBird ? `, ${ebPct}% early-bird discount` : ""),
      metadata: {
        enrollment_id: enrollmentId,
        schedule_id: schedule_id,
        guest: "true",
        num_classes: String(numClasses),
        price_per_class_cents: String(perClass),
        discount_pct: String(isEarlyBird ? ebPct : 0),
        total_cents: String(total),
      },
    }),
  });
  if (!productRes.ok) {
    const errText = await productRes.text();
    console.error("Failed to create product:", errText);
    await ctx.db.query(`DELETE FROM enrollments WHERE id = $1`, [enrollmentId]);
    return json({ error: "Failed to create payment product" }, 502);
  }
  const product = await productRes.json();

  // 6. Checkout session (service role; the buyer has no account yet)
  const purchaseRes = await fetch(`${apiBase}/v1/${appId}/billing/purchase`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      productId: product.id,
      successUrl: `${siteUrl}/checkout-success.html?enrollment=${enrollmentId}`,
      cancelUrl: `${siteUrl}/enroll.html?schedule=${schedule_id}&payment=cancelled`,
    }),
  });
  if (!purchaseRes.ok) {
    const errText = await purchaseRes.text();
    console.error("Failed to create checkout session:", errText);
    await ctx.db.query(`DELETE FROM enrollments WHERE id = $1`, [enrollmentId]);
    return json({ error: "Failed to create checkout session" }, 502);
  }
  const purchase = await purchaseRes.json();

  await ctx.db.query(
    `UPDATE enrollments SET stripe_order_id = $1 WHERE id = $2`,
    [purchase.orderId, enrollmentId]
  );

  // Note: order_id is intentionally not returned to the client.
  return json({
    enrollment_id: enrollmentId,
    checkout_url: purchase.url,
    total_cents: total,
  }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
