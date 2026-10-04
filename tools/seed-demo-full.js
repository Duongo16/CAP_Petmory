/**
 * Lam day tai khoan khach hang demo (khachhang@petmory.local) bang du lieu
 * nhu that: ba be voi anh va nhat ky, ba ban thiet ke len, sau don hang o du
 * moi trang thai (co ca phieu kiem tra chat luong va danh gia), mot gio hang
 * dang chon do, mon yeu thich, lien ket chia se, va bai viet cong dong co qua
 * lai voi bon nguoi nuoi trong tools/seed-showcase.js.
 *
 * Chay sau seed-showcase.js. Tai khoan demo da co thu cung thi khong lam gi.
 *
 * Chay:
 *   PETMORY_API=http://localhost:3001/api SEED_DB_URI=<chuoi ket noi> node tools/seed-demo-full.js
 */
const {
  PASSWORD, BOSS, WEBHOOK_KEY, LAYOUTS,
  call, auth, asJson, must, photoUrls, asJpeg, uploadPhoto, decorOf, signIn,
} = require('./seed-showcase');

const DEMO = { email: 'khachhang@petmory.local', password: 'Petmory@2026' };
const PROFILE = {
  fullName: 'Khách hàng Petmory',
  phone: '0916220486',
  avatarUrl: 'https://randomuser.me/api/portraits/women/79.jpg',
};
const ADDRESS = { address: 'Số 6 ngõ 12 Hàng Bút, Phường Hàng Mã, Quận Hoàn Kiếm', province: 'Hà Nội' };

/** Nhung nguoi nuoi da seed truoc, de qua lai binh luan va theo doi. */
const NEIGHBOURS = {
  ha: 'thuha.nguyen@demo.petmory.vn',
  khoa: 'minhkhoa.tran@demo.petmory.vn',
  phuonganh: 'phuonganh.le@demo.petmory.vn',
  bao: 'quocbao.pham@demo.petmory.vn',
};

