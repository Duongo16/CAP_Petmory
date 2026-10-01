/**
 * Fills the demo customer's diaries with real pet photographs and laid-out pages.
 *
 * Photographs come from two free public image services: dog.ceo for dogs and
 * thecatapi.com for cats. Each one is shrunk and saved as JPEG, uploaded into
 * the pet's album, then used by about a dozen diary pages spread over the past
 * fourteen months, each page arranged with one of the diary layouts.
 *
 * Safe to run again: a pet whose diary already holds seeded pages is skipped.
 *
 * Run: node tools/seed-diary-photos.js
 */
const sharp = require('sharp');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const WHO = { email: 'khachhang@petmory.local', password: 'Petmory@2026' };
const SEED_TAG = 'nhatkymau';
const ALBUM_MAX = 20;
const NEW_PHOTOS = 12;

/* The same arrangements as apps/web/src/app/shared/diary-layouts.ts. */
const LAYOUTS = {
  HERO: {
    paper: 'CREAM',
    photos: [{ x: 8, y: 5, width: 84, rotate: -1.5 }],
    title: { x: 8, y: 62, width: 84, font: 'HAND', limit: 60 },
    body: { x: 8, y: 71, width: 84, font: 'BODY', limit: 220 },
    stickers: [{ code: 'heart', x: 82, y: 1, width: 12, rotate: 14, color: '#b0413e' }],
  },
  DUO: {
    paper: 'DOT',
    photos: [{ x: 5, y: 5, width: 54, rotate: -4 }, { x: 41, y: 25, width: 54, rotate: 4 }],
    title: { x: 7, y: 63, width: 86, font: 'HAND', limit: 60 },
    body: { x: 7, y: 72, width: 86, font: 'BODY', limit: 200 },
    stickers: [{ code: 'paw', x: 8, y: 42, width: 11, rotate: -12, color: '#8a5a2b' }],
  },
  TRIO: {
    paper: 'KRAFT',
    photos: [
      { x: 4, y: 4, width: 46, rotate: -5 },
      { x: 50, y: 7, width: 45, rotate: 4 },
      { x: 25, y: 33, width: 50, rotate: -1 },
    ],
    title: { x: 7, y: 68, width: 86, font: 'HAND', limit: 50 },
    body: { x: 7, y: 77, width: 86, font: 'BODY', limit: 150 },
    stickers: [{ code: 'star', x: 82, y: 38, width: 11, rotate: 10, color: '#8a5a2b' }],
  },
  GRID: {
    paper: 'GRID',
    photos: [
      { x: 5, y: 5, width: 43, rotate: -1 },
      { x: 52, y: 5, width: 43, rotate: 1 },
      { x: 5, y: 35, width: 43, rotate: 1 },
      { x: 52, y: 35, width: 43, rotate: -1 },
    ],
    title: { x: 7, y: 66, width: 86, font: 'SERIF', limit: 60 },
    body: { x: 7, y: 75, width: 86, font: 'BODY', limit: 160 },
    stickers: [],
  },
  STORY: {
    paper: 'LINE',
    photos: [{ x: 22, y: 50, width: 60, rotate: 3 }],
    title: { x: 8, y: 6, width: 84, font: 'SERIF', limit: 60 },
    body: { x: 8, y: 15, width: 84, font: 'HAND', limit: 260 },
    stickers: [{ code: 'leaf', x: 6, y: 80, width: 13, rotate: -18, color: '#2f6f5e' }],
  },
  NOTE: {
    paper: 'BLOOM',
    photos: [],
    title: { x: 10, y: 10, width: 72, font: 'HAND', limit: 60 },
    body: { x: 10, y: 22, width: 80, font: 'HAND', limit: 520 },
    stickers: [
      { code: 'flower', x: 80, y: 4, width: 14, rotate: 12, color: '#b0413e' },
      { code: 'paw', x: 10, y: 84, width: 10, rotate: -14, color: '#8a5a2b' },
    ],
  },
};

