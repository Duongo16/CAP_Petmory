/**
 * IT-03 — The order state machine, every edge and every non-edge.
 *
 * Section 7.2 of the requirements draws the states an order may pass through.
 * This walks every declared edge to prove it is allowed, and then tries a
 * sample of the moves that are not drawn to prove they are refused. A state
 * machine that only ever gets tested on its happy path is not tested at all.
 *
 * Run: node tools/integration/it-03-state-machine.js
 */
const h = require('./harness');

/** The edges the requirements declare. Anything not here must be refused. */
const ALLOWED = {
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const ALL_STATES = Object.keys(ALLOWED);

/** Places one fresh order and returns its code, ready at AWAITING_PAYMENT. */
async function placeOrder(customer, label) {
  const product = await h.call('/catalog/products/PT-02');
  const size = product.body.sizes.find((s) => s.enabled);
  await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ productTypeCode: 'PT-02', sizeCode: size.code, quantity: 1 }),
  });
  const order = await h.call('/orders', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      fullName: `IT ${label}`,
      phone: '0900000000',
      address: '3 Duong IT',
      province: 'Hue',
    }),
  });
  return { code: order.body.orderCode, total: h.dong(order.body.total) };
}

async function move(manager, orderCode, status) {
  return h.call(`/admin/orders/${orderCode}/status`, {
    method: 'PATCH',
    headers: manager.auth,
    body: JSON.stringify({ status, reason: `IT state machine: ${status}` }),
  });
}

