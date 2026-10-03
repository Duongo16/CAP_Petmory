/**
 * Bo du lieu trinh dien nho nhung day du, di qua chinh API nhu nguoi dung that.
 *
 * Bon nguoi nuoi o bon thanh pho, moi nguoi mot cau chuyen rieng: ho so thu
 * cung, anh that, nhung trang nhat ky co bo cuc, bai viet cong dong kem binh
 * luan va luot thich, va vai don hang o cac trang thai khac nhau. Moi thu deu
 * qua kiem tra cua may chu, nen ton kho, so nhat ky va lich su deu khop nhau.
 *
 * Chay lai khong sao: nguoi nao da co tai khoan thi bo qua nguoi do.
 *
 * Chay:
 *   PETMORY_API=http://localhost:3001/api node tools/seed-showcase.js
 *
 * Neu dat them SEED_DB_URI (chuoi ket noi toi cung co so du lieu ma API do
 * dang dung), bai viet va binh luan duoc lui ngay ve vai tuan truoc cho giong
 * mot cong dong da hoat dong mot thoi gian. Khong dat thi moi thu mang ngay hom nay.
 */
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
});

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const WEBHOOK_KEY = process.env.SEPAY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const PASSWORD = 'Petmory@2026';
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

/* Bo cuc trang, giong apps/web/src/app/shared/diary-layouts.ts. */
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

/**
 * Bon nguoi nuoi. Anh dai dien lay tu bo anh chan dung mau cong khai cua
 * randomuser.me; anh thu cung lay tu dog.ceo va thecatapi theo dung giong.
 */
