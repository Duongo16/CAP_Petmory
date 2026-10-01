/**
 * Tao tai khoan khach trinh dien kem du lieu that.
 *
 * Cac man hinh khi trong ron thi khong soat duoc bo cuc, vi thu can nhin la
 * cach cac the xep canh nhau khi co noi dung. Ban nay dung mot tai khoan khach
 * co ho so thu cung, anh, ky niem, ban thiet ke va mot don da thanh toan.
 *
 * Chay lai nhieu lan khong sao: tai khoan da co thi dung lai tai khoan do.
 *
 * Chay: node tools/seed-demo-customer.js
 */
const sharp = require('sharp');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const WEBHOOK_KEY = process.env.PETMORY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const WHO = { email: 'khachhang@petmory.local', password: 'Petmory@2026' };

async function call(where, options = {}) {
  const answer = await fetch(`${API}${where}`, options);
  const text = await answer.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: answer.status, body, text };
}

const asJson = (token, data, method = 'POST') => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(data),
});

const withToken = (token) => ({ headers: { authorization: `Bearer ${token}` } });

/** Mot buc anh co van va co mau, de diem chat luong khong bi cham la mo. */
async function madePhoto(shift) {
  const width = 1200;
  const height = 1200;
  const dots = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      const ring = Math.hypot(x - width / 2, y - height / 2) / 9;
      dots[at] = 210 + Math.round(30 * Math.sin(ring + shift));
      dots[at + 1] = 150 + Math.round(50 * Math.sin(ring * 0.7 + shift));
      dots[at + 2] = 90 + Math.round(40 * Math.cos(ring * 0.5 + shift));
    }
  }
  return sharp(dots, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

async function sendPhoto(token, petId, angle, shift) {
  const bytes = await madePhoto(shift);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), `${angle}.jpg`);
  form.append('angle', angle);
  const answer = await fetch(`${API}/pet-photos/${petId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return answer.status;
}

/** Dang nhap, hoac dang ky neu tai khoan chua co. */
async function tokenOf() {
  const login = await call('/auth/login', asJson(null, WHO));
  if (login.status === 200 || login.status === 201) {
    console.log('Tai khoan khach da co san, dung lai.');
    return login.body.accessToken;
  }
  const made = await call(
    '/auth/register',
    asJson(null, { ...WHO, fullName: 'Khach hang PETMORY' }),
  );
  if (!made.body?.accessToken) {
    console.log('Khong tao duoc tai khoan:', made.text.slice(0, 200));
    process.exit(1);
  }
  console.log('Da tao tai khoan khach trinh dien.');
  return made.body.accessToken;
}

const PETS = [
  {
    name: 'Mochi',
    kind: 'DOG',
    breed: 'Corgi',
    gender: 'MALE',
    tagline: 'Chu cho ngan chan thich nam suoi nang ben cua so',
    birthDate: '2021-04-12',
  },
  {
    name: 'Nuoc Tuong',
    kind: 'CAT',
    breed: 'Muop co',
    gender: 'FEMALE',
    tagline: 'Co meo hay giau dep ca nha vao gam ghe',
    birthDate: '2020-09-03',
  },
];

const MOMENTS = [
  { title: 'Ngay dau ve nha', topic: 'FIRST_DAY', place: 'Ha Noi', isMilestone: true, days: 900 },
  { title: 'Lan dau di bien', topic: 'OUTING', place: 'Do Son', isMilestone: true, days: 420 },
  { title: 'Buoi chieu trong san', topic: 'EVERYDAY', place: 'San sau', isMilestone: false, days: 120 },
  { title: 'Sinh nhat mot tuoi', topic: 'BIRTHDAY', place: 'Nha', isMilestone: true, days: 60 },
];

async function run() {
  console.log('NAP DU LIEU CHO TAI KHOAN KHACH TRINH DIEN');
  console.log('='.repeat(62));
  const token = await tokenOf();

  const already = await call('/pets', withToken(token));
  let pets = already.body ?? [];

  if (pets.length === 0) {
    for (const one of PETS) {
      const made = await call('/pets', asJson(token, one));
      if (made.body?._id) {
        pets.push(made.body);
        console.log(`  ho so    ${one.name} da tao`);
      } else {
        console.log(`  ho so    ${one.name} khong tao duoc: ${made.text.slice(0, 120)}`);
      }
    }
  } else {
    console.log(`  ho so    da co ${pets.length} be, giu nguyen`);
  }

  const first = pets[0];
  if (!first) {
    console.log('Khong co ho so nao de nap tiep.');
    return;
  }

  const shots = await call(`/pet-photos?pet=${first._id}`, withToken(token));
  if (!Array.isArray(shots.body) || shots.body.length === 0) {
    const angles = ['FRONT', 'LEFT_SIDE', 'RIGHT_SIDE', 'BACK'];
    for (let at = 0; at < angles.length; at += 1) {
      const code = await sendPhoto(token, first._id, angles[at], at * 1.3);
      console.log(`  anh      ${angles[at]} ${code}`);
    }
  } else {
    console.log(`  anh      da co ${shots.body.length} tam, giu nguyen`);
  }

  const book = await call(`/memories/pet/${first._id}`, withToken(token));
  if ((book.body?.rows ?? []).length === 0) {
    for (const one of MOMENTS) {
      const when = new Date(Date.now() - one.days * 86400000).toISOString();
      const made = await call(
        '/memories',
        asJson(token, {
          pet: first._id,
          title: one.title,
          body: 'Mot ngay dang nho, ghi lai de sau nay con doc lai.',
          happenedAt: when,
          place: one.place,
          topic: one.topic,
          isMilestone: one.isMilestone,
          tag: ['kyniem', 'giadinh'],
        }),
      );
      console.log(`  ky niem  ${one.title} ${made.status}`);
    }
  } else {
    console.log(`  ky niem  da co ${book.body.rows.length} muc, giu nguyen`);
  }

  /* Mot don da thanh toan, de man hinh don hang va dieu phoi co du lieu that. */
  const orders = await call('/orders', withToken(token));
  if ((orders.body?.rows ?? orders.body ?? []).length === 0) {
    const goods = await call('/goods');
    const item = goods.body?.rows?.[0];
    const sku = item?.variant?.find((each) => each.enabled && each.stock > 0);
    if (sku) {
      await call('/cart', { method: 'DELETE', ...withToken(token) });
      await call('/cart/goods', asJson(token, { goodsCode: item.code, sku: sku.sku, quantity: 1 }));
      const order = await call(
        '/orders',
        asJson(token, {
          fullName: 'Khach hang PETMORY',
          phone: '0912345678',
          address: '18 Duong Lang Ha, Phuong Thanh Cong',
          province: 'Ha Noi',
        }),
      );
      const code = order.body?.orderCode;
      if (code) {
        const raw = order.body.total;
        const amount = Number(
          String(typeof raw === 'object' && raw ? raw.$numberDecimal : raw).split('.')[0],
        );
        await call('/payments/webhook', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Apikey ${WEBHOOK_KEY}` },
          body: JSON.stringify({
            id: `demo-${code}`,
            transferAmount: amount,
            content: `CT DEN ${code}`,
          }),
        });
        console.log(`  don      ${code} da dat va da thanh toan`);
      }
    }
  } else {
    console.log('  don      da co don, giu nguyen');
  }

  console.log('-'.repeat(62));
  console.log(`Dang nhap bang ${WHO.email} / ${WHO.password}`);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
