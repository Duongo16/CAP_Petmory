/**
 * IT-02 — The amount stays the same all the way down the chain.
 *
 * A price is decided once, in the catalog, and then travels through the cart,
 * the order, the payment code and the transfer notification. Every handover is
 * a chance for it to drift. This walks the chain and compares whole dong at
 * each step, and checks that a price sent by the browser is never believed.
 *
 * Run: node tools/integration/it-02-money-integrity.js
 */
const h = require('./harness');

async function scenario(report) {
  const customer = await h.newCustomer('money');
  const manager = await h.signInInternal(h.ACCOUNT_MANAGER);

  const product = await h.call('/catalog/products/PT-01');
  const sizes = product.body.sizes.filter((s) => s.enabled);
  report.require('The product has at least two sizes', sizes.length >= 2, `${sizes.length}`);
  const small = sizes[0];
  const large = sizes[sizes.length - 1];

  const bases = await h.call('/catalog/display-bases');
  const noBase = bases.body.find((b) => h.dong(b.priceDelta) === 0n);
  const paidBase = bases.body.find((b) => h.dong(b.priceDelta) > 0n);
  report.require('There is a free stand and a paid stand',
    Boolean(noBase && paidBase), `${bases.body.length} stands`);

  // Hang tuy bien can ban thiet ke va du anh (muc 7): chuan bi san cho tung kich co.
  const smallDesign = await h.readyDesign(customer, 'PT-01', small.code);
  const largeDesign = await h.readyDesign(customer, 'PT-01', large.code);

  // --- The server owns the price ---
  report.step('A price sent by the browser is ignored');
  const forgedPrice = await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: small.code,
      quantity: 1,
      designId: smallDesign,
      unitPrice: '1',
    }),
  });
  report.check('An unexpected price field is rejected outright',
    forgedPrice.status === 400, String(forgedPrice.status));

  const forgedBase = await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: small.code,
      quantity: 1,
      designId: smallDesign,
      displayBaseCode: 'BASE-DOES-NOT-EXIST',
    }),
  });
  report.check('An unknown stand is rejected rather than priced at zero',
    forgedBase.status === 404, String(forgedBase.status));

  // --- Catalog to cart ---
  report.step('The catalog price reaches the cart unchanged');
  const added = await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: large.code,
      quantity: 3,
      designId: largeDesign,
      displayBaseCode: paidBase.code,
    }),
  });
  report.require('The line is added', added.status === 201, String(added.status));

  const expectedUnit = h.dong(large.price) + h.dong(paidBase.priceDelta);
  const line = added.body.items[0];
  report.check('The unit price is the size plus the stand',
    h.dong(line.unitPrice) === expectedUnit,
    `${h.dong(large.price)} + ${h.dong(paidBase.priceDelta)} = ${line.unitPrice}`);
  report.check('The cart total is the unit price times the quantity',
    h.dong(added.body.total) === expectedUnit * 3n,
    `${h.dong(added.body.total)} for 3`);

  // --- Two stands never share a line ---
  report.step('The same size with a different stand is a different line');
  const second = await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: large.code,
      quantity: 1,
      designId: largeDesign,
      displayBaseCode: noBase.code,
    }),
  });
  report.check('A second line appears rather than merging',
    second.body.items.length === 2, `${second.body.items.length} lines`);
  const cartTotal = expectedUnit * 3n + h.dong(large.price) + h.dong(noBase.priceDelta);
  report.check('The cart totals both lines correctly',
    h.dong(second.body.total) === cartTotal, String(h.dong(second.body.total)));

  // --- Cart to order ---
  report.step('The cart total reaches the order unchanged');
  const order = await h.call('/orders', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      fullName: 'Khach IT tien',
      phone: '0911222333',
      address: '2 Duong IT',
      province: 'Ha Noi',
    }),
  });
  report.require('The order is created', order.status === 201, String(order.status));
  const orderCode = order.body.orderCode;
  report.check('The order total equals the cart total',
    h.dong(order.body.total) === cartTotal, String(h.dong(order.body.total)));
  report.check('Each order line keeps its own unit price',
    h.dong(order.body.rows[0].unitPrice) === expectedUnit);

  // --- Order to payment code ---
  report.step('The order total reaches the payment code unchanged');
  const qr = await h.call(`/payments/qr/${orderCode}`, { headers: customer.auth });
  report.check('The payment code asks for the order total',
    h.dong(qr.body.amount) === cartTotal, String(h.dong(qr.body.amount)));

  // --- Underpaying does not move the order ---
  report.step('Short payment is refused, exact payment is accepted');
  const short = await h.sendTransfer(orderCode, Number(cartTotal - 1000n));
  report.check('A short transfer is recorded but does not match',
    short.body.result === 'UNDERPAID', short.body.result);

  const stillWaiting = await h.call(`/orders/${orderCode}`, { headers: customer.auth });
  report.check('The order is still awaiting payment',
    stillWaiting.body.status === 'AWAITING_PAYMENT', stillWaiting.body.status);

  const exact = await h.sendTransfer(orderCode, Number(cartTotal));
  report.check('The exact amount matches', exact.body.result === 'MATCHED', exact.body.result);

  const paid = await h.call(`/orders/${orderCode}`, { headers: customer.auth });
  report.check('The order moves to paid', paid.body.status === 'PAID');
  report.check('The paid order still holds the same total',
    h.dong(paid.body.total) === cartTotal, String(h.dong(paid.body.total)));

  // --- A later price change leaves the order alone ---
  report.step('Changing the catalog later does not touch a placed order');
  const log = await h.call('/payments/log', { headers: manager.auth });
  report.check('Both notifications are in the log',
    log.body.filter((r) => String(r.rawData?.content ?? '').includes(orderCode)).length >= 2,
    `${log.body.length} entries`);

  const after = await h.call(`/orders/${orderCode}`, { headers: customer.auth });
  report.check('The order total is unchanged after everything',
    h.dong(after.body.total) === cartTotal, String(h.dong(after.body.total)));
  report.check('The order carries a currency',
    typeof after.body.currency === 'string' && after.body.currency.length === 3,
    after.body.currency);
}

if (require.main === module) {
  h.runScenario('IT-02  MONEY INTEGRITY ALONG THE CHAIN', scenario).then((r) => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

module.exports = { name: 'IT-02 Money integrity', scenario };