const PEOPLE = [
  {
    key: 'ha',
    email: 'thuha.nguyen@demo.petmory.vn',
    fullName: 'Nguyễn Thu Hà',
    phone: '0912458730',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    address: { address: 'Số 18 ngõ 75 Trần Quốc Vượng, Dịch Vọng Hậu', province: 'Hà Nội' },
    pets: [
      {
        key: 'bo',
        photos: { dog: 'pembroke', count: 7 },
        isPublic: true,
        profile: {
          name: 'Bơ',
          kind: 'DOG',
          breed: 'Corgi Pembroke',
          gender: 'FEMALE',
          birthDate: '2021-03-14',
          adoptionDate: '2021-05-20',
          neutered: true,
          tagline: 'Cục bơ chân ngắn mê dưa hấu và ghét máy hút bụi',
          trait: ['Mê dưa hấu', 'Sợ máy hút bụi', 'Ngủ ngáy rất to', 'Thích được gãi bụng'],
          carer: [{ name: 'Thu Hà', role: 'Mẹ nuôi' }, { name: 'Anh Tuấn', role: 'Dắt đi dạo buổi tối' }],
        },
        pages: [
          { at: '2021-05-20T09:30:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Cầu Giấy, Hà Nội', tag: ['NgayDauTien'],
            title: 'Ngày đầu Bơ về nhà', body: 'Bơ nằm gọn trong lòng mình suốt chặng taxi từ Long Biên về. Đến nơi thì chui ngay xuống gầm sofa, tối mới chịu ra ăn hết bát cháo gà.' },
          { at: '2021-08-02T18:10:00+07:00', layout: 'STORY', topic: 'LEARNING', place: 'Phòng khách', tag: ['HuanLuyen'],
            title: 'Lệnh đầu tiên: ngồi', body: 'Ba buổi tối, nửa túi bánh thưởng vị bí đỏ, và cuối cùng Bơ cũng chịu đặt mông xuống khi nghe "ngồi". Hôm sau quên sạch, phải dạy lại từ đầu.' },
          { at: '2022-03-14T19:00:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
            title: 'Bơ tròn một tuổi', body: 'Bánh sinh nhật làm từ ức gà và khoai lang. Bơ ăn sạch phần bánh rồi quay sang gặm luôn chiếc mũ giấy.' },
          { at: '2023-07-02T16:40:00+07:00', layout: 'TRIO', topic: 'OUTING', place: 'Biển Sầm Sơn, Thanh Hóa', tag: ['DuLich', 'Bien'],
            title: 'Lần đầu ra biển', body: 'Sóng vừa chạm chân là chạy lùi ba bước. Mười phút sau thì không ai lôi được Bơ lên bờ nữa.' },
          { at: '2024-06-21T14:20:00+07:00', layout: 'STORY', topic: 'FUNNY', place: 'Bếp', tag: ['QuậyPhá', 'DuaHau'],
            title: 'Vụ trộm dưa hấu giữa trưa', body: 'Mình quay đi lấy dao, quay lại thì miếng dưa đã biến mất. Thủ phạm ngồi ngay cạnh, mặt ngây thơ, râu còn dính nước dưa đỏ.' },
          { at: '2026-03-14T20:00:00+07:00', layout: 'HERO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
            title: 'Bơ tròn năm tuổi', body: 'Năm năm rồi, Bơ vẫn chạy ra cửa đón mình mỗi tối như ngày đầu. Năm nay có thêm bánh và một chú vịt bông mới để cắn.' },
          { at: '2026-09-07T17:30:00+07:00', layout: 'NOTE', topic: 'EVERYDAY', place: 'Hồ Tây', tag: ['ThuGuiBe'],
            title: 'Gửi Bơ, chiều Hồ Tây', body: 'Chiều nay gió hồ mát, Bơ đi chậm hơn mọi khi và hay dừng lại ngửi từng gốc cây. Mình cũng đi chậm theo. Cảm ơn em vì đã dạy mình rằng có những buổi chiều không cần phải vội.' },
        ],
      },
    ],
  },
  {
    key: 'khoa',
    email: 'minhkhoa.tran@demo.petmory.vn',
    fullName: 'Trần Minh Khoa',
    phone: '0903617284',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    address: { address: '42/7 Trần Quang Diệu, Phường 14, Quận 3', province: 'TP. Hồ Chí Minh' },
    pets: [
      {
        key: 'muop',
        photos: { cat: '', count: 6 },
        isPublic: true,
        profile: {
          name: 'Mướp',
          kind: 'CAT',
          breed: 'Mèo mướp ta',
          gender: 'MALE',
          birthDate: '2019-10-01',
          adoptionDate: '2019-12-24',
          neutered: true,
          tagline: 'Ông cụ mèo nhặt được đêm Giáng sinh',
          trait: ['Ngủ mười bốn tiếng một ngày', 'Ghét đi xe máy', 'Chỉ ăn pate cá ngừ'],
          carer: [{ name: 'Minh Khoa', role: 'Sen chính' }],
        },
        pages: [
          { at: '2019-12-24T23:15:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Hẻm Trần Quang Diệu', tag: ['NgayDauTien', 'GiangSinh'],
            title: 'Đêm Giáng sinh nhặt được Mướp', body: 'Đi lễ về thấy một nhúm lông ướt sũng kêu dưới gầm xe. Ủ khăn, sấy ấm, nhỏ sữa từng giọt. Sáng ra Mướp đã đòi ăn bằng cách cắn ngón chân mình.' },
          { at: '2020-04-11T10:00:00+07:00', layout: 'DUO', topic: 'OUTING', place: 'Phòng khám thú y Quận 3', tag: ['SucKhoe'],
            title: 'Đi tiêm phòng mũi đầu', body: 'Kêu suốt từ nhà đến phòng khám, đến nơi thì im thin thít nép vào nách mình. Bác sĩ bảo Mướp khoẻ, chỉ hơi nhẹ cân.' },
          { at: '2022-08-19T15:30:00+07:00', layout: 'STORY', topic: 'FUNNY', place: 'Bàn làm việc', tag: ['QuậyPhá'],
            title: 'Đồng nghiệp bất đắc dĩ', body: 'Cuộc họp online nào Mướp cũng đi ngang qua bàn phím. Hôm nay em gửi giúp mình tin nhắn "jjjjjjjjjj" vào nhóm cả công ty.' },
          { at: '2024-12-24T21:00:00+07:00', layout: 'TRIO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
            title: 'Tròn năm năm về nhà', body: 'Mỗi năm đêm Giáng sinh là sinh nhật của Mướp. Năm nay có pate cá ngừ, một cuộn len đỏ và em Sữa ngồi xem.' },
          { at: '2026-07-03T06:45:00+07:00', layout: 'NOTE', topic: 'EVERYDAY', place: '', tag: ['ThuGuiBe'],
            title: 'Gửi ông cụ Mướp', body: 'Em không còn nhảy lên tủ lạnh được nữa, giờ chỉ thích nằm phơi nắng ở bậu cửa sổ mỗi sáng. Không sao cả, anh đã kê thêm một chiếc ghế nhỏ để em leo lên cho dễ.' },
        ],
      },
      {
        key: 'sua',
        photos: { cat: 'bsho', count: 3 },
        isPublic: false,
        profile: {
          name: 'Sữa',
          kind: 'CAT',
          breed: 'Anh lông ngắn',
          gender: 'FEMALE',
          birthDate: '2023-02-10',
          adoptionDate: '2023-05-01',
          neutered: false,
          tagline: 'Cô em xám tro, mê thùng giấy',
          trait: ['Mê thùng giấy', 'Hay bám chân anh Mướp'],
        },
        pages: [
          { at: '2023-05-01T11:00:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Nhà mình', tag: ['NgayDauTien'],
            title: 'Sữa về làm em Mướp', body: 'Mướp gầm gừ đúng ba ngày, đến ngày thứ tư thì hai đứa đã nằm chung một ổ.' },
          { at: '2025-01-15T20:30:00+07:00', layout: 'DUO', topic: 'FUNNY', place: 'Phòng khách', tag: ['ThungGiay'],
            title: 'Chiếc giường bị bỏ rơi', body: 'Mua cho Sữa chiếc giường nệm êm, nhưng em chỉ chịu nằm trong cái thùng các-tông đựng nó.' },
        ],
      },
    ],
  },
  {
    key: 'phuonganh',
    email: 'phuonganh.le@demo.petmory.vn',
    fullName: 'Lê Phương Anh',
    phone: '0935284106',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    address: { address: '27 Lê Đình Lý, Phường Vĩnh Trung, Quận Thanh Khê', province: 'Đà Nẵng' },
    pets: [
      {
        key: 'lucky',
        photos: { dog: 'poodle/toy', count: 6 },
        isPublic: true,
        profile: {
          name: 'Lucky',
          kind: 'DOG',
          breed: 'Poodle Toy',
          gender: 'MALE',
          birthDate: '2012-06-01',
          adoptionDate: '2012-08-15',
          status: 'PASSED_AWAY',
          passedAwayDate: '2025-09-12',
          neutered: true,
          tagline: 'Cảm ơn em vì mười ba năm bên chị',
          trait: ['Hay ghen', 'Mê bánh quy bơ', 'Luôn ngủ dưới chân giường'],
          carer: [{ name: 'Phương Anh', role: 'Chị hai' }, { name: 'Mẹ', role: 'Nấu cơm cho Lucky' }],
        },
        pages: [
          { at: '2012-08-15T08:00:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Thanh Khê, Đà Nẵng', tag: ['NgayDauTien'],
            title: 'Món quà năm lớp mười', body: 'Bố mang Lucky về trong một chiếc giỏ mây, nhỏ bằng hai bàn tay. Em ngủ quên ngay trên bàn học của chị.' },
          { at: '2016-07-20T17:00:00+07:00', layout: 'TRIO', topic: 'OUTING', place: 'Biển Mỹ Khê', tag: ['Bien', 'DuLich'],
            title: 'Mùa hè ở Mỹ Khê', body: 'Chiều nào hai chị em cũng ra biển. Lucky không bao giờ chịu xuống nước, chỉ đứng sủa sóng.' },
          { at: '2019-06-12T09:00:00+07:00', layout: 'STORY', topic: 'EVERYDAY', place: 'Sân bay Đà Nẵng', tag: ['XaNha'],
            title: 'Ngày chị đi học xa', body: 'Mẹ kể suốt tuần đầu Lucky nằm trước cửa phòng chị, chẳng ăn được bao nhiêu. Tối nào chị cũng gọi video để em nghe giọng.' },
          { at: '2024-06-01T19:00:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
            title: 'Sinh nhật mười hai tuổi', body: 'Mắt em đã mờ, đi lại chậm hơn, nhưng vẫn nhận ra tiếng bóc gói bánh quy bơ từ tận phòng ngoài.' },
          { at: '2025-09-12T05:30:00+07:00', layout: 'NOTE', topic: 'EVERYDAY', milestone: true, place: '', tag: ['TuongNho'],
            title: 'Gửi Lucky ở bên kia cầu vồng', body: 'Sáng hôm ấy em ngủ một giấc thật yên trong vòng tay chị. Mười ba năm, em đi cùng chị qua hết những năm tháng lớn nhất đời. Chị sẽ ổn thôi, em cứ chạy thật nhanh trên những đồng cỏ không có tiếng sấm nhé.' },
        ],
      },
    ],
  },
  {
    key: 'bao',
    email: 'quocbao.pham@demo.petmory.vn',
    fullName: 'Phạm Quốc Bảo',
    phone: '0987105263',
    avatar: '',
    address: { address: 'Số 9 Lạch Tray, Phường Đằng Giang, Quận Ngô Quyền', province: 'Hải Phòng' },
    pets: [
      {
        key: 'muc',
        photos: { dog: 'mix', count: 4 },
        isPublic: false,
        profile: {
          name: 'Mực',
          kind: 'DOG',
          breed: 'Chó ta lai',
          gender: 'MALE',
          birthDate: '2019-04-05',
          adoptionDate: '2019-06-01',
          neutered: false,
          tagline: 'Bảo vệ khu phố, sợ mỗi con mèo nhà hàng xóm',
          trait: ['Canh nhà rất giỏi', 'Sợ mèo', 'Thích ăn xương gà luộc'],
        },
        pages: [
          { at: '2019-06-01T07:30:00+07:00', layout: 'HERO', topic: 'FIRST_DAY', milestone: true, place: 'Chợ Đổ, Hải Phòng', tag: ['NgayDauTien'],
            title: 'Đón Mực từ nhà bác Tư', body: 'Bác Tư cho một con trong lứa năm con, con nào cũng đen nhẻm. Mực là con duy nhất chạy ra liếm tay mình.' },
          { at: '2023-11-18T21:00:00+07:00', layout: 'STORY', topic: 'FUNNY', place: 'Ngõ nhà mình', tag: ['QuậyPhá'],
            title: 'Dũng sĩ và con mèo mướp', body: 'Mực sủa vang cả ngõ suốt mười phút. Ra xem thì đối thủ là con mèo nhà bên đang ngồi liếm chân trên bờ tường, chẳng thèm nhìn xuống.' },
          { at: '2026-04-05T18:00:00+07:00', layout: 'DUO', topic: 'BIRTHDAY', milestone: true, place: 'Nhà mình', tag: ['SinhNhat'],
            title: 'Mực bảy tuổi', body: 'Sinh nhật đơn giản: một bát cơm trộn thịt bò và cả buổi chiều được thả rông ngoài bãi sông.' },
        ],
      },
    ],
  },
];