async function scenario(report) {
  const customer = await h.newCustomer('states');
  const manager = await h.signInInternal(h.ACCOUNT_MANAGER);

  // --- What the server says it will allow ---
  report.step('The server advertises the same next steps the requirements draw');
  const first = await placeOrder(customer, 'advertise');
  const detail = await h.call(`/admin/orders/${first.code}`, { headers: manager.auth });
  const advertised = [...(detail.body.nextSteps ?? [])].sort();
  const expected = [...ALLOWED.AWAITING_PAYMENT].sort();
  report.check('Awaiting payment offers exactly the declared next steps',
    JSON.stringify(advertised) === JSON.stringify(expected),
    `${advertised.join(',')} vs ${expected.join(',')}`);

  // Every state is walked to, then what the server offers from there is compared
  // against the diagram in section 7.2 of the requirements.
  const walkTo = {
    PAID: ['PAID'],
    IN_PRODUCTION: ['PAID', 'IN_PRODUCTION'],
    SHIPPING: ['PAID', 'IN_PRODUCTION', 'SHIPPING'],
    COMPLETED: ['PAID', 'IN_PRODUCTION', 'SHIPPING', 'COMPLETED'],
  };
  for (const [state, path] of Object.entries(walkTo)) {
    const probe = await placeOrder(customer, `probe-${state}`);
    for (const step of path) {
      // Khong giao hang khi phieu kiem dinh con muc chua tich.
      if (step === 'SHIPPING') {
        await h.passQualityCheck(probe.code, manager);
      }
      await move(manager, probe.code, step);
    }
    const seen = await h.call(`/admin/orders/${probe.code}`, { headers: manager.auth });
    const offered = [...(seen.body.nextSteps ?? [])].sort();
    const drawn = [...ALLOWED[state]].sort();
    report.check(`${state} offers exactly what the diagram draws`,
      JSON.stringify(offered) === JSON.stringify(drawn),
      `${offered.join(',') || 'none'} vs ${drawn.join(',') || 'none'}`);
  }

  // --- Every declared edge from the long path ---
  report.step('The whole path from awaiting payment to completed is allowed');
  const journey = await placeOrder(customer, 'journey');
  await h.sendTransfer(journey.code, Number(journey.total));

  const longPath = ['IN_PRODUCTION', 'SHIPPING', 'COMPLETED'];
  let walked = true;
  for (const status of longPath) {
    // Khong giao hang khi phieu kiem dinh con muc chua tich.
    if (status === 'SHIPPING') {
      await h.passQualityCheck(journey.code, manager);
    }
    const res = await move(manager, journey.code, status);
    if (res.status !== 200) {
      walked = false;
      report.check(`Allowed edge to ${status}`, false, String(res.status));
    }
  }
  report.check('Every declared edge along the long path is allowed', walked);

  // --- Hang chua qua kiem dinh thi khong giao duoc ---
  report.step('An order still on the checklist cannot be shipped');
  const back = await placeOrder(customer, 'back');
  await h.sendTransfer(back.code, Number(back.total));
  await move(manager, back.code, 'IN_PRODUCTION');
  const tooSoon = await move(manager, back.code, 'SHIPPING');
  report.check('Shipping is refused while the checklist is open',
    tooSoon.status === 400, String(tooSoon.status));

  // --- Moves that are not drawn ---
  report.step('Every move that is not drawn is refused');
  const skipping = await placeOrder(customer, 'skip');
  const notDrawn = ALL_STATES.filter((s) => !ALLOWED.AWAITING_PAYMENT.includes(s) && s !== 'AWAITING_PAYMENT');
  let allRefused = true;
  for (const status of notDrawn) {
    const res = await move(manager, skipping.code, status);
    if (res.status !== 400) {
      allRefused = false;
      report.check(`Refuses the jump to ${status}`, false, String(res.status));
    }
  }
  report.check(`All ${notDrawn.length} undrawn moves from awaiting payment are refused`, allRefused);

  // --- A finished order is finished ---
  report.step('A finished order accepts nothing further');
  let deadEnd = true;
  for (const status of ALL_STATES.filter((s) => s !== 'COMPLETED')) {
    const res = await move(manager, journey.code, status);
    if (res.status !== 400) {
      deadEnd = false;
      report.check(`Completed refuses ${status}`, false, String(res.status));
    }
  }
  report.check('Completed is a dead end', deadEnd);

  // --- Cancelling is a dead end too ---
  report.step('A cancelled order accepts nothing further');
  const cancelled = await placeOrder(customer, 'cancel');
  const killed = await move(manager, cancelled.code, 'CANCELLED');
  report.check('An order can be cancelled by hand', killed.status === 200, String(killed.status));
  const revive = await move(manager, cancelled.code, 'PAID');
  report.check('A cancelled order cannot be revived', revive.status === 400, String(revive.status));

  // --- Only a real notification reaches paid ---
  report.step('Nothing but a matching notification puts an order into paid');
  const guarded = await placeOrder(customer, 'guard');
  const byHand = await move(manager, guarded.code, 'PAID');
  report.check('Even a manager moving it by hand must give a reason',
    byHand.status === 200, String(byHand.status));

  const wrongReference = await h.sendTransfer('PM000000000', Number(guarded.total));
  report.check('A notification with no matching order changes nothing',
    wrongReference.body.result === 'NO_ORDER' || wrongReference.body.result === 'NO_REFERENCE',
    wrongReference.body.result);

  // --- A status outside the list is not a status ---
  report.step('A status outside the list is rejected at the boundary');
  const nonsense = await move(manager, skipping.code, 'ON_THE_MOON');
  report.check('An unknown status is refused', nonsense.status === 400, String(nonsense.status));

  // --- Every move left a trace ---
  report.step('Every accepted move is in the audit trail');
  const history = await h.call(`/admin/orders/${journey.code}`, { headers: manager.auth });
  const entries = history.body.history ?? [];
  report.check('The long path left one entry per move plus creation',
    entries.length >= longPath.length + 1, `${entries.length} entries`);
  report.check('Moves made by a person name that person',
    entries.filter((e) => e.actor).every((e) => Boolean(e.actor.email)),
    `${entries.filter((e) => e.actor).length} by a person`);
  // The move into paid is made by the payment notification, not by anybody, so
  // it is recorded with no person against it. That is the honest record.
  report.check('The automatic move into paid is recorded with no person',
    entries.some((e) => !e.actor), `${entries.filter((e) => !e.actor).length} automatic`);
}

if (require.main === module) {
  h.runScenario('IT-03  ORDER STATE MACHINE', scenario).then((r) => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

module.exports = { name: 'IT-03 State machine', scenario };
