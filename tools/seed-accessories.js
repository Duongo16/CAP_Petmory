/**
 * Ghi sau phu kien mau vao danh muc qua API, bang tai khoan Quan ly (co nhat ky).
 * Phu kien da co cung ma thi giu nguyen, khong ghi de.
 * Run: node tools/seed-accessories.js          (chay thu, chi in ra se ghi gi)
 *      node tools/seed-accessories.js write    (ghi that)
 */
const API = process.env.API_URL || 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: process.env.MANAGER_PASSWORD || 'Petmory@2026' };

const ACCESSORIES = [
  { code: 'ACC-KNIT-HAT', displayName: 'Mũ len', anchor: 'HEAD', modelFile: 'acc-knit-hat.glb', priceDelta: '45000', sortOrder: 1,
    description: 'Mũ len có quả bông, đội trên đầu bé.' },
  { code: 'ACC-BOW', displayName: 'Nơ cài đầu', anchor: 'HEAD', modelFile: 'acc-bow.glb', priceDelta: '30000', sortOrder: 2,
    description: 'Nơ vải cài lệch một bên đầu.' },
  { code: 'ACC-COLLAR-TAG', displayName: 'Vòng cổ thẻ tên', anchor: 'NECK', modelFile: 'acc-collar-tag.glb', priceDelta: '40000', sortOrder: 3,
    description: 'Vòng cổ kèm thẻ tên tròn.' },
  { code: 'ACC-SCARF', displayName: 'Khăn quàng', anchor: 'NECK', modelFile: 'acc-scarf.glb', priceDelta: '45000', sortOrder: 4,
    description: 'Khăn len quàng cổ, có tua.' },
  { code: 'ACC-GLASSES', displayName: 'Kính tròn', anchor: 'FACE', modelFile: 'acc-round-glasses.glb', priceDelta: '35000', sortOrder: 5,
    description: 'Kính gọng tròn đeo trên mặt.' },
  { code: 'ACC-CAPE', displayName: 'Áo choàng', anchor: 'BACK', modelFile: 'acc-cape.glb', priceDelta: '60000', sortOrder: 6,
    description: 'Áo choàng vải khoác trên lưng.' },
];

async function run() {
  const write = process.argv[2] === 'write';
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(MANAGER),
  })).json();
  const head = { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` };
  const have = await (await fetch(`${API}/catalog/accessories`, { headers: head })).json();
  const codes = new Set(have.map((one) => one.code));
  const todo = ACCESSORIES.filter((one) => !codes.has(one.code));
  console.log(`Dang co ${have.length} phu kien; se them ${todo.length}: ${todo.map((one) => one.code).join(', ') || '(khong)'}`);
  if (!write) {
    console.log('Chay thu, chua ghi. Them tham so write de ghi that.');
    return;
  }
  for (const one of todo) {
    const res = await fetch(`${API}/catalog/accessories`, { method: 'POST', headers: head, body: JSON.stringify(one) });
    console.log(one.code, res.status);
  }
}

run().catch((e) => {
  console.error('Loi:', e.message);
  process.exit(1);
});
