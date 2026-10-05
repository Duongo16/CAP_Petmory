const madeToOrder = require('../lib/made-to-order');
/**
 * Shared harness for the integration tests.
 *
 * The suites under tools/ each exercise one module. These exercise a business
 * journey that crosses several modules at once, so the harness gives them a
 * single way to sign accounts up, carry a session, call the API, and report.
 *
 * Every run makes its own accounts with a unique name, so two runs never fight
 * over the same data and a run can be repeated without clearing the database.
 */
const sharp = require('sharp');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const WEBHOOK_KEY = process.env.SEPAY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const PASSWORD = 'Password@123';
const INTERNAL_PASSWORD = 'Petmory@2026';

const ACCOUNT_MANAGER = 'quanly@petmory.local';
const ACCOUNT_WORKSHOP = 'quanly@petmory.local';
const ACCOUNT_SUPPORT = 'cskh@petmory.local';

/** Collects the outcome of one scenario so the runner can total them up. */
class Report {
  constructor(name) {
    this.name = name;
    this.passed = 0;
    this.failed = 0;
    this.stepName = '';
  }

  /** Starts a named step. Steps only group the output, they assert nothing. */
  step(text) {
    this.stepName = text;
    console.log(`\n  ${text}`);
  }

  check(text, ok, note = '') {
    if (ok) {
      this.passed += 1;
    } else {
      this.failed += 1;
    }
    console.log(`    ${ok ? 'PASS  ' : 'FAIL  '} ${text}${note ? '  ' + note : ''}`);
    return Boolean(ok);
  }

  /** Same as check, but stops the scenario when it fails. */
  require(text, ok, note = '') {
    const result = this.check(text, ok, note);
    if (!result) {
      throw new Error(`stopped at: ${text}`);
    }
    return result;
  }
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

/** A throwaway customer, unique to this run. */
async function newCustomer(label) {
  const email = `it.${label}.${Date.now()}.${Math.floor(Math.random() * 10000)}@petmory.local`;
  const res = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, fullName: `IT ${label}` }),
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`could not register ${label}: ${res.status}`);
  }
  return {
    email,
    id: res.body.user.id ?? res.body.user._id,
    token: res.body.accessToken,
    auth: authHeaders(res.body.accessToken),
  };
}

/**
 * Mot ban thiet ke hop le cho dong hang tuy bien (muc 7): be du anh toi thieu
 * cua kich co, ban thiet ke gan be va kich co. Tra ve ma ban thiet ke.
 */
async function readyDesign(customer, productTypeCode = 'PT-01', sizeCode = 'FIG-M') {
  const made = await madeToOrder.readyDesign(customer.token, { productTypeCode, sizeCode });
  return made.designId;
}

/** One of the three seeded internal accounts. */
async function signInInternal(email) {
  const res = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: INTERNAL_PASSWORD }),
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`could not sign in ${email}: ${res.status}`);
  }
  return { email, token: res.body.accessToken, auth: authHeaders(res.body.accessToken) };
}

/**
 * A sharp photo generated on the fly, so the tests need no external file.
 * Dense texture on purpose: a flat image scores badly and would confuse the
 * quality check the journey relies on.
 */
async function makePhoto(edge = 1200) {
  const cell = 40;
  const svg = [`<svg width="${edge}" height="${edge}">`];
  for (let y = 0; y < edge; y += cell) {
    for (let x = 0; x < edge; x += cell) {
      const shade = (x / cell + y / cell) % 2 === 0 ? '#3a2a18' : '#e8d8c0';
      svg.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${shade}"/>`);
    }
  }
  svg.push('</svg>');
  return sharp(Buffer.from(svg.join(''))).png().toBuffer();
}

/** Uploads one photo for a pet, through the same multipart path the browser uses. */
async function uploadPhoto(auth, petId, angle, data, fileName = 'photo.png') {
  const form = new FormData();
  form.append('angle', angle);
  form.append('file', new Blob([data], { type: 'image/png' }), fileName);
  const res = await fetch(`${API}/pet-photos/${petId}`, {
    method: 'POST',
    headers: { Authorization: auth.Authorization },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Sends a bank transfer notification exactly as the payment service would. */
async function sendTransfer(orderCode, amount, id = `it-${Date.now()}-${Math.random()}`) {
  return call('/payments/webhook', {
    method: 'POST',
    headers: { Authorization: `Apikey ${WEBHOOK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, transferAmount: amount, content: `CT DEN ${orderCode}` }),
  });
}

/** Whole dong, parsed from whichever shape the server used for the amount. */
function dong(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = typeof value === 'object' ? value.$numberDecimal : String(value);
  return BigInt(text.split('.')[0]);
}

/** Runs one scenario and reports it, turning a thrown error into a failure. */
async function runScenario(name, body) {
  const report = new Report(name);
  console.log(name);
  console.log('='.repeat(70));
  try {
    await body(report);
  } catch (error) {
    report.failed += 1;
    console.log(`    FAIL   scenario stopped: ${error.message}`);
  }
  console.log('');
  console.log('-'.repeat(70));
  const total = report.passed + report.failed;
  console.log(
    report.failed === 0
      ? `ALL ${total} CHECKS PASSED`
      : `${report.failed}/${total} CHECKS FAILED`,
  );
  return report;
}

/**
 * Tich het cac muc tren phieu kiem tra chat luong cua mot don.
 *
 * Tu khi phieu nay duoc dua vao, khong don nao roi khau kiem dinh khi con
 * muc chua tich. Moi kich ban di qua khau do deu phai lam buoc nay, dung
 * nhu nguoi that phai lam.
 */
async function passQualityCheck(orderCode, staff) {
  const seen = await call(`/admin/orders/${orderCode}`, { headers: staff.auth });
  const list = seen.body?.order?.qualityCheck ?? [];
  for (let at = 0; at < list.length; at += 1) {
    await call(`/admin/orders/${orderCode}/quality/${at}`, {
      method: 'PATCH',
      headers: staff.auth,
      body: JSON.stringify({ done: true }),
    });
  }
  return list.length;
}

module.exports = {
  passQualityCheck,
  API,
  PASSWORD,
  ACCOUNT_MANAGER,
  ACCOUNT_WORKSHOP,
  ACCOUNT_SUPPORT,
  call,
  authHeaders,
  newCustomer,
  readyDesign,
  signInInternal,
  makePhoto,
  uploadPhoto,
  sendTransfer,
  dong,
  runScenario,
};