/* What each page says. {n} becomes the pet's name. Months count back from today. */
const DOG_PAGES = [
  { ago: 14, layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Nhà mình', tag: ['NgayDauTien'],
    title: 'Ngày đầu {n} về nhà', body: '{n} rụt rè nấp sau ghế cả buổi sáng, đến chiều thì đã dám lẽo đẽo theo cả nhà khắp phòng. Tối ngủ ngoan trong ổ mới.' },
  { ago: 13, layout: 'DUO', topic: 'LEARNING', place: 'Sân sau', tag: ['HuanLuyen'],
    title: 'Học ngồi và bắt tay', body: 'Mất đúng ba ngày và một túi bánh thưởng, {n} đã biết ngồi xuống khi nghe gọi. Bắt tay thì vẫn còn đưa nhầm chân.' },
  { ago: 12, layout: 'TRIO', topic: 'OUTING', place: 'Công viên Tao Đàn', tag: ['DaoCongVien'],
    title: 'Lần đầu ra công viên', body: 'Gặp bao nhiêu bạn mới, chạy đến lè lưỡi. Về nhà là lăn ra ngủ ngay trên thảm.' },
  { ago: 11, layout: 'STORY', topic: 'FUNNY', place: 'Phòng khách', tag: ['QuậyPhá'],
    title: 'Vụ án chiếc dép mất tích', body: 'Cả nhà lục tung mọi ngóc ngách mới thấy chiếc dép nằm gọn trong ổ của {n}, gặm mất một góc. Bị mắng xong vẫn vẫy đuôi tít mù.' },
  { ago: 9, layout: 'GRID', topic: 'EVERYDAY', place: 'Nhà mình', tag: ['ThuongNgay'],
    title: 'Một ngày bình thường của {n}', body: 'Sáng đi dạo, trưa ngủ, chiều chơi bóng, tối nằm canh cửa chờ cả nhà về.' },
  { ago: 8, layout: 'HERO', topic: 'OUTING', place: 'Biển Vũng Tàu', tag: ['DuLich', 'Bien'],
    title: '{n} lần đầu thấy biển', body: 'Sóng vừa chạm chân là chạy lùi lại, được một lúc thì lao xuống nghịch nước không chịu lên bờ.' },
  { ago: 6, layout: 'NOTE', topic: 'EVERYDAY', place: '', tag: ['ThuGuiBe'],
    title: 'Gửi {n} của tụi mình', body: 'Cảm ơn em vì đã luôn chạy ra đón mỗi lần cả nhà về, kể cả những hôm trời mưa hay về rất muộn. Có em, căn nhà lúc nào cũng ấm hơn một chút.' },
  { ago: 5, layout: 'DUO', topic: 'LEARNING', place: 'Trung tâm huấn luyện', tag: ['HuanLuyen'],
    title: 'Tốt nghiệp lớp vâng lời', body: '{n} đã biết đi cạnh chân, nằm chờ và không nhảy lên người lạ. Cô huấn luyện viên khen hết lời.' },
  { ago: 3, layout: 'TRIO', topic: 'FUNNY', place: 'Ban công', tag: ['QuậyPhá'],
    title: 'Đại chiến với chiếc lá', body: 'Một chiếc lá khô bay vào ban công và {n} đã dành nguyên buổi chiều để đuổi theo, sủa, rồi tha về ổ như chiến lợi phẩm.' },
  { ago: 1, layout: 'GRID', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
    title: 'Sinh nhật {n}', body: 'Bánh làm từ thịt gà và bí đỏ, thêm một chiếc mũ giấy mà {n} cố gặm suốt buổi tiệc.' },
];