/** Bai viet cong dong, ke ca binh luan cua nhung nguoi khac. daysAgo lui ngay dang bai. */
const POSTS = [
  { by: 'ha', topic: 'MOMENT', daysAgo: 19, photoFrom: 'bo',
    title: 'Bơ tròn 5 tuổi rồi mọi người ơi',
    content: 'Hôm nay là sinh nhật thứ năm của Bơ. Bánh năm nay mình tự làm bằng ức gà, khoai lang và một chút sữa chua không đường, Bơ ăn sạch sẽ trong ba phút. Cảm ơn mọi người trong nhóm đã chỉ công thức nhé!',
    tags: ['corgi', 'sinhnhat'],
    comments: [
      { by: 'khoa', after: 2, text: 'Chúc mừng sinh nhật Bơ! Chân ngắn mà nhìn béo tròn đáng yêu quá.' },
      { by: 'phuonganh', after: 5, text: 'Bánh nhìn ngon thật, chị cho em xin tỉ lệ khoai với gà được không?' },
      { by: 'ha', after: 7, text: 'Khoảng 200g ức gà với 1 củ khoai lang vừa nha em, hấp chín rồi nghiền chung là được.' },
    ],
    likedBy: ['khoa', 'phuonganh', 'bao'] },
  { by: 'khoa', topic: 'EXPERIENCE', daysAgo: 15, photoFrom: 'muop',
    title: 'Mèo già lười ăn: mình đã làm thế này',
    content: 'Mướp nhà mình năm nay gần 7 tuổi, dạo gần đây bỏ bữa liên tục. Sau khi khám không thấy bệnh gì, bác sĩ khuyên chia nhỏ thành 4 bữa, hâm pate ấm khoảng bằng nhiệt độ cơ thể và đặt bát nước xa bát ăn. Sau hai tuần Mướp ăn đều lại. Nếu bé nhà bạn bỏ ăn quá 24 giờ thì vẫn nên đi khám trước nhé.',
    tags: ['meo', 'kinhnghiem'],
    comments: [
      { by: 'bao', after: 3, text: 'Mẹo hâm ấm pate hay quá, nhà mình chưa thử bao giờ.' },
      { by: 'ha', after: 26, text: 'Bơ cũng kén ăn hồi mùa hè, chia nhỏ bữa đúng là hiệu quả thật.' },
    ],
    likedBy: ['ha', 'bao'] },
  { by: 'phuonganh', topic: 'MEMORIAL', daysAgo: 12, photoFrom: 'lucky',
    title: 'Một năm không có Lucky',
    content: 'Tháng chín năm ngoái Lucky rời đi ở tuổi mười ba. Mình vẫn để chiếc nệm nhỏ của em dưới chân giường. Mình viết bài này không phải để buồn, mà để cảm ơn những ai đã nhắn hỏi thăm mình hồi ấy. Nếu bạn cũng đang trải qua cảm giác này, cứ cho mình thời gian, nỗi nhớ rồi sẽ dịu thành những kỷ niệm ấm áp.',
    tags: ['tuongnho', 'poodle'],
    comments: [
      { by: 'ha', after: 1, text: 'Ôm chị một cái thật chặt. Lucky chắc chắn đã có một đời rất hạnh phúc.' },
      { by: 'khoa', after: 4, text: 'Đọc mà rưng rưng. Cảm ơn chị đã chia sẻ.' },
    ],
    likedBy: ['ha', 'khoa', 'bao'] },
  { by: 'bao', topic: 'EXPERIENCE', daysAgo: 8, photoFrom: 'muc',
    title: 'Lịch tẩy giun và tiêm phòng cho chó ta mình đang dùng',
    content: 'Nhiều người nghĩ chó ta khoẻ nên không cần chăm kỹ, nhưng Mực từng bị giun móc rất nặng hồi nhỏ. Lịch nhà mình theo tư vấn của bác sĩ: tẩy giun 3 tháng một lần, tiêm phòng dại và 7 bệnh mỗi năm một lần, nhỏ gáy trị ve vào mùa nồm. Mọi người có kinh nghiệm gì thêm thì góp ý giúp mình nhé.',
    tags: ['chota', 'suckhoe'],
    comments: [
      { by: 'khoa', after: 6, text: 'Mùa nồm ở Hải Phòng chắc ve nhiều lắm, cảm ơn anh chia sẻ lịch cụ thể.' },
    ],
    likedBy: ['khoa', 'ha'] },
  { by: 'ha', topic: 'PRODUCT', daysAgo: 4, photoFrom: 'bo',
    title: 'Vừa nhận vòng cổ len chọc cho Bơ',
    content: 'Đặt vòng cổ len chọc màu nâu size S, ba ngày là nhận được. Len mềm, Bơ đeo cả ngày không gãi. Hộp quà giấy tái chế đi kèm cũng xinh, mình giữ lại để đựng đồ chơi của Bơ.',
    tags: ['petmory', 'review'],
    comments: [
      { by: 'phuonganh', after: 8, text: 'Màu nâu hợp với Bơ ghê. Em cũng định đặt một chiếc khung ảnh gỗ để lồng ảnh Lucky.' },
    ],
    likedBy: ['phuonganh'] },
  { by: 'khoa', topic: 'TRADE', daysAgo: 1, photoFrom: 'sua',
    title: 'Tặng lại trụ cào móng còn mới, khu vực Quận 3',
    content: 'Nhà mình mua trụ cào móng cao 60cm nhưng hai bé nhất quyết chỉ cào thảm. Còn mới khoảng 90%, ai ở gần Quận 3 cần thì nhắn mình qua đến lấy nhé, mình tặng miễn phí.',
    tags: ['tanglai', 'meo'],
    comments: [],
    likedBy: ['bao'] },
];

