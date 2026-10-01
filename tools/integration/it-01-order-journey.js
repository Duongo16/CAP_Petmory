/**
 * IT-01 — One order, end to end, across every module it touches.
 *
 * Follows a single customer from signing up to leaving a review, and checks at
 * each handover that what one module produced is what the next module received.
 * The per-module suites already prove each step works on its own. This proves
 * they fit together.
 *
 * Modules crossed: auth, pets, photos, designs, catalog, cart, orders,
 * payments, admin, production file, reviews.
 *
 * Run: node tools/integration/it-01-order-journey.js
 */
const h = require('./harness');

/** A valid paint set: three faces, six hexadecimal characters each. */
const PAINT = [{ mesh: 'body', color: 'c98b4bc98b4bc98b4b' }];

async function scenario(report) {
  const customer = await h.newCustomer('journey');
  const manager = await h.signInInternal(h.ACCOUNT_MANAGER);
  const workshop = await h.signInInternal(h.ACCOUNT_WORKSHOP);

  // --- Pet profile ---
  report.step('A pet profile is created');
  const pet = await h.call('/pets', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ name: 'Mun', kind: 'CAT', breed: 'Mèo ta', gender: 'MALE' }),
  });
  report.require('The pet is created', pet.status === 201, String(pet.status));
  const petId = pet.body._id;

  // --- Photo, then restore, then confirm ---
  report.step('A photo is uploaded, restored and confirmed');
  const photo = await h.uploadPhoto(customer.auth, petId, 'FRONT', await h.makePhoto(1200));
  report.require('The photo is accepted', photo.status === 201, String(photo.status));
  report.check('The photo is scored', typeof photo.body.quality?.sharpness === 'number',
    `sharpness ${photo.body.quality?.sharpness}`);

  const restored = await h.call(`/pet-photos/${photo.body._id}/restore`, {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ operation: ['SHARPEN', 'UPSCALE'] }),
  });
  report.require('The restored version is created', restored.status === 201, String(restored.status));
  report.check('The restored version points back at the original',
    restored.body.originalPhoto === photo.body._id);
  report.check('The restoration is scored for resemblance',
    typeof restored.body.resemblance === 'number',
    `${restored.body.resemblance}%`);
  report.check('The restored version is not usable before the customer confirms',
    restored.body.confirmedByOwner === false);

  const confirmed = await h.call(`/pet-photos/${restored.body._id}/confirm`, {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ accept: true }),
  });
  report.check('The customer can confirm it', confirmed.status === 201 || confirmed.status === 200,
    String(confirmed.status));

  // --- Design ---
  report.step('A design is saved against that pet');
  const product = await h.call('/catalog/products/PT-01');
  const size = product.body.sizes.find((s) => s.enabled);
  const catalogPrice = h.dong(size.price);

  const design = await h.call('/designs', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      name: 'Ban thiet ke cua Mun',
      modelCode: 'TEMP-CAT',
      productTypeCode: 'PT-01',
      sizeCode: size.code,
      pet: petId,
      paint: PAINT,
      colorCodesUsed: ['WOOL-W01'],
      engraving: { message: 'Mun' },
    }),
  });
  report.require('The design is saved', design.status === 201, String(design.status));
  const designId = design.body._id;

  // --- Cart ---
  report.step('The design goes into the cart with a stand');
  const cart = await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: size.code,
      quantity: 1,
      designId,
      displayBaseCode: 'BASE-ROUND',
    }),
  });
  report.require('The line is added', cart.status === 201, String(cart.status));
  const line = cart.body.items[0];
  const base = await h.call('/catalog/display-bases');
  const baseDelta = h.dong(base.body.find((b) => b.code === 'BASE-ROUND').priceDelta);

  report.check('The cart carries the design', line.designId === designId);
  report.check('The cart carries the stand', line.displayBaseCode === 'BASE-ROUND',
    line.displayBaseName);
  report.check('The cart price is the size price plus the stand',
    h.dong(line.unitPrice) === catalogPrice + baseDelta,
    `${catalogPrice} + ${baseDelta} = ${line.unitPrice}`);

  // --- Order ---
  report.step('The cart becomes an order');
  const order = await h.call('/orders', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      fullName: 'Khach IT',
      phone: '0909090909',
      address: '1 Duong IT',
      province: 'Da Nang',
      note: 'Giao gio hanh chinh',
    }),
  });
  report.require('The order is created', order.status === 201, String(order.status));
  const orderCode = order.body.orderCode;
  const orderTotal = h.dong(order.body.total);

  report.check('The order keeps the price the cart had',
    orderTotal === catalogPrice + baseDelta, `${orderTotal}`);
  report.check('The order starts awaiting payment', order.body.status === 'AWAITING_PAYMENT');
  report.check('The order carries the design', order.body.rows[0].designId === designId);
  report.check('The order carries the stand', order.body.rows[0].displayBaseCode === 'BASE-ROUND');

  const emptied = await h.call('/cart', { headers: customer.auth });
  report.check('The cart is emptied once the order is placed', emptied.body.items.length === 0);

  // --- Payment ---
  report.step('The money arrives and the order moves itself');
  const qr = await h.call(`/payments/qr/${orderCode}`, { headers: customer.auth });
  report.require('A payment code is generated', qr.status === 200, String(qr.status));
  report.check('The payment code carries the order total',
    h.dong(qr.body.amount) === orderTotal, String(qr.body.amount));
  report.check('The transfer message carries the reference',
    String(qr.body.transferMessage ?? '').includes(order.body.reference),
    qr.body.transferMessage);

  const transfer = await h.sendTransfer(orderCode, Number(orderTotal));
  report.require('The notification matches the order', transfer.body.result === 'MATCHED',
    transfer.body.result);

  const paid = await h.call(`/orders/${orderCode}`, { headers: customer.auth });
  report.check('The order is now paid', paid.body.status === 'PAID');
  report.check('The order records when it was paid', Boolean(paid.body.paidAt));

  // --- Workshop ---
  report.step('The workshop picks it up and the production file is complete');
  const file = await h.call(`/admin/orders/${orderCode}/production-file`, { headers: manager.auth });
  report.require('The production file opens', file.status === 200, String(file.status));
  const item = file.body.items[0];
  report.check('The file names the base model', item.modelCode === 'TEMP-CAT', item.modelCode);
  report.check('The file turns the colour code into a readable name',
    item.woolRolls?.[0]?.displayName?.length > 0, item.woolRolls?.[0]?.displayName);
  report.check('The file carries the engraving', item.engraving?.message === 'Mun');
  report.check('The file lists the pet photos', file.body.petPhoto.length >= 1,
    `${file.body.petPhoto.length} photos`);
  report.check('The file reports nothing missing beyond the previews',
    !file.body.missing.includes('NO_DESIGN') && !file.body.missing.includes('NO_COLOR_CODES'),
    JSON.stringify(file.body.missing));

  // --- The order holds its own copy of the design ---
  /*
   * There is no separate approval step in this product, so the copy taken at
   * order time is the only record of what the customer agreed to. Editing or
   * removing the design afterwards must not reach into an order already made.
   */
  report.step('Editing the design afterwards does not change the order');
  const changed = await h.call(`/designs/${designId}`, {
    method: 'PATCH',
    headers: customer.auth,
    body: JSON.stringify({
      name: 'Ban da sua sau khi dat',
      modelCode: 'TEMP-DOG',
      productTypeCode: 'PT-01',
      sizeCode: size.code,
      paint: [{ mesh: 'Body', color: 'ff0000' }],
      colorCodesUsed: ['WOOL-W02'],
      engraving: { name: 'Doi ten', message: 'Doi loi' },
    }),
  });
  report.require('The design itself can still be edited', changed.status === 200,
    String(changed.status));

  const afterEdit = await h.call(`/admin/orders/${orderCode}/production-file`, {
    headers: manager.auth,
  });
  const keptItem = afterEdit.body.items[0];
  report.check('The production file keeps the model that was ordered',
    keptItem.modelCode === 'TEMP-CAT', keptItem.modelCode);
  report.check('The production file keeps the engraving that was ordered',
    keptItem.engraving?.message === 'Mun', keptItem.engraving?.message);

  const dropped = await h.call(`/designs/${designId}`, {
    method: 'DELETE',
    headers: customer.auth,
  });
  report.require('The design can be removed', dropped.status === 200, String(dropped.status));

  const afterDrop = await h.call(`/admin/orders/${orderCode}/production-file`, {
    headers: manager.auth,
  });
  report.check('Removing the design leaves the production file readable',
    afterDrop.status === 200, String(afterDrop.status));
  report.check('And the file still names what was ordered',
    afterDrop.body.items[0].modelCode === 'TEMP-CAT', afterDrop.body.items[0].modelCode);

  // --- Through the workshop to the customer ---
  report.step('The order is walked through to delivered');
  const walk = ['IN_PRODUCTION', 'SHIPPING', 'COMPLETED'];
  let allMoved = true;
  for (const status of walk) {
    // Khong roi khau kiem dinh khi phieu con muc chua tich.
    if (status === 'SHIPPING') {
      await h.passQualityCheck(orderCode, manager);
    }
    const moved = await h.call(`/admin/orders/${orderCode}/status`, {
      method: 'PATCH',
      headers: workshop.auth,
      body: JSON.stringify({ status, reason: `IT chuyen sang ${status}` }),
    });
    if (moved.status !== 200) {
      allMoved = false;
      report.check(`Moves to ${status}`, false, String(moved.status));
    }
  }
  report.check('Every step from paid to delivered is allowed', allMoved);

  // --- Audit trail ---
  report.step('Every move left a trace');
  const detail = await h.call(`/admin/orders/${orderCode}`, { headers: manager.auth });
  const history = detail.body.history ?? [];
  report.check('The history covers creation and every move',
    history.length >= walk.length + 1, `${history.length} entries`);
  report.check('The history records who did it',
    history.some((e) => e.actor?.email === h.ACCOUNT_WORKSHOP));
  report.check('The history records the reason given',
    history.some((e) => String(e.reason ?? '').includes('IT chuyen sang')));

  // --- Review ---
  report.step('A delivered order lets the customer rate the product');
  const pending = await h.call('/reviews/pending', { headers: customer.auth });
  report.check('The product shows up as reviewable',
    pending.body.some((r) => r.productTypeCode === 'PT-01' && r.orderCode === orderCode),
    `${pending.body.length} pending`);

  const review = await h.call('/reviews', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      orderCode,
      rating: 5,
      comment: 'Giong be that',
    }),
  });
  report.require('The review is accepted', review.status === 201, String(review.status));

  const rated = await h.call('/catalog/products/PT-01');
  report.check('The rating now shows on the product',
    rated.body.rating.count >= 1 && rated.body.rating.average > 0,
    `${rated.body.rating.average} from ${rated.body.rating.count}`);

  const listed = await h.call('/reviews/product/PT-01');
  report.check('The review is listed with its author',
    listed.body.some((r) => r.comment === 'Giong be that' && r.authorName.length > 0));
}

if (require.main === module) {
  h.runScenario('IT-01  ORDER JOURNEY, END TO END', scenario).then((r) => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

module.exports = { name: 'IT-01 Order journey', scenario };