const CAT_PAGES = [
  { ago: 14, layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Nhà mình', tag: ['NgayDauTien'],
    title: 'Ngày {n} chọn nhà mình', body: '{n} ngồi im trong hộp suốt hai tiếng rồi mới chịu bước ra, đi một vòng ngửi từng góc nhà như kiểm tra lãnh thổ.' },
  { ago: 12, layout: 'STORY', topic: 'FUNNY', place: 'Bếp', tag: ['QuậyPhá'],
    title: 'Cái cốc thứ ba', body: 'Sáng nay {n} lại nhìn thẳng vào mắt mình rồi từ từ đẩy cái cốc khỏi mép bàn. Đây là cái thứ ba trong tuần.' },
  { ago: 11, layout: 'DUO', topic: 'EVERYDAY', place: 'Bậu cửa sổ', tag: ['NgamMua'],
    title: 'Chuyên gia ngắm mưa', body: 'Mưa cả buổi chiều, {n} ngồi trên bậu cửa sổ dõi theo từng hạt mưa lăn trên kính.' },
  { ago: 10, layout: 'TRIO', topic: 'EVERYDAY', place: 'Phòng ngủ', tag: ['NguNgay'],
    title: 'Mười bốn tiếng ngủ', body: 'Ngủ trên ghế, ngủ trên chăn, ngủ trong thùng giấy. Hôm nay {n} thử đủ mọi chỗ trong nhà.' },
  { ago: 8, layout: 'NOTE', topic: 'EVERYDAY', place: '', tag: ['ThuGuiBe'],
    title: 'Gửi {n}', body: 'Em không bao giờ chạy ra đón ở cửa, nhưng tối nào cũng lặng lẽ nằm cạnh chân khi mình làm việc khuya. Cảm ơn em vì sự dịu dàng rất riêng ấy.' },
  { ago: 7, layout: 'GRID', topic: 'FUNNY', place: 'Phòng khách', tag: ['ThungGiay'],
    title: 'Thùng giấy là chân ái', body: 'Mua cho {n} chiếc giường xịn, nhưng em chỉ thích cái thùng giấy đựng nó.' },
  { ago: 5, layout: 'HERO', topic: 'LEARNING', place: 'Nhà mình', tag: ['HocMoi'],
    title: '{n} biết tự mở cửa', body: 'Nhảy lên, đu người vào tay nắm, thế là cửa mở. Từ nay phòng nào trong nhà cũng là của {n}.' },
  { ago: 4, layout: 'DUO', topic: 'OUTING', place: 'Phòng khám thú y', tag: ['SucKhoe'],
    title: 'Đi tiêm phòng', body: 'Kêu suốt đường đi, nhưng đến nơi thì ngoan lạ thường. Bác sĩ khen {n} khoẻ mạnh, lông mượt.' },
  { ago: 2, layout: 'TRIO', topic: 'FUNNY', place: 'Ban công', tag: ['SanMoi'],
    title: 'Thợ săn bướm', body: 'Một chú bướm lạc vào ban công và {n} đã có buổi sáng bận rộn nhất năm, dù chẳng bắt được gì.' },
  { ago: 1, layout: 'GRID', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
    title: 'Sinh nhật {n}', body: 'Một hộp pate mới, một cuộn len đỏ và rất nhiều cái vuốt ve. {n} vui theo kiểu mèo: nằm phơi bụng giữa nhà.' },
];

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

const auth = (token) => ({ authorization: `Bearer ${token}` });

async function json(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function dogUrls(breed, count) {
  const wanted = /corgi/i.test(breed ?? '') ? 'pembroke' : null;
  const where = wanted
    ? `https://dog.ceo/api/breed/${wanted}/images/random/${count}`
    : `https://dog.ceo/api/breeds/image/random/${count}`;
  return (await json(where)).message;
}

async function catUrls(count) {
  const rows = await json(`https://api.thecatapi.com/v1/images/search?limit=${count}&mime_types=jpg,png`);
  return rows.map((one) => one.url);
}

async function asJpeg(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  return sharp(raw).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
}

async function upload(token, petId, bytes, name) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), name);
  const res = await call(`/pet-photos/${petId}`, { method: 'POST', headers: auth(token), body: form });
  if (res.status >= 300) throw new Error(`upload ${res.status} ${res.text.slice(0, 160)}`);
  return res.body._id;
}

