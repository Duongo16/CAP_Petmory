/**
 * Makes one customer account and checks it can sign in.
 *
 * It goes through the public interface rather than writing to the database, so
 * the account is made exactly the way a real sign-up makes one: the password is
 * hashed by the server and every rule the server applies is applied here too.
 *
 * Run: node tools/make-account.js
 *      node tools/make-account.js ten@email.com "Mat khau" "Ho va ten"
 */
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';

const EMAIL = process.argv[2] ?? 'khachhang@petmory.local';
const PASSWORD = process.argv[3] ?? 'Petmory@2026';
const FULL_NAME = process.argv[4] ?? 'Khach hang Petmory';

async function post(path, body) {
  const answer = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await answer.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: answer.status, body: parsed, text };
}

async function run() {
  console.log('TAO TAI KHOAN KHACH HANG');
  console.log('='.repeat(60));

  const made = await post('/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    fullName: FULL_NAME,
  });

  if (made.status === 409) {
    console.log('  Tai khoan nay da co san, khong tao lai.');
  } else if (made.status !== 201 && made.status !== 200) {
    console.log(`  Khong tao duoc. May chu tra ve ${made.status}.`);
    console.log(`  ${made.text.slice(0, 300)}`);
    process.exit(1);
  } else {
    console.log('  Da tao xong tai khoan.');
  }

  // Dang nhap thu, de chac chan tai khoan dung la dung duoc chu khong chi la co.
  const signedIn = await post('/auth/login', { email: EMAIL, password: PASSWORD });
  if (signedIn.status !== 200 && signedIn.status !== 201) {
    console.log(`  Nhung dang nhap khong duoc: may chu tra ve ${signedIn.status}.`);
    process.exit(1);
  }

  const who = signedIn.body?.user;
  console.log('  Dang nhap thu: duoc.');
  console.log('');
  console.log(`  Email     : ${EMAIL}`);
  console.log(`  Mat khau  : ${PASSWORD}`);
  console.log(`  Ho va ten : ${who?.fullName ?? FULL_NAME}`);
  console.log(`  Nhom quyen: ${(who?.roles ?? ['CUSTOMER']).join(', ')}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('Dang nhap tai http://localhost:4200/login');
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  console.error('Kiem tra may chu API da chay chua, va may chu co vao duoc co so du lieu khong.');
  process.exit(1);
});