const PETS = [
  {
    key: 'mochi',
    photos: { dog: 'shiba', count: 8 },
    isPublic: true,
    share: true,
    profile: {
      name: 'Mochi',
      kind: 'DOG',
      breed: 'Shiba Inu',
      gender: 'MALE',
      birthDate: '2020-11-20',
      adoptionDate: '2021-01-16',
      neutered: true,
      tagline: 'Cậu Shiba bướng bỉnh, cười bằng cả khuôn mặt',
      trait: ['Bướng như Shiba', 'Mê táo đỏ', 'Hét to khi tắm', 'Thích ngồi ngắm phố cổ'],
      carer: [{ name: 'Linh', role: 'Chủ nuôi' }, { name: 'Bố', role: 'Dắt đi dạo sáng sớm' }],
      milestone: [
        { title: 'Về nhà', at: '2021-01-16', description: 'Đón Mochi từ trại Shiba ở Ba Vì.' },
        { title: 'Tốt nghiệp lớp vâng lời', at: '2022-05-28' },
      ],
    },
    pages: [
      { at: '2021-01-16T10:00:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Hàng Bút, Hoàn Kiếm', tag: ['NgayDauTien'],
        title: 'Mochi về phố cổ', body: 'Hai tháng tuổi, lông màu cam như quả quýt. Vừa đặt xuống sàn đã chạy một vòng quanh nhà rồi ngủ lăn ra trên chiếc dép của bố.' },
      { at: '2021-04-03T16:30:00+07:00', layout: 'STORY', topic: 'FUNNY', place: 'Phòng tắm', tag: ['TamRua'],
        title: 'Tiếng hét Shiba huyền thoại', body: 'Lần tắm đầu tiên, Mochi hét to đến mức hàng xóm sang gõ cửa hỏi có chuyện gì. Tắm xong thì lăn lộn trên khăn như chưa từng có gì xảy ra.' },
      { at: '2021-11-20T19:00:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
        title: 'Sinh nhật một tuổi', body: 'Bánh táo nướng không đường và một quả bóng cao su mới. Mochi gặm bóng ba tiếng rồi giấu nó sau rèm cửa.' },
      { at: '2022-05-28T09:00:00+07:00', layout: 'TRIO', topic: 'LEARNING', milestone: true, place: 'Trung tâm huấn luyện Long Biên', tag: ['HuanLuyen'],
        title: 'Tốt nghiệp lớp vâng lời', body: 'Sau mười buổi học, Mochi đã biết đi cạnh chân và chờ lệnh trước bát cơm. Riêng lệnh "lại đây" thì tuỳ hứng.' },
      { at: '2023-10-14T06:15:00+07:00', layout: 'HERO', topic: 'OUTING', place: 'Hồ Gươm', tag: ['DaoPho'],
        title: 'Sáng sớm quanh Hồ Gươm', body: 'Sáu giờ sáng, phố còn vắng. Mochi đi một vòng hồ, được ba cô tập thể dục khen là "con chó cáo đẹp quá".' },
      { at: '2024-08-10T15:00:00+07:00', layout: 'TRIO', topic: 'OUTING', place: 'Tam Đảo, Vĩnh Phúc', tag: ['DuLich'],
        title: 'Mochi lên Tam Đảo', body: 'Lần đầu thấy sương mù, Mochi đứng im rất lâu rồi sủa vào khoảng trắng trước mặt. Tối về ngủ say trong chăn.' },
      { at: '2025-11-20T19:30:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
        title: 'Mochi năm tuổi', body: 'Năm nay Mochi được một chiếc tượng len chính mình đặt ở Petmory. Cậu ngửi tượng rất lâu, rồi nằm canh bên cạnh cả buổi tối.' },
      { at: '2026-09-21T17:45:00+07:00', layout: 'NOTE', topic: 'EVERYDAY', place: '', tag: ['ThuGuiBe'],
        title: 'Gửi Mochi', body: 'Có những hôm đi làm về rất mệt, mở cửa ra là thấy em ngồi thẳng lưng chờ, đuôi cuộn tròn, cười híp mắt. Cảm ơn em vì đã biến căn nhà nhỏ trong phố cổ thành nơi chị muốn trở về nhất.' },
    ],
  },
  {
    key: 'bong',
    photos: { cat: 'pers', count: 4 },
    isPublic: false,
    profile: {
      name: 'Bông',
      kind: 'CAT',
      breed: 'Mèo Ba Tư',
      gender: 'FEMALE',
      birthDate: '2022-06-02',
      adoptionDate: '2022-09-10',
      neutered: true,
      tagline: 'Công chúa lông trắng, ghét bị bế',
      trait: ['Lông dài phải chải mỗi ngày', 'Ghét bị bế', 'Hay ngủ trên bàn phím'],
    },
    pages: [
      { at: '2022-09-10T14:00:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Nhà mình', tag: ['NgayDauTien'],
        title: 'Bông và anh Mochi', body: 'Mochi sủa đúng một tiếng, Bông xù lông quay lưng bỏ đi. Từ đó Mochi luôn đi vòng khi gặp em.' },
      { at: '2023-03-08T21:00:00+07:00', layout: 'STORY', topic: 'FUNNY', place: 'Bàn làm việc', tag: ['QuậyPhá'],
        title: 'Bản báo cáo bị xoá', body: 'Bông nằm đúng lên phím Delete trong lúc chị đi pha trà. Bản báo cáo ba trang còn lại đúng một chữ "Kính".' },
      { at: '2025-06-02T20:00:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
        title: 'Bông ba tuổi', body: 'Một hộp pate cá hồi và một chiếc nơ hồng mà Bông tháo ra sau đúng mười giây.' },
      { at: '2026-01-12T08:30:00+07:00', layout: 'NOTE', topic: 'EVERYDAY', place: '', tag: ['ThuGuiBe'],
        title: 'Gửi Bông', body: 'Em không bao giờ cho chị bế, nhưng đêm nào cũng lặng lẽ nằm cạnh gối. Chị hiểu rồi, đó là cách em thương người.' },
    ],
  },
  {
    key: 'vang',
    photos: { dog: 'retriever/golden', count: 5 },
    isPublic: false,
    profile: {
      name: 'Vàng',
      kind: 'DOG',
      breed: 'Golden Retriever',
      gender: 'MALE',
      birthDate: '2010-02-14',
      adoptionDate: '2010-04-01',
      status: 'PASSED_AWAY',
      passedAwayDate: '2024-03-02',
      neutered: true,
      tagline: 'Người bạn đầu tiên của tuổi thơ',
      trait: ['Hiền như đất', 'Mê bơi', 'Luôn đón ở đầu ngõ'],
    },
    pages: [
      { at: '2010-04-01T09:00:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Nhà ông bà ở Gia Lâm', tag: ['NgayDauTien'],
        title: 'Vàng về nhà ông bà', body: 'Năm đó chị học lớp năm. Vàng là chú cún đầu tiên chị được tự tay đặt tên.' },
      { at: '2015-07-12T16:00:00+07:00', layout: 'TRIO', topic: 'OUTING', place: 'Sông Đuống', tag: ['BoiLoi'],
        title: 'Mùa hè ở sông Đuống', body: 'Vàng bơi giỏi hơn cả lũ trẻ trong xóm, lần nào cũng tha được chiếc dép trôi về bờ.' },
      { at: '2022-02-14T18:00:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà ông bà', tag: ['SinhNhat'],
        title: 'Vàng mười hai tuổi', body: 'Mõm đã bạc trắng, đi lại chậm, nhưng nghe tiếng xe chị về vẫn cố chạy ra đầu ngõ.' },
      { at: '2024-03-02T07:00:00+07:00', layout: 'NOTE', topic: 'EVERYDAY', milestone: true, place: '', tag: ['TuongNho'],
        title: 'Tạm biệt Vàng', body: 'Em ra đi vào một buổi sáng đầu xuân, nằm dưới gốc bưởi em vẫn hay nằm. Mười bốn năm, em lớn lên cùng chị. Chị đã đặt một hộp kỷ niệm có tượng len của em để đặt ở nhà ông bà.' },
    ],
  },
];