function cut(text, limit) {
  const clean = text.trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function buildPage(layout, photoIds, title, body) {
  const items = [];
  let z = 1;
  layout.photos.forEach((slot, at) => {
    if (photoIds[at]) {
      items.push({ kind: 'PHOTO', x: slot.x, y: slot.y, width: slot.width, rotate: slot.rotate, z: z++, photo: photoIds[at] });
    }
  });
  for (const [slot, text] of [[layout.title, title], [layout.body, body]]) {
    if (text.trim()) {
      items.push({ kind: 'TEXT', x: slot.x, y: slot.y, width: slot.width, rotate: 0, z: z++, text: cut(text, slot.limit), fontKey: slot.font });
    }
  }
  for (const slot of layout.stickers) {
    items.push({ kind: 'STICKER', x: slot.x, y: slot.y, width: slot.width, rotate: slot.rotate, z: z++, sticker: slot.code, color: slot.color });
  }
  return items;
}

function monthsAgo(months, index) {
  const at = new Date();
  at.setMonth(at.getMonth() - months);
  at.setDate(3 + ((index * 7) % 24));
  at.setHours(9 + (index % 9), (index * 13) % 60, 0, 0);
  return at.toISOString();
}

async function seedPet(token, pet) {
  const diary = await call(`/memories/pet/${pet._id}`, { headers: auth(token) });
  const rows = diary.body?.rows ?? [];
  if (rows.some((one) => (one.tag ?? []).includes(SEED_TAG))) {
    console.log(`- ${pet.name}: da co nhat ky mau, bo qua`);
    return;
  }

  const album = await call(`/pet-photos?pet=${pet._id}`, { headers: auth(token) });
  const kept = (album.body ?? []).filter((one) => !one.isRestored).map((one) => one._id);
  const room = Math.max(0, Math.min(NEW_PHOTOS, ALBUM_MAX - kept.length));
  const isCat = pet.kind === 'CAT';
  const urls = room > 0 ? (isCat ? await catUrls(room + 4) : await dogUrls(pet.breed, room + 4)) : [];

  const fresh = [];
  for (const url of urls) {
    if (fresh.length >= room) break;
    try {
      const bytes = await asJpeg(url);
      fresh.push(await upload(token, pet._id, bytes, `${pet.name}-${fresh.length + 1}.jpg`));
      process.stdout.write('.');
    } catch (problem) {
      process.stdout.write('x');
    }
  }
  const pool = [...fresh, ...kept];
  console.log(`\n- ${pet.name}: tai len ${fresh.length} anh, album co ${pool.length} anh`);
  if (pool.length === 0) {
    console.log('  khong co anh nao, bo qua');
    return;
  }

  const pages = isCat ? CAT_PAGES : DOG_PAGES;
  let next = 0;
  let made = 0;
  for (const [index, page] of pages.entries()) {
    const layout = LAYOUTS[page.layout];
    const photos = layout.photos.map(() => pool[next++ % pool.length]);
    const title = page.title.replaceAll('{n}', pet.name);
    const body = page.body.replaceAll('{n}', pet.name);
    const res = await call('/memories', {
      method: 'POST',
      headers: { ...auth(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        pet: pet._id,
        title,
        body,
        happenedAt: monthsAgo(page.ago, index),
        place: page.place || undefined,
        topic: page.topic,
        tag: [...page.tag, SEED_TAG],
        photo: [...new Set(photos)],
        decor: buildPage(layout, photos, title, body),
        paper: layout.paper,
        isMilestone: Boolean(page.milestone),
      }),
    });
    if (res.status >= 300) {
      console.log(`  loi khi tao "${title}": ${res.status} ${res.text.slice(0, 200)}`);
    } else {
      made += 1;
    }
  }
  console.log(`  tao ${made}/${pages.length} trang nhat ky`);
}

(async () => {
  const login = await call('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(WHO),
  });
  if (login.status >= 300) throw new Error(`Dang nhap that bai: ${login.status}`);
  const token = login.body.accessToken;
  const pets = (await call('/pets', { headers: auth(token) })).body ?? [];
  console.log(`Tai khoan ${WHO.email} co ${pets.length} be.`);
  for (const pet of pets) {
    await seedPet(token, pet);
  }
})().catch((problem) => {
  console.error(problem);
  process.exit(1);
});