/** Ai theo doi ai. */
const FOLLOWS = [['ha', 'phuonganh'], ['khoa', 'ha'], ['phuonganh', 'ha'], ['bao', 'khoa'], ['ha', 'khoa']];

/** Don hang: hang co san hoac hang lam theo yeu cau, va trang thai cuoi cung. */
const ORDERS = [
  { by: 'ha', goods: [['G-VONG-LEN', 'VONG-S-NAU', 1], ['G-HOP-QUA', 'HOP-NHO', 1]], to: 'COMPLETED',
    note: 'Giao giờ hành chính giúp mình nhé.' },
  { by: 'khoa', goods: [['G-BAT-AN', 'BAT-300', 2]], to: 'SHIPPING', note: '' },
  { by: 'phuonganh', made: { productTypeCode: 'PT-03', sizeCode: 'POR-M', petName: 'Lucky' },
    goods: [['G-KHUNG-GO', 'KHUNG-13X18', 1]], to: 'IN_PRODUCTION',
    note: 'Tranh tưởng nhớ Lucky, nhờ xưởng giữ đúng màu lông kem nhạt như ảnh.' },
  { by: 'bao', goods: [['G-CHAN-NI', 'CHAN-L-BO', 1]], to: 'AWAITING_PAYMENT', note: '' },
];