/** Ba ban thiet ke len, dung mau nen va bang mau that cua xuong. */
const DESIGNS = [
  { key: 'mochi', pet: 'mochi', name: 'Mochi cười híp mắt', modelCode: 'Q-SHIBA', productTypeCode: 'PT-01', sizeCode: 'FIG-M',
    zonePaint: { MAIN_FUR: 'WOOL-Y02', BELLY_FUR: 'WOOL-W01', EAR: 'WOOL-Y02', TAIL: 'WOOL-W02', EYE: 'WOOL-K01', NOSE: 'WOOL-NS01' },
    engraving: { name: 'MOCHI', message: 'Cậu Shiba của phố Hàng Bút' } },
  { key: 'bong', pet: 'bong', name: 'Móc khóa Bông lông trắng', modelCode: 'TEMP-CAT', productTypeCode: 'PT-02', sizeCode: 'KEY-S',
    zonePaint: { MAIN_FUR: 'WOOL-W01', BELLY_FUR: 'WOOL-W02', EAR: 'WOOL-AC02', TAIL: 'WOOL-W01', EYE: 'WOOL-EY03', NOSE: 'WOOL-NS02' },
    engraving: { name: 'BÔNG' } },
  { key: 'vang', pet: 'vang', name: 'Vàng dưới gốc bưởi', modelCode: 'TEMP-DOG', productTypeCode: 'PT-05', sizeCode: 'BOX-M',
    zonePaint: { MAIN_FUR: 'WOOL-Y01', BELLY_FUR: 'WOOL-W04', EAR: 'WOOL-Y03', TAIL: 'WOOL-Y01', EYE: 'WOOL-EY04', NOSE: 'WOOL-NS01' },
    engraving: { name: 'VÀNG', memorialDate: '2024-03-02', message: 'Người bạn đầu tiên của tuổi thơ' } },
];

