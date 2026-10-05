/**
 * Ghi nam mau hop va khung vao danh muc qua API, bang tai khoan Quan ly (co nhat ky).
 * Mau da co cung ma thi giu nguyen, khong ghi de, de gia Quan ly da sua khong bi doi.
 * Run: node tools/seed-packaging.js          (chay thu, chi in ra se ghi gi)
 *      node tools/seed-packaging.js write    (ghi that)
 */
const API = process.env.API_URL || 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: process.env.MANAGER_PASSWORD || 'Petmory@2026' };

const PACKAGING = [
  { kind: 'BOX', code: 'BOX-KRAFT', displayName: 'Hộp giấy kraft', priceDelta: '0', sortOrder: 1,
    description: 'Hộp giấy kraft có lót xốp, đi kèm mọi đơn.' },
  { kind: 'BOX', code: 'BOX-GIFT', displayName: 'Hộp quà nam châm', priceDelta: '59000', sortOrder: 2,
    description: 'Hộp cứng nắp nam châm, kèm thiệp viết tay.' },
  { kind: 'BOX', code: 'BOX-WOOD', displayName: 'Hộp gỗ khắc tên', priceDelta: '149000', sortOrder: 3,
    description: 'Hộp gỗ thông, khắc tên bé trên nắp.' },
  { kind: 'FRAME', code: 'FRAME-ACRYLIC', displayName: 'Lồng mica trong', priceDelta: '129000', sortOrder: 1,
    description: 'Lồng mica trong suốt chống bụi, đặt trùm lên tượng.' },
  { kind: 'FRAME', code: 'FRAME-SHADOW', displayName: 'Khung hộp treo tường', priceDelta: '189000', sortOrder: 2,
    description: 'Khung gỗ sâu lòng, treo tường, mặt kính.' },
];

async function run() {
  const write = process.argv[2] === 'write';
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(MANAGER),
  })).json();
  const head = { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` };
  const have = await (await fetch(`${API}/catalog/packaging`, { headers: head })).json();
  const codes = new Set(have.map((one) => one.code));
  const todo = PACKAGING.filter((one) => !codes.has(one.code));
  console.log(`Dang co ${have.length} mau; se them ${todo.length}: ${todo.map((one) => one.code).join(', ') || '(khong)'}`);
  if (!write) {
    console.log('Chay thu, chua ghi. Them tham so write de ghi that.');
    return;
  }
  for (const one of todo) {
    const res = await fetch(`${API}/catalog/packaging`, { method: 'POST', headers: head, body: JSON.stringify(one) });
    console.log(one.code, res.status);
  }
}

run().catch((e) => {
  console.error('Loi:', e.message);
  process.exit(1);
});
