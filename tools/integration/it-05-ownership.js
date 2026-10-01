/**
 * IT-05 — One customer can never reach another customer's things.
 *
 * Every resource a customer owns is created by one account and then reached for
 * by a second account, by its real id. The rule the system follows is that a
 * non-owner is told the thing does not exist rather than that they may not see
 * it, so that the id itself gives nothing away.
 *
 * Run: node tools/integration/it-05-ownership.js
 */
const h = require('./harness');

/** Not found or forbidden both count as refused. Anything else is a leak. */
const PATCH = 'PATCH';

function refused(status) {
  return status === 404 || status === 403;
}

async function scenario(report) {
  const owner = await h.newCustomer('owner');
  const stranger = await h.newCustomer('stranger');
  const support = await h.signInInternal(h.ACCOUNT_SUPPORT);

  // --- Build one of everything, owned by the first account ---
  report.step('The first account creates one of everything');
  const pet = await h.call('/pets', {
    method: 'POST',
    headers: owner.auth,
    body: JSON.stringify({ name: 'Bong', kind: 'DOG', breed: 'Corgi', gender: 'FEMALE' }),
  });
  report.require('A pet', pet.status === 201, String(pet.status));

  const photo = await h.uploadPhoto(owner.auth, pet.body._id, 'FRONT', await h.makePhoto(900));
  report.require('A photo', photo.status === 201, String(photo.status));

  const design = await h.call('/designs', {
    method: 'POST',
    headers: owner.auth,
    body: JSON.stringify({
      name: 'Rieng tu',
      modelCode: 'TEMP-DOG',
      paint: [{ mesh: 'body', color: 'aabbccaabbccaabbcc' }],
    }),
  });
  report.require('A design', design.status === 201, String(design.status));

  const product = await h.call('/catalog/products/PT-02');
  const size = product.body.sizes.find((s) => s.enabled);
  await h.call('/cart/items', {
    method: 'POST',
    headers: owner.auth,
    body: JSON.stringify({ productTypeCode: 'PT-02', sizeCode: size.code, quantity: 1 }),
  });
  const order = await h.call('/orders', {
    method: 'POST',
    headers: owner.auth,
    body: JSON.stringify({
      fullName: 'Chu so huu',
      phone: '0955666777',
      address: '5 Duong IT',
      province: 'Nha Trang',
    }),
  });
  report.require('An order', order.status === 201, String(order.status));

  // --- The stranger tries each one ---
  report.step('The second account is refused on every one of them');
  const attempts = [
    ['read the pet', `/pets/${pet.body._id}`, 'GET'],
    ['edit the pet', `/pets/${pet.body._id}`, PATCH],
    ['delete the pet', `/pets/${pet.body._id}`, 'DELETE'],
    ['list the photos of that pet', `/pet-photos/${pet.body._id}`, 'GET'],
    ['read the photo bytes', `/pet-photos/${photo.body._id}/content`, 'GET'],
    ['restore the photo', `/pet-photos/${photo.body._id}/restore`, 'POST'],
    ['read the design', `/designs/${design.body._id}`, 'GET'],
    ['edit the design', `/designs/${design.body._id}`, PATCH],
    ['delete the design', `/designs/${design.body._id}`, 'DELETE'],
    ['read the order', `/orders/${order.body.orderCode}`, 'GET'],
    ['read the payment code', `/payments/qr/${order.body.orderCode}`, 'GET'],
  ];

  /*
   * The payload has to be valid, otherwise the request is turned away at the
   * boundary and the ownership check never runs, which would prove nothing.
   */
  const payload = {
    PATCH_DESIGN: { name: 'Doi ten', modelCode: 'TEMP-DOG' },
    PATCH_PET: { name: 'Doi ten' },
    POST: { operation: ['SHARPEN'] },
  };

  let allRefused = true;
  for (const [what, path, method] of attempts) {
    let body;
    if (method === 'POST') {
      body = JSON.stringify(payload.POST);
    } else if (method === PATCH) {
      body = JSON.stringify(what.includes('design') ? payload.PATCH_DESIGN : payload.PATCH_PET);
    }
    const res = await h.call(path, { method, headers: stranger.auth, body });
    if (!refused(res.status)) {
      allRefused = false;
      report.check(`Refuses ${what}`, false, String(res.status));
    }
  }
  report.check(`All ${attempts.length} attempts on another account are refused`, allRefused);

  // --- And the answer gives nothing away ---
  report.step('The answer does not admit the thing exists');
  const real = await h.call(`/designs/${design.body._id}`, { headers: stranger.auth });
  const imaginary = await h.call('/designs/000000000000000000000000', { headers: stranger.auth });
  report.check('A real id and an imaginary one answer the same way',
    real.status === imaginary.status, `${real.status} vs ${imaginary.status}`);

  // --- A design owned by someone else cannot be smuggled into a cart ---
  report.step('Another account cannot attach that design to its own order');
  const smuggled = await h.call('/cart/items', {
    method: 'POST',
    headers: stranger.auth,
    body: JSON.stringify({
      productTypeCode: 'PT-02',
      sizeCode: size.code,
      quantity: 1,
      designId: design.body._id,
    }),
  });
  report.check('The design of another account is refused in the cart',
    refused(smuggled.status), String(smuggled.status));

  // --- A customer cannot reach the internal screens ---
  report.step('A customer cannot reach the internal screens');
  const internal = [
    ['the dispatch board', '/admin/orders'],
    ['the customer list', '/admin/customers'],
    ['the payment log', '/payments/log'],
    ['the business settings', '/settings'],
    ['the production file', `/admin/orders/${order.body.orderCode}/production-file`],
  ];
  let allBlocked = true;
  for (const [what, path] of internal) {
    const res = await h.call(path, { headers: stranger.auth });
    if (res.status !== 403) {
      allBlocked = false;
      report.check(`Blocks a customer from ${what}`, false, String(res.status));
    }
  }
  report.check(`All ${internal.length} internal screens are blocked to a customer`, allBlocked);

  // --- Internal staff see only what their role allows ---
  report.step('Internal roles are separated from each other');
  /*
   * Nhom quan tri tai khoan khong doc duoc don hang.
   *
   * Tu khi rut xuong ba nhom quyen, nhom nay chi quan ly tai khoan va khong
   * cham vao don hang hay tien nua.
   */
  const supportReads = await h.call(`/admin/orders/${order.body.orderCode}`, { headers: support.auth });
  report.check('The account admin group cannot read an order',
    supportReads.status === 403, String(supportReads.status));

  const supportWrites = await h.call(`/admin/orders/${order.body.orderCode}/status`, {
    method: 'PATCH',
    headers: support.auth,
    body: JSON.stringify({ status: 'CANCELLED', reason: 'IT thu quyen' }),
  });
  report.check('Support cannot move an order', supportWrites.status === 403,
    String(supportWrites.status));

  const supportSettings = await h.call('/settings', { headers: support.auth });
  report.check('Support cannot read the business settings',
    supportSettings.status === 403, String(supportSettings.status));

  const supportPalette = await h.call('/catalog/colors', {
    method: 'POST',
    headers: support.auth,
    body: JSON.stringify({
      code: 'IT-TEST',
      displayName: 'Thu quyen',
      swatch: '#123456',
      group: 'FUR',
    }),
  });
  report.check('Support cannot add a wool colour',
    supportPalette.status === 403, String(supportPalette.status));

  // --- Signed out reaches nothing owned ---
  report.step('Signed out reaches nothing that belongs to anybody');
  let allUnauthorised = true;
  for (const path of ['/pets', '/cart', '/orders', '/designs', '/favourites/codes']) {
    const res = await h.call(path);
    if (res.status !== 401) {
      allUnauthorised = false;
      report.check(`Signed out is refused at ${path}`, false, String(res.status));
    }
  }
  report.check('Every owned collection needs a session', allUnauthorised);
}

if (require.main === module) {
  h.runScenario('IT-05  OWNERSHIP AND ROLE SEPARATION', scenario).then((r) => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

module.exports = { name: 'IT-05 Ownership', scenario };