/**
 * Sau don hang. qc la so muc kiem tra da tich (tat ca la 'ALL'), review la
 * danh gia sau khi nhan hang.
 */
const ORDERS = [
  { made: [{ design: 'mochi', petName: 'Mochi' }], goods: [['G-THE-TEN', 'THE-TRON', 1]], to: 'COMPLETED', qc: 'ALL',
    note: 'Nhờ xưởng làm đuôi cuộn tròn như ảnh số 3 giúp mình.',
    review: { productTypeCode: 'PT-01', rating: 5, comment: 'Tượng giống Mochi đến từng nếp nhăn khi cười. Len mềm, đóng hộp cẩn thận, thẻ tên khắc đẹp. Cả nhà ai cũng mê.' } },
  { goods: [['G-BAT-AN', 'BAT-600', 1], ['G-HOP-QUA', 'HOP-VUA', 1]], to: 'SHIPPING', note: 'Gọi trước khi giao, nhà trong ngõ nhỏ.' },
  { made: [{ design: 'vang', petName: 'Vàng' }], to: 'IN_PRODUCTION', qc: 2,
    note: 'Hộp kỷ niệm tặng ông bà, nhờ xưởng gói giấy màu nâu.' },
  { made: [{ design: 'bong', petName: 'Bông' }], to: 'PAID', note: '' },
  { goods: [['G-KHUNG-GO', 'KHUNG-20X25', 1]], to: 'AWAITING_PAYMENT', note: '' },
  { goods: [['G-VONG-LEN', 'VONG-M-NAU', 1]], to: 'CANCELLED', note: '' },
];

/** Gio hang dang chon do, de trang gio khong trong. */
const CART = {
  goods: [['G-CHAN-NI', 'CHAN-S-XANH', 1]],
  made: [{ productTypeCode: 'PT-03', sizeCode: 'POR-S', petName: 'Mochi' }],
};

const FAVOURITES = ['PT-01', 'PT-03', 'PT-05'];

const MY_POSTS = [
  { topic: 'MOMENT', daysAgo: 10, photoFrom: 'mochi',
    title: 'Sáng sớm cùng Mochi quanh Hồ Gươm',
    content: 'Sáu giờ sáng Chủ nhật, phố đi bộ còn vắng. Mochi được ba cô tập dưỡng sinh khen là "con chó cáo", cậu chàng vênh mặt suốt đường về. Ai ở phố cổ hay dắt chó buổi sáng thì mình hẹn nhau đi chung nhé!',
    tags: ['shiba', 'hoguom'],
    comments: [
      { by: 'ha', after: 1, text: 'Bơ nhà mình cũng hay đi Hồ Tây buổi sáng, hôm nào hẹn hai đứa gặp nhau nha!' },
      { by: 'khoa', after: 3, text: 'Nụ cười Shiba đúng là không đỡ nổi.' },
      { by: 'me', after: 4, text: 'Hẹn chị Hà sáng Chủ nhật tuần sau nhé, em dắt Mochi qua Hồ Tây.' },
    ],
    likedBy: ['ha', 'khoa', 'phuonganh'] },
  { topic: 'PRODUCT', daysAgo: 6, photoFrom: 'mochi',
    title: 'Review tượng len Mochi sau 2 tuần chờ',
    content: 'Mình gửi xưởng 8 ảnh của Mochi, chọn dáng len tròn và tự phối màu trong Studio 3D. Hai tuần sau nhận tượng: màu lông cam, phần bụng trắng và nụ cười đều đúng như bản thiết kế. Xưởng còn gửi ảnh kiểm tra trước khi giao. Điểm trừ duy nhất là phải chờ hơi lâu vào mùa cao điểm.',
    tags: ['petmory', 'review', 'tuonglen'],
    comments: [
      { by: 'phuonganh', after: 2, text: 'Đẹp quá chị ơi. Em đang tính làm một bức tranh len cho Lucky.' },
      { by: 'bao', after: 20, text: 'Nhìn chất len mịn ghê, chắc mình cũng đặt cho Mực một con.' },
    ],
    likedBy: ['ha', 'phuonganh', 'bao'] },
];