// ----------------------------------------------------------------------------

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
const asJson = (token, data, method = 'POST') => ({
  method,
  headers: { 'content-type': 'application/json', ...(token ? auth(token) : {}) },
  body: JSON.stringify(data),
});

function must(res, what) {
  if (res.status >= 300) {
    throw new Error(`${what}: ${res.status} ${res.text.slice(0, 200)}`);
  }
  return res.body;
}

async function json(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status}`);
  }
  return res.json();
}

/** Duong dan anh that theo dung giong, khong lap lai. */
async function photoUrls(spec) {
  const seen = new Set();
  for (let tries = 0; seen.size < spec.count && tries < 12; tries += 1) {
    if (spec.dog) {
      const rows = (await json(`https://dog.ceo/api/breed/${spec.dog}/images/random/${spec.count}`)).message;
      rows.forEach((one) => seen.add(one));
    } else {
      const breed = spec.cat ? `&breed_ids=${spec.cat}` : '';
      const rows = await json(`https://api.thecatapi.com/v1/images/search?limit=10&mime_types=jpg,png${breed}`);
      rows.forEach((one) => seen.add(one.url));
    }
  }
  return [...seen].slice(0, spec.count);
}

async function asJpeg(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status}`);
  }
  const raw = Buffer.from(await res.arrayBuffer());
  return sharp(raw)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function uploadPhoto(token, petId, bytes, name, angle) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), name);
  if (angle) {
    form.append('angle', angle);
  }
  return must(await call(`/pet-photos/${petId}`, { method: 'POST', headers: auth(token), body: form }), 'tai anh')._id;
}

function cut(text, limit) {
  const clean = text.trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

/** Dung trang nhat ky tu mot bo cuc va cac anh da chon. */
function decorOf(layout, photoIds, title, body) {
  const items = [];
  let z = 1;
  layout.photos.forEach((slot, at) => {
    if (photoIds[at]) {
      items.push({ kind: 'PHOTO', x: slot.x, y: slot.y, width: slot.width, rotate: slot.rotate, z: z++, photo: photoIds[at] });
    }
  });
  for (const [slot, text] of [[layout.title, title], [layout.body, body]]) {
    items.push({ kind: 'TEXT', x: slot.x, y: slot.y, width: slot.width, rotate: 0, z: z++, text: cut(text, slot.limit), fontKey: slot.font });
  }
  for (const slot of layout.stickers) {
    items.push({ kind: 'STICKER', x: slot.x, y: slot.y, width: slot.width, rotate: slot.rotate, z: z++, sticker: slot.code, color: slot.color });
  }
  return items;
}

async function signIn(who) {
  return must(await call('/auth/login', asJson(null, who)), `dang nhap ${who.email}`).accessToken;
}

/** Tao mot nguoi nuoi cung toan bo thu cung, anh va nhat ky. Tra ve null neu da co. */
async function seedPerson(person) {
  const existing = await call('/auth/login', asJson(null, { email: person.email, password: PASSWORD }));
  if (existing.status === 200 || existing.status === 201) {
    console.log(`  - ${person.fullName}: da co tai khoan, bo qua`);
    return null;
  }
  const made = must(await call('/auth/register', asJson(null, {
    email: person.email, password: PASSWORD, fullName: person.fullName, phone: person.phone,
  })), `tao tai khoan ${person.email}`);
  const token = made.accessToken;
  if (person.avatar) {
    must(await call('/community/users/me', asJson(token, { avatarUrl: person.avatar }, 'PATCH')), 'anh dai dien');
  }

  const pets = {};
  for (const plan of person.pets) {
    const urls = await photoUrls(plan.photos);
    const pet = must(await call('/pets', asJson(token, { ...plan.profile, avatarUrl: urls[0] })), `ho so ${plan.profile.name}`);
    const photoIds = [];
    for (const [at, url] of urls.entries()) {
      const bytes = await asJpeg(url);
      photoIds.push(await uploadPhoto(token, pet._id, bytes, `${plan.key}-${at + 1}.jpg`, at === 0 ? 'FRONT' : undefined));
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
        pet: pet._id,
        title: page.title,
        body: page.body,
        happenedAt: new Date(page.at).toISOString(),
        place: page.place,
        topic: page.topic,
        tag: page.tag,
        photo: chosen,
        decor: decorOf(layout, chosen, page.title, page.body),
        paper: layout.paper,
        isMilestone: Boolean(page.milestone),
      })), `trang "${page.title}"`);
    }
    if (plan.isPublic) {
      must(await call(`/memories/pet/${pet._id}/privacy`, asJson(token, { isPublic: true }, 'PATCH')), 'cong khai');
    }
    pets[plan.key] = { id: pet._id, firstPhoto: urls[0], photoUrls: urls };
    console.log(`  + ${plan.profile.name}: ${photoIds.length} anh, ${plan.pages.length} trang${plan.isPublic ? ', cong khai' : ''}`);
  }
  console.log(`  + ${person.fullName}`);
  const me = must(await call('/auth/me', { headers: auth(token) }), 'doc tai khoan');
  return { token, id: me.userId, pets };
}

async function seedCommunity(people) {
  const made = [];
  for (const post of POSTS) {
    const author = people[post.by];
    if (!author) {
      continue;
    }
    const petKey = post.photoFrom;
    const owner = Object.values(people).find((one) => one.pets[petKey]);
    const created = must(await call('/community/posts', asJson(author.token, {
      topic: post.topic, title: post.title, content: post.content, tags: post.tags,
    })), `bai "${post.title}"`);
    const id = created.id ?? created._id;
    if (owner) {
      const pick = owner.pets[petKey].photoUrls;
      await call(`/community/posts/${id}/photos/from-link`, asJson(author.token, { url: pick[pick.length - 1] }));
    }
    const comments = [];
    for (const one of post.comments) {
      const writer = people[one.by];
      if (writer) {
        const c = must(await call(`/community/posts/${id}/comments`, asJson(writer.token, { content: one.text })), 'binh luan');
        comments.push({ id: c.id ?? c._id, after: one.after });
      }
    }
    for (const who of post.likedBy) {
      if (people[who]) {
        await call(`/community/posts/${id}/like`, asJson(people[who].token, {}));
      }
    }
    made.push({ id, daysAgo: post.daysAgo, comments });
  }
  for (const [from, to] of FOLLOWS) {
    if (people[from] && people[to]) {
      await call(`/community/users/${people[to].id}/follow`, asJson(people[from].token, {}));
    }
  }
  console.log(`  + ${made.length} bai viet, ${made.reduce((t, one) => t + one.comments.length, 0)} binh luan`);
  return made;
}

async function seedOrders(people, boss) {
  for (const plan of ORDERS) {
    const who = people[plan.by];
    if (!who) {
      continue;
    }
    const person = PEOPLE.find((one) => one.key === plan.by);
    await call('/cart', { method: 'DELETE', headers: auth(who.token) });
    if (plan.made) {
      must(await call('/cart/items', asJson(who.token, { ...plan.made, quantity: 1 })), 'gio: hang lam theo yeu cau');
    }
    for (const [goodsCode, sku, quantity] of plan.goods) {
      must(await call('/cart/goods', asJson(who.token, { goodsCode, sku, quantity })), `gio: ${goodsCode}`);
    }
    const order = must(await call('/orders', asJson(who.token, {
      fullName: person.fullName, phone: person.phone, ...person.address, note: plan.note,
    })), 'dat hang');
    const code = order.orderCode;
    const total = Number(String(order.total?.$numberDecimal ?? order.total).split('.')[0]);

    if (plan.to !== 'AWAITING_PAYMENT') {
      must(await call('/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Apikey ${WEBHOOK_KEY}` },
        body: JSON.stringify({ id: `seed-${code}`, transferAmount: total, content: `${code} thanh toan don hang` }),
      }), 'thanh toan');
    }
    const steps = {
      COMPLETED: ['SHIPPING', 'COMPLETED'],
      SHIPPING: ['SHIPPING'],
      IN_PRODUCTION: ['IN_PRODUCTION'],
      AWAITING_PAYMENT: [],
    }[plan.to];
    for (const step of steps) {
      must(await call(`/admin/orders/${code}/status`, asJson(boss, { status: step, reason: '' }, 'PATCH')), `chuyen ${step}`);
    }
    console.log(`  + ${code} cua ${person.fullName}: ${plan.to}`);
  }
}

