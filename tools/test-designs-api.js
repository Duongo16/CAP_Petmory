/**
 * Design test: saving and reopening a draft, quoting from the server,
 * the six preview images, carrying a design through the cart into an order,
 * and the production file for the workshop.
 * Run: node tools/test-designs-api.js
 */
const sharp = require('sharp');

const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = 'change-this-key-before-running';
const PASSWORD_INTERNAL = 'Petmory@2026';
const ANGLES = ['FRONT', 'LEFT', 'RIGHT', 'BACK', 'TOP', 'ISO'];

let passed = 0;
let failed = 0;

function check(name, ok, note = '') {
  console.log(`  ${ok ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  ok ? (passed += 1) : (failed += 1);
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function register(fullName) {
  const email = `tk.${Date.now()}.${Math.floor(Math.random() * 1000)}@petmory.local`;
  const res = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@123', fullName }),
  });
  return { email, token: res.body.accessToken, id: res.body.user.id };
}

async function login(email, password) {
  const res = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.body?.accessToken ?? null;
}

/** A stand-in preview image, in the same raster format the browser produces. */
async function pngImage(edge = 400) {
  return sharp({
    create: { width: edge, height: edge, channels: 3, background: '#c98b4b' },
  })
    .png()
    .toBuffer();
}

async function loadPhoto(token, designId, angle, data) {
  const form = new FormData();
  form.append('angle', angle);
  form.append('file', new Blob([data], { type: 'image/png' }), `${angle}.png`);
  const res = await fetch(`${API}/designs/${designId}/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** One valid paint passed: three faces, six hexadecimal characters each. */
const PAINT_COLOR = [{ mesh: 'than', color: 'c98b4b' + '2b1b12' + 'ffffff' }];

async function run() {
  console.log('DESIGN AND PRODUCTION FILE TEST');
  console.log('='.repeat(68));

  const customer = await register('Le Van Thiet Ke');

        // --- The quote always comes from the server ---
  const bg = await call('/designs/quote?productTypeCode=PT-01&sizeCode=FIG-M', {
    headers: authHeaders(customer.token),
  });
  check('The quote comes from the catalog', bg.status === 200 && bg.body.unitPrice === '750000',
    `${bg.body?.unitPrice} ${bg.body?.currency}`);
  check('The quote carries the production time', bg.body.productionDays > 0,
    `${bg.body?.productionDays} ngay`);

  const bgLa = await call('/designs/quote?productTypeCode=PT-01&sizeCode=NOT-SIZE', {
    headers: authHeaders(customer.token),
  });
  check('A size that does not exist returns not found', bgLa.status === 404, String(bgLa.status));

        // --- Save a draft ---
  const pet = await call('/pets', {
    method: 'POST',
    headers: authHeaders(customer.token),
    body: JSON.stringify({ name: 'Shadow', kind: 'Meo' }),
  });

  const create = await call('/designs', {
    method: 'POST',
    headers: authHeaders(customer.token),
    body: JSON.stringify({
      name: 'Ban nhap cua Bong',
      modelCode: 'TEMP-CAT',
      paint: PAINT_COLOR,
      colorCodesUsed: ['WOOL-W01', 'WOOL-B01', 'CODE-NOT-SIZE'],
      productTypeCode: 'PT-01',
      sizeCode: 'FIG-M',
      engraving: { name: 'Shadow', memorialDate: '2019-05-20', message: 'Nho be nhieu' },
      pet: pet.body._id,
    }),
  });
  check('A draft can be saved', create.status === 201, String(create.status));
  const designId = create.body?._id;

  const open = await call(`/designs/${designId}`, { headers: authHeaders(customer.token) });
  check('Reopening a draft gives back the painted colours',
    open.body?.paint?.[0]?.color === PAINT_COLOR[0].color,
    open.body?.paint?.[0]?.color);
  check('Reopening a draft gives back the engraving', open.body?.engraving?.name === 'Shadow');
  check('Reopening a draft gives back the colour codes used',
    JSON.stringify(open.body?.colorCodesUsed) === JSON.stringify(['WOOL-W01', 'WOOL-B01', 'CODE-NOT-SIZE']));

        // --- Reject malformed paint data ---
  const badCases = [
    ['A colour string of the wrong length', { paint: [{ mesh: 'than', color: 'abcde' }] }],
    ['A colour string with an invalid character', { paint: [{ mesh: 'than', color: 'zzzzzz' }] }],
    ['A colour string in uppercase', { paint: [{ mesh: 'than', color: 'ABCDEF' }] }],
    ['A model code with a slash in it', { modelCode: '../../etc/passwd' }],
    ['A model code with a space in it', { modelCode: 'con meo' }],
    ['An empty model code', { modelCode: '' }],
    ['A malformed colour code', { colorCodesUsed: ['len w01'] }],
    ['An engraving message that is too long', { engraving: { message: 'x'.repeat(400) } }],
    ['A size that does not exist', { sizeCode: 'NOT-SIZE' }],
  ];
  for (const [name, part] of badCases) {
    const res = await call('/designs', {
      method: 'POST',
      headers: authHeaders(customer.token),
      body: JSON.stringify({
        name: 'Thu du lieu xau',
        modelCode: 'TEMP-CAT',
        productTypeCode: 'PT-01',
        sizeCode: 'FIG-M',
        ...part,
      }),
    });
    const expected = name === 'A size that does not exist' ? 404 : 400;
    check(`Chan ${name.toLowerCase()}`, res.status === expected, String(res.status));
  }

        // --- The six preview images ---
  const photo = await pngImage();
  for (const angle of ANGLES) {
    await loadPhoto(customer.token, designId, angle, photo);
  }
  const afterWhenLoad = await call(`/designs/${designId}`, { headers: authHeaders(customer.token) });
  check('All six preview angles can be saved', afterWhenLoad.body.preview.length === 6,
    `${afterWhenLoad.body?.preview?.length} angles`);

  await loadPhoto(customer.token, designId, 'FRONT', photo);
  const reload = await call(`/designs/${designId}`, { headers: authHeaders(customer.token) });
  check('Uploading the same angle replaces it rather than adding',
    reload.body.preview.length === 6);

  const nonImage = await loadPhoto(customer.token, designId, 'FRONT', Buffer.from('this is not an image'));
  check('Rejects a file that is not an image', nonImage.status === 400, String(nonImage.status));

  const jpgImage = await sharp(photo).jpeg().toBuffer();
  const wrongType = await loadPhoto(customer.token, designId, 'FRONT', jpgImage);
  check('Rejects an image that is not a raster format', wrongType.status === 400, String(wrongType.status));

  const readPhoto = await fetch(`${API}/designs/${designId}/preview/FRONT`, {
    headers: { Authorization: `Bearer ${customer.token}` },
  });
  check('A preview image can be read back',
    readPhoto.status === 200 && readPhoto.headers.get('content-type') === 'image/png');

        // --- Ownership ---
  const otherUser = await register('Nguoi khac');
  check('Another user cannot open the design',
    (await call(`/designs/${designId}`, { headers: authHeaders(otherUser.token) })).status === 404);
  const stealPreview = await fetch(`${API}/designs/${designId}/preview/FRONT`, {
    headers: { Authorization: `Bearer ${otherUser.token}` },
  });
  check('Another user cannot view the preview', stealPreview.status === 404, String(stealPreview.status));
  check('Signed out requests cannot open it', (await call(`/designs/${designId}`)).status === 401);

        // --- Carrying a design through the cart into an order ---
  const addForeignDesign = await call('/cart/items', {
    method: 'POST',
    headers: authHeaders(otherUser.token),
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: 'FIG-M',
      quantity: 1,
      designId: designId,
    }),
  });
  check('A design owned by another user cannot be added to the cart', addForeignDesign.status === 404,
    String(addForeignDesign.status));

  await call('/cart/items', {
    method: 'POST',
    headers: authHeaders(customer.token),
    body: JSON.stringify({
      productTypeCode: 'PT-01',
      sizeCode: 'FIG-M',
      quantity: 1,
      designId: designId,
      petName: 'Shadow',
    }),
  });
  const cart = await call('/cart', { headers: authHeaders(customer.token) });
  check('The cart carries the design id', cart.body.items[0].designId === designId);
  check('The cart price matches the quote', cart.body.items[0].unitPrice === '750000',
    cart.body?.items?.[0]?.unitPrice);

  const order = await call('/orders', {
    method: 'POST',
    headers: authHeaders(customer.token),
    body: JSON.stringify({
      fullName: 'Le Van Thiet Ke',
      phone: '0912345678',
      address: '5 Duong DEF',
      province: 'Hue',
    }),
  });
  const orderCode = order.body.orderCode;
  check('The order carries the design id', order.body.rows[0].designId === designId);

  await call('/payments/webhook', {
    method: 'POST',
    headers: { Authorization: `Apikey ${WEBHOOK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `tk-${Date.now()}`,
      transferAmount: 750000,
      content: `CT DEN ${orderCode}`,
    }),
  });

        // --- Production file ---
  const managerToken = await login('quanly@petmory.local', PASSWORD_INTERNAL);
  const supportToken = await login('cskh@petmory.local', PASSWORD_INTERNAL);

  const file = await call(`/admin/orders/${orderCode}/production-file`, { headers: authHeaders(managerToken) });
  check('The production file can be opened', file.status === 200, String(file.status));
  const item = file.body?.items?.[0];
  check('The production file names the base model', item?.modelCode === 'TEMP-CAT', item?.modelCode);
  check('The production file turns colour codes into readable names',
    item?.woolRolls?.length === 3 &&
      item.woolRolls[0].displayName === 'Trắng tuyết' &&
      item.woolRolls[1].displayName === 'Nâu nhạt',
    item?.woolRolls?.map((c) => `${c.code} = ${c.displayName}`).join(' | '));
        // An unknown colour code must not spoil the whole file; that code is simply shown as it is
  check('An unknown colour code still shows without spoiling the file',
    item?.woolRolls?.[2]?.code === 'CODE-NOT-SIZE' &&
      item.woolRolls[2].displayName === 'CODE-NOT-SIZE' &&
      item.woolRolls[2].swatch === '');
  check('The production file carries the engraving', item?.engraving?.name === 'Shadow');
  check('The production file carries all six preview angles', item?.anglesPreview?.length === 6);
  check('The production file carries the delivery address', file.body?.delivery?.province === 'Hue');
  check('The production file lists the pet photos', Array.isArray(file.body?.petPhoto));
  check('Nothing is reported missing when the order is complete',
    Array.isArray(file.body?.missing) && file.body.missing.length === 0,
    (file.body?.missing ?? []).join(','));

  const photoInternal = await fetch(`${API}/admin/designs/${designId}/preview/ISO`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  check('Internal staff can view the design images of a customer', photoInternal.status === 200,
    String(photoInternal.status));

  check('Support cannot open the production file',
    (await call(`/admin/orders/${orderCode}/production-file`, { headers: authHeaders(supportToken) }))
      .status === 403);
  check('A customer cannot open the production file',
    (await call(`/admin/orders/${orderCode}/production-file`, { headers: authHeaders(customer.token) }))
      .status === 403);

        // --- An order with no design must be reported as incomplete ---
  const khach2 = await register('Khach khong thiet ke');
  await call('/cart/items', {
    method: 'POST',
    headers: authHeaders(khach2.token),
    body: JSON.stringify({ productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 1 }),
  });
  const don2 = await call('/orders', {
    method: 'POST',
    headers: authHeaders(khach2.token),
    body: JSON.stringify({
      fullName: 'Khach khong thiet ke',
      phone: '0911111111',
      address: '1 Duong GHI',
      province: 'Ha Noi',
    }),
  });
  const hs2 = await call(`/admin/orders/${don2.body.orderCode}/production-file`, {
    headers: authHeaders(managerToken),
  });
  check('Reports a missing design when the order has none',
    (hs2.body?.missing ?? []).includes('NO_DESIGN'),
    (hs2.body?.missing ?? []).join(','));

        // --- Editing and deleting a draft ---
  const update = await call(`/designs/${designId}`, {
    method: 'PATCH',
    headers: authHeaders(customer.token),
    body: JSON.stringify({
      name: 'Ban nhap da sua',
      modelCode: 'TEMP-CAT',
      productTypeCode: 'PT-01',
      sizeCode: 'FIG-L',
    }),
  });
  check('A draft can be edited', update.status === 200 && update.body.name === 'Ban nhap da sua');
  check('Changing the size is recorded', update.body.sizeCode === 'FIG-L');

  const remove = await call(`/designs/${designId}`, { method: 'DELETE', headers: authHeaders(customer.token) });
  check('A draft is soft deleted', remove.status === 200);
  check('Once deleted it is gone from the list',
    (await call('/designs', { headers: authHeaders(customer.token) })).body.every((x) => x._id !== designId));

  const fileAfterDelete = await call(`/admin/orders/${orderCode}/production-file`, {
    headers: authHeaders(managerToken),
  });
  check('A placed order still reads its design after the customer deletes the draft',
    fileAfterDelete.body?.items?.[0]?.modelCode === 'TEMP-CAT',
    fileAfterDelete.body?.items?.[0]?.modelCode);

  console.log('='.repeat(68));
  console.log(failed === 0 ? `ALL ${passed} CHECKS PASSED` : `${failed}/${passed + failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