/** Demo tha tim va binh luan vao bai cua nguoi khac, tim theo tieu de. */
const ON_OTHERS = [
  { title: 'Một năm không có Lucky', comment: 'Đọc bài của chị lại nhớ Vàng nhà em. Chị giữ gìn sức khoẻ nhé.', after: 30 },
  { title: 'Bơ tròn 5 tuổi rồi mọi người ơi', comment: 'Chúc mừng sinh nhật Bơ! Mochi gửi một cái vẫy đuôi.', after: 9 },
  { title: 'Mèo già lười ăn: mình đã làm thế này', like: true },
];

const FOLLOWS_OUT = ['ha', 'phuonganh', 'khoa'];
const FOLLOWS_IN = ['ha', 'bao'];

// ----------------------------------------------------------------------------

async function seedPets(token) {
  const pets = {};
  for (const plan of PETS) {
    const urls = await photoUrls(plan.photos);
    const pet = must(await call('/pets', asJson(token, { ...plan.profile, avatarUrl: urls[0] })), `ho so ${plan.profile.name}`);
    const photoIds = [];
    for (const [at, url] of urls.entries()) {
      photoIds.push(await uploadPhoto(token, pet._id, await asJpeg(url), `${plan.key}-${at + 1}.jpg`, at === 0 ? 'FRONT' : undefined));
    }
    let cursor = 0;
    for (const page of plan.pages) {
      const layout = LAYOUTS[page.layout];
      const chosen = [];
      for (let k = 0; k < layout.photos.length && photoIds.length > 0; k += 1) {
        chosen.push(photoIds[cursor % photoIds.length]);
        cursor += 1;
      }
      must(await call('/memories', asJson(token, {
        pet: pet._id, title: page.title, body: page.body, happenedAt: new Date(page.at).toISOString(),
        place: page.place, topic: page.topic, tag: page.tag, photo: chosen,
        decor: decorOf(layout, chosen, page.title, page.body), paper: layout.paper, isMilestone: Boolean(page.milestone),
      })), `trang "${page.title}"`);
    }
    if (plan.isPublic) {
      must(await call(`/memories/pet/${pet._id}/privacy`, asJson(token, { isPublic: true }, 'PATCH')), 'cong khai');
    }
    if (plan.share) {
      must(await call(`/memories/pet/${pet._id}/shares`, asJson(token, {})), 'lien ket chia se');
    }
    pets[plan.key] = { id: pet._id, photoUrls: urls };
    console.log(`  + ${plan.profile.name}: ${photoIds.length} anh, ${plan.pages.length} trang${plan.isPublic ? ', cong khai' : ''}`);
  }
  return pets;
}

async function seedDesigns(token, pets) {
  const designs = {};
  for (const one of DESIGNS) {
    const zonePaint = Object.entries(one.zonePaint).map(([zone, colorCode]) => ({ zone, colorCode }));
    const made = must(await call('/designs', asJson(token, {
      name: one.name,
      modelCode: one.modelCode,
      zonePaint,
      colorCodesUsed: [...new Set(Object.values(one.zonePaint))],
      productTypeCode: one.productTypeCode,
      sizeCode: one.sizeCode,
      engraving: one.engraving,
      pet: pets[one.pet].id,
    })), `thiet ke ${one.name}`);
    designs[one.key] = { id: made._id, productTypeCode: one.productTypeCode, sizeCode: one.sizeCode };
  }
  console.log(`  + ${DESIGNS.length} ban thiet ke`);
  return designs;
}