/** Lui ngay bai viet va binh luan, de dong tin giong mot cong dong da song vai tuan. */
async function backdate(posts) {
  const uri = process.env.SEED_DB_URI;
  if (!uri) {
    console.log('  (khong dat SEED_DB_URI nen bai viet giu ngay hom nay)');
    return;
  }
  const { MongoClient, ObjectId } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  const hour = 60 * 60 * 1000;
  for (const post of posts) {
    const at = new Date(Date.now() - post.daysAgo * 24 * hour - 3 * hour);
    await db.collection('community_posts').updateOne({ _id: new ObjectId(post.id) }, { $set: { createdAt: at, updatedAt: at } });
    for (const one of post.comments) {
      const when = new Date(at.getTime() + one.after * hour);
      await db.collection('community_comments').updateOne({ _id: new ObjectId(one.id) }, { $set: { createdAt: when, updatedAt: when } });
    }
  }
  await client.close();
  console.log('  + da lui ngay bai viet va binh luan');
}

async function run() {
  console.log(`SEED DU LIEU TRINH DIEN -> ${API}`);
  const people = {};
  for (const person of PEOPLE) {
    const done = await seedPerson(person);
    if (done) {
      people[person.key] = done;
    }
  }
  if (Object.keys(people).length === 0) {
    console.log('Khong co nguoi moi nao, khong lam gi them.');
    return;
  }
  console.log('Cong dong:');
  const posts = await seedCommunity(people);
  console.log('Don hang:');
  await seedOrders(people, await signIn(BOSS));
  await backdate(posts);
  console.log('Xong. Mat khau cua ca bon tai khoan: ' + PASSWORD);
}

module.exports = {
  API, PASSWORD, BOSS, WEBHOOK_KEY, LAYOUTS,
  call, auth, asJson, must, photoUrls, asJpeg, uploadPhoto, decorOf, signIn,
};

if (require.main === module) {
  run().catch((trouble) => {
    console.error(trouble);
    process.exit(1);
  });
}
