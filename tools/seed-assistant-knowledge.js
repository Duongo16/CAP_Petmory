/**
 * Gieo kho tri thuc mau cho tro ly hoi thoai (Phu luc 01, muc 9 va 18).
 *
 * Moi muc di qua duong quan tri cua nhom Quan ly, nen co kiem tra du lieu va
 * duoc ghi nhat ky. Muc nao da co ma thi bo qua, chay lai khong tao trung va
 * khong ghi de nhung gi nhom Quan ly da sua.
 *
 * Cac o trong ngoac nhon doi duoc tro ly dien bang so lieu that luc tra loi:
 *   {{BANG_GIA}} {{KICH_CO}} {{THOI_GIAN}} {{CHAT_LIEU}} {{SO_NGAY_GIAO}} {{HANG_CO_SAN}}
 *
 * Chay: PETMORY_API=http://localhost:3000/api node tools/seed-assistant-knowledge.js
 */
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

const ENTRIES = [
  {
    code: 'GREETING', topic: 'OTHER', sortOrder: 1,
    question: 'Xin chào',
    keywords: ['xin chao', 'chao ban', 'chao shop', 'hello', 'alo'],
    answer: 'Chào bạn! Mình là trợ lý của PETMORY. Mình có thể giúp bạn tìm hiểu sản phẩm len chọc làm theo ảnh thú cưng, giá, kích cỡ, thời gian làm và cách đặt hàng.',
    followUp: ['PRICE', 'PROCESS', 'READY_MADE'],
  },
  {
    code: 'PRICE', topic: 'PRODUCT', sortOrder: 10, starter: true,
    question: 'Giá sản phẩm bao nhiêu?',
    keywords: ['bao nhieu tien', 'gia bao nhieu', 'gia ca', 'chi phi', 'bang gia', 'het bao nhieu', 'mac khong', 'gia'],
    answer: 'Giá theo từng loại sản phẩm và kích cỡ:\n{{BANG_GIA}}\n\nGiá đã gồm công làm tay và hộp đựng. Phí vận chuyển do đơn vị giao hàng thu khi giao, không nằm trong số tiền thanh toán trên web.',
    link: '/shop?tab=custom', followUp: ['SIZES', 'LEAD_TIME', 'PROCESS'],
  },
  {
    code: 'SIZES', topic: 'SIZE', sortOrder: 20, starter: true,
    question: 'Có những kích cỡ nào?',
    keywords: ['kich co', 'kich thuoc', 'size', 'co nao', 'co lon', 'co nho', 'co vua', 'to nho', 'cao bao nhieu', 'bao to'],
    answer: 'Các kích cỡ đang nhận làm:\n{{KICH_CO}}\n\nCỡ lớn thể hiện được nhiều chi tiết hơn như đốm lông nhỏ hay biểu cảm mắt.',
    link: '/shop?tab=custom', followUp: ['PRICE', 'LEAD_TIME'],
  },
  {
    code: 'LEAD_TIME', topic: 'LEAD_TIME', sortOrder: 30, starter: true,
    question: 'Làm mất bao lâu?',
    keywords: ['bao lau', 'may ngay', 'thoi gian lam', 'thoi gian san xuat', 'khi nao nhan', 'lau khong', 'bao gio xong'],
    answer: 'Thời gian: {{THOI_GIAN}}. Mỗi bé được làm tay từng chiếc một nên khó rút ngắn nhiều. Ngày giao dự kiến hiện ngay khi bạn đặt hàng và trong trang Đơn hàng của tôi.',
    link: '/orders', followUp: ['SHIPPING', 'PROCESS'],
  },
  {
    code: 'MATERIAL', topic: 'PRODUCT', sortOrder: 40,
    question: 'Sản phẩm làm bằng chất liệu gì?',
    keywords: ['chat lieu', 'lam bang gi', 'nguyen lieu', 'len gi', 'ben khong', 'tai che'],
    answer: 'Sản phẩm làm thủ công từ {{CHAT_LIEU}}. Mỗi bé là một bản riêng, không chiếc nào giống chiếc nào. Bạn nên tránh để sản phẩm ở nơi ẩm và phủi bụi nhẹ bằng chổi lông mềm.',
    followUp: ['PRICE', 'PROCESS'],
  },
  {
    code: 'PROCESS', topic: 'ORDER', sortOrder: 50, starter: true,
    question: 'Đặt hàng như thế nào?',
    keywords: ['dat hang', 'cach dat', 'quy trinh', 'mua nhu the nao', 'lam sao de mua', 'cach mua', 'buoc nao'],
    answer: 'Đặt một bé len rất đơn giản:\n1. Tạo hồ sơ thú cưng và tải ảnh của bé\n2. Vào Studio 3D chọn mẫu, phối màu từng vùng, khắc tên\n3. Chọn kích cỡ, thêm vào giỏ và nhập thông tin nhận hàng\n4. Thanh toán bằng mã QR, xưởng bắt đầu làm ngay khi nhận đủ tiền.',
    link: '/studio', followUp: ['PHOTO', 'PAYMENT', 'LEAD_TIME'],
  },
  {
    code: 'PHOTO', topic: 'ORDER', sortOrder: 60, starter: true,
    question: 'Cần gửi ảnh thú cưng thế nào?',
    keywords: ['gui anh', 'tai anh', 'chup anh', 'anh nhu the nao', 'bao nhieu anh', 'anh mo', 'anh cu', 'may goc', 'goc chup'],
    answer: 'Bạn tải ảnh JPG hoặc PNG trong hồ sơ của bé. Nên có đủ bốn góc: chính diện, nghiêng trái, nghiêng phải và phía sau, chụp nơi đủ sáng, thấy rõ màu lông. Ảnh cũ hoặc hơi mờ có thể dùng chức năng phục hồi ảnh để làm nét trước.',
    link: '/pets', followUp: ['RESTORE', 'PROCESS'],
  },
  {
    code: 'RESTORE', topic: 'ORDER', sortOrder: 65,
    question: 'Ảnh của bé bị mờ thì sao?',
    keywords: ['anh bi mo', 'phuc hoi', 'lam net', 'anh xau', 'anh toi', 'anh nho'],
    answer: 'Bạn dùng chức năng Phục hồi ảnh: tải ảnh lên, hệ thống làm nét, khử nhiễu, chỉnh sáng rồi cho bạn so sánh trước và sau, sau đó tải về máy. Ảnh gốc của bạn không bị thay đổi.',
    link: '/restore', followUp: ['PHOTO'],
  },
  {
    code: 'PAYMENT', topic: 'PAYMENT', sortOrder: 70, starter: true,
    question: 'Thanh toán bằng cách nào?',
    keywords: ['thanh toan', 'tra tien', 'chuyen khoan', 'ma qr', 'qr', 'dat coc', 'coc truoc', 'tra gop', 'tien mat', 'cod'],
    answer: 'PETMORY nhận thanh toán một lần toàn bộ giá trị đơn bằng mã QR chuyển khoản. Bạn quét mã, giữ nguyên nội dung chuyển khoản có mã đơn, hệ thống tự xác nhận khi nhận đủ tiền. Không có đặt cọc, trả góp hay thu tiền khi nhận hàng.',
    followUp: ['PAYMENT_LATE', 'CANCEL'],
  },
  {
    code: 'PAYMENT_LATE', topic: 'PAYMENT', sortOrder: 75,
    question: 'Đã chuyển khoản mà đơn chưa xác nhận?',
    keywords: ['chua xac nhan', 'da chuyen khoan', 'chuyen roi', 'chua nhan duoc tien', 'sai noi dung', 'chuyen thieu'],
    answer: 'Đơn được xác nhận tự động khi nội dung chuyển khoản có đúng mã đơn và đủ số tiền. Nếu bạn ghi sai nội dung hoặc chuyển thiếu, hệ thống sẽ không tự xử lý. Bạn bấm "Gặp tư vấn viên" và gửi mã đơn, nhóm Chăm sóc khách hàng sẽ kiểm tra giúp bạn.',
    link: '/orders', followUp: ['PAYMENT'],
  },
  {
    code: 'SHIPPING', topic: 'SHIPPING', sortOrder: 80,
    question: 'Giao hàng thế nào, phí ship bao nhiêu?',
    keywords: ['giao hang', 'van chuyen', 'phi ship', 'ship', 'giao toi', 'nuoc ngoai', 'quoc te', 'tinh nao'],
    answer: 'PETMORY giao hàng trong nước, khoảng {{SO_NGAY_GIAO}} ngày sau khi xưởng làm xong. Phí vận chuyển do đơn vị giao hàng thu trực tiếp khi giao, không tính vào số tiền thanh toán trên web. Hiện chưa nhận giao quốc tế.',
    link: '/orders', followUp: ['LEAD_TIME'],
  },
  {
    code: 'READY_MADE', topic: 'PRODUCT', sortOrder: 90, starter: true,
    question: 'Shop có bán sản phẩm có sẵn không?',
    keywords: ['co san', 'hang co san', 'phu kien', 'do dung', 'vong co', 'bat an', 'khung anh', 'hop qua', 'chan', 'the ten'],
    answer: 'Có, ngoài sản phẩm làm theo ảnh, cửa hàng bán kèm một số món có sẵn:\n{{HANG_CO_SAN}}\n\nHàng có sẵn không cần tải ảnh hay tùy biến, đặt chung giỏ với hàng làm theo ảnh và thanh toán một lần.',
    link: '/shop?tab=ready', followUp: ['PAYMENT', 'SHIPPING'],
  },
  {
    code: 'CANCEL', topic: 'POLICY', sortOrder: 100,
    question: 'Tôi muốn hủy đơn được không?',
    keywords: ['huy don', 'khong mua nua', 'doi y', 'hoan tien', 'tra hang', 'doi tra'],
    answer: 'Đơn chưa thanh toán bạn tự hủy được trong trang Đơn hàng của tôi. Đơn đã thanh toán thì cần nhóm Chăm sóc khách hàng hỗ trợ, bạn bấm "Gặp tư vấn viên" và gửi mã đơn nhé. Sản phẩm làm theo ảnh là hàng độc bản nên không áp dụng đổi trả sau khi xưởng đã làm.',
    link: '/orders', followUp: ['PAYMENT'],
  },
  {
    code: 'MEMORIAL', topic: 'PRODUCT', sortOrder: 110,
    question: 'Bé nhà tôi đã mất, có làm được không?',
    keywords: ['da mat', 'qua doi', 'mat roi', 'khong con nua', 'tuong nho', 'ra di', 'cau vong'],
    answer: 'Mình rất tiếc về sự mất mát của bạn. Rất nhiều khách đến với PETMORY để giữ lại hình ảnh của bé. Bạn chỉ cần những tấm ảnh còn giữ được, kể cả ảnh cũ hay hơi mờ. Hộp kỷ niệm có thể khắc tên, ngày tưởng nhớ và một lời nhắn cho bé.',
    link: '/studio', followUp: ['PHOTO', 'SIZES'],
  },
  {
    code: 'VET', topic: 'POLICY', sortOrder: 120,
    question: 'Bé bị ốm thì nên làm gì?',
    keywords: ['bi om', 'bi benh', 'thuoc', 'bac si', 'thu y', 'non mua', 'bo an', 'tieu chay'],
    answer: 'Phần sức khỏe ngoài chuyên môn của mình. Bạn nên đưa bé tới bác sĩ thú y để được khám và tư vấn đúng nhé. Chúc bé mau khỏe!',
    followUp: ['PROCESS'],
  },
  {
    code: 'CONTACT', topic: 'OTHER', sortOrder: 130,
    question: 'Làm sao để gặp nhân viên tư vấn?',
    keywords: ['gap nguoi', 'nhan vien', 'tu van vien', 'nguoi that', 'lien he', 'hotline', 'so dien thoai shop'],
    answer: 'Bạn bấm nút "Gặp tư vấn viên" ngay bên dưới khung chat. Nhóm Chăm sóc khách hàng sẽ nhận cuộc trò chuyện và trả lời bạn tại đây, tin nhắn cũ vẫn được giữ lại.',
    followUp: [],
  },
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

async function run() {
  console.log(`GIEO KHO TRI THUC TRO LY -> ${API}`);
  const login = await call('/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(BOSS),
  });
  const token = login.body?.accessToken;
  if (!token) {
    throw new Error(`Khong dang nhap duoc nhom Quan ly: ${login.status}`);
  }
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  const have = new Set(((await call('/admin/assistant/knowledge', { headers })).body ?? []).map((one) => one.code));
  let made = 0;
  for (const entry of ENTRIES) {
    if (have.has(entry.code)) {
      console.log(`  - ${entry.code}: da co, bo qua`);
      continue;
    }
    const res = await call('/admin/assistant/knowledge', { method: 'POST', headers, body: JSON.stringify(entry) });
    if (res.status >= 300) {
      throw new Error(`${entry.code}: ${res.status} ${res.text.slice(0, 200)}`);
    }
    made += 1;
  }
  console.log(`Xong: them ${made} muc, ${ENTRIES.length - made} muc da co.`);
}

run().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