async function fillCart(token, plan, designs) {
  await call('/cart', { method: 'DELETE', headers: auth(token) });
  for (const line of plan.made ?? []) {
    const design = line.design ? designs[line.design] : null;
    must(await call('/cart/items', asJson(token, {
      productTypeCode: design?.productTypeCode ?? line.productTypeCode,
      sizeCode: design?.sizeCode ?? line.sizeCode,
      petName: line.petName,
      ...(design ? { designId: design.id } : {}),
      quantity: 1,
    })), 'gio: hang lam theo yeu cau');
  }
  for (const [goodsCode, sku, quantity] of plan.goods ?? []) {
    must(await call('/cart/goods', asJson(token, { goodsCode, sku, quantity })), `gio: ${goodsCode}`);
  }
}

async function seedOrders(token, boss, designs) {
  const reviewed = [];
  for (const plan of ORDERS) {
    await fillCart(token, plan, designs);
    const order = must(await call('/orders', asJson(token, {
      fullName: PROFILE.fullName, phone: PROFILE.phone, ...ADDRESS, note: plan.note,
    })), 'dat hang');
    const code = order.orderCode;
    const total = Number(String(order.total?.$numberDecimal ?? order.total).split('.')[0]);
    const pay = async () => must(await call('/payments/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Apikey ${WEBHOOK_KEY}` },
      body: JSON.stringify({ id: `seed-${code}`, transferAmount: total, content: `${code} thanh toan` }),
    }), 'thanh toan');
    const move = async (status, reason = '') =>
      must(await call(`/admin/orders/${code}/status`, asJson(boss, { status, reason }, 'PATCH')), `chuyen ${status}`);
    const tick = async (count) => {
      const detail = must(await call(`/admin/orders/${code}`, { headers: auth(boss) }), 'doc don');
      const all = detail.order.qualityCheck.length;
      const upTo = count === 'ALL' ? all : Math.min(count, all);
      for (let at = 0; at < upTo; at += 1) {
        must(await call(`/admin/orders/${code}/quality/${at}`, asJson(boss, { done: true }, 'PATCH')), 'tich kiem tra');
      }
    };

    if (plan.to === 'CANCELLED') {
      must(await call(`/orders/${code}/cancel`, asJson(token, {})), 'khach huy');
    } else if (plan.to !== 'AWAITING_PAYMENT') {
      await pay();
      const madeToOrder = (plan.made ?? []).length > 0;
      if (plan.to === 'IN_PRODUCTION' || (madeToOrder && ['SHIPPING', 'COMPLETED'].includes(plan.to))) {
        await move('IN_PRODUCTION');
        if (plan.qc) {
          await tick(plan.qc);
        }
      }
      if (['SHIPPING', 'COMPLETED'].includes(plan.to)) {
        await move('SHIPPING');
      }
      if (plan.to === 'COMPLETED') {
        await move('COMPLETED');
      }
    }
    if (plan.review) {
      must(await call('/reviews', asJson(token, { ...plan.review, orderCode: code })), 'danh gia');
      reviewed.push(code);
    }
    console.log(`  + ${code}: ${plan.to}${plan.review ? ', da danh gia' : ''}`);
  }
  // Gio hang cuoi cung giu lai, nhu mot nguoi dang chon do.
  await fillCart(token, CART, designs);
  console.log('  + gio hang dang chon do: 2 mon');
}

async function seedCommunity(token, meId, pets) {
  const others = {};
  for (const [key, email] of Object.entries(NEIGHBOURS)) {
    const res = await call('/auth/login', asJson(null, { email, password: PASSWORD }));
    if (res.status < 300) {
      others[key] = { token: res.body.accessToken, id: res.body.user.id };
    }
  }
  const voices = { ...others, me: { token, id: meId } };
  const touched = [];

  for (const post of MY_POSTS) {
    const created = must(await call('/community/posts', asJson(token, {
      topic: post.topic, title: post.title, content: post.content, tags: post.tags,
    })), `bai "${post.title}"`);
    const id = created._id;
    const pick = pets[post.photoFrom].photoUrls;
    await call(`/community/posts/${id}/photos/from-link`, asJson(token, { url: pick[post.topic === 'PRODUCT' ? 1 : 4] ?? pick[0] }));
    const comments = [];
    for (const one of post.comments) {
      const writer = voices[one.by];
      if (writer) {
        const c = must(await call(`/community/posts/${id}/comments`, asJson(writer.token, { content: one.text })), 'binh luan');
        comments.push({ id: c._id, after: one.after });
      }
    }
    for (const who of post.likedBy) {
      if (others[who]) {
        await call(`/community/posts/${id}/like`, asJson(others[who].token, {}));
      }
    }
    touched.push({ id, daysAgo: post.daysAgo, comments });
  }

  const extra = [];
  for (const one of ON_OTHERS) {
    const found = must(await call(`/community/posts?keyword=${encodeURIComponent(one.title)}`, { headers: auth(token) }), 'tim bai');
    const post = (found.rows ?? []).find((row) => row.title === one.title);
    if (!post) {
      continue;
    }
    if (one.comment) {
      const c = must(await call(`/community/posts/${post.id}/comments`, asJson(token, { content: one.comment })), 'binh luan');
      extra.push({ id: c._id, post: post.createdAt, after: one.after });
    }
    await call(`/community/posts/${post.id}/like`, asJson(token, {}));
  }

  for (const key of FOLLOWS_OUT) {
    if (others[key]) {
      await call(`/community/users/${others[key].id}/follow`, asJson(token, {}));
    }
  }
  for (const key of FOLLOWS_IN) {
    if (others[key]) {
      await call(`/community/users/${meId}/follow`, asJson(others[key].token, {}));
    }
  }
  console.log(`  + ${MY_POSTS.length} bai viet cua demo, ${extra.length} binh luan vao bai nguoi khac, theo doi qua lai`);
  return { touched, extra };
}

async function backdate({ touched, extra }) {
  const uri = process.env.SEED_DB_URI;
  if (!uri) {
    return;
  }
  const { MongoClient, ObjectId } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  const hour = 60 * 60 * 1000;
  for (const post of touched) {
    const at = new Date(Date.now() - post.daysAgo * 24 * hour - 5 * hour);
    await db.collection('community_posts').updateOne({ _id: new ObjectId(post.id) }, { $set: { createdAt: at, updatedAt: at } });
    for (const one of post.comments) {
      const when = new Date(at.getTime() + one.after * hour);
      await db.collection('community_comments').updateOne({ _id: new ObjectId(one.id) }, { $set: { createdAt: when, updatedAt: when } });
    }
  }
  for (const one of extra) {
    const when = new Date(new Date(one.post).getTime() + one.after * hour);
    await db.collection('community_comments').updateOne({ _id: new ObjectId(one.id) }, { $set: { createdAt: when, updatedAt: when } });
  }
  await client.close();
  console.log('  + da lui ngay bai viet va binh luan');
}

async function run() {
  console.log('LAM DAY TAI KHOAN DEMO khachhang@petmory.local');
  const login = must(await call('/auth/login', asJson(null, DEMO)), 'dang nhap demo');
  const token = login.accessToken;
  const meId = login.user.id;
  const already = must(await call('/pets', { headers: auth(token) }), 'doc thu cung');
  if (already.length > 0) {
    console.log(`Tai khoan demo da co ${already.length} thu cung, khong seed them.`);
    return;
  }
  must(await call('/community/users/me', asJson(token, PROFILE, 'PATCH')), 'ho so');
  for (const code of FAVOURITES) {
    await call(`/favourites/${code}/toggle`, asJson(token, {}));
  }
  console.log('Thu cung va nhat ky:');
  const pets = await seedPets(token);
  console.log('Thiet ke:');
  const designs = await seedDesigns(token, pets);
  console.log('Don hang:');
  await seedOrders(token, await signIn(BOSS), designs);
  console.log('Cong dong:');
  await backdate(await seedCommunity(token, meId, pets));
  console.log('Xong.');
}

run().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
