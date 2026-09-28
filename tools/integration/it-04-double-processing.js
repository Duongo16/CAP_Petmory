/**
 * IT-04 — The same thing happening twice must only count once.
 *
 * The finance rules require that money is never processed twice and that a
 * duplicate is stopped by the database rather than by a read-then-write in the
 * service. Every check here fires the same request twice, several of them at
 * the same instant, and looks at what the system settled on.
 *
 * Run: node tools/integration/it-04-double-processing.js
 */
const h = require('./harness');

async function placeOrder(customer) {
  const product = await h.call('/catalog/products/PT-02');
  const size = product.body.sizes.find((s) => s.enabled);
  await h.call('/cart/items', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ productTypeCode: 'PT-02', sizeCode: size.code, quantity: 1 }),
  });
  const order = await h.call('/orders', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({
      fullName: 'IT trung lap',
      phone: '0933444555',
      address: '4 Duong IT',
      province: 'Can Tho',
    }),
  });
  return { code: order.body.orderCode, total: h.dong(order.body.total) };
}

async function scenario(report) {
  const customer = await h.newCustomer('double');
  const manager = await h.signInInternal(h.ACCOUNT_MANAGER);

  // --- The same transaction id arriving twice ---
  report.step('The same bank transaction sent twice is only acted on once');
  const order = await placeOrder(customer);
  const transactionId = `it-dup-${Date.now()}`;

  const firstSend = await h.sendTransfer(order.code, Number(order.total), transactionId);
  report.require('The first notification matches', firstSend.body.result === 'MATCHED',
    firstSend.body.result);

  const secondSend = await h.sendTransfer(order.code, Number(order.total), transactionId);
  report.check('The repeat is recognised as already handled',
    secondSend.body.result === 'ALREADY_PROCESSED', secondSend.body.result);

  const afterRepeat = await h.call(`/orders/${order.code}`, { headers: customer.auth });
  report.check('The order is paid exactly once', afterRepeat.body.status === 'PAID');
  report.check('The order total did not double',
    h.dong(afterRepeat.body.total) === order.total, String(h.dong(afterRepeat.body.total)));

  const log = await h.call('/payments/log', { headers: manager.auth });
  const sameId = log.body.filter((r) => r.transactionId === transactionId);
  report.check('The log keeps one row per transaction id',
    sameId.length === 1, `${sameId.length} rows`);

  // --- Two notifications at the same instant ---
  report.step('Two notifications firing at the same instant');
  const racy = await placeOrder(customer);
  const raceId = `it-race-${Date.now()}`;
  const [a, b] = await Promise.all([
    h.sendTransfer(racy.code, Number(racy.total), raceId),
    h.sendTransfer(racy.code, Number(racy.total), raceId),
  ]);
  const outcomes = [a.body.result, b.body.result].sort();
  report.check('Exactly one of the two is treated as the payment',
    outcomes.filter((r) => r === 'MATCHED').length === 1, outcomes.join(' + '));

  const afterRace = await h.call(`/orders/${racy.code}`, { headers: customer.auth });
  report.check('The order still ends up paid once', afterRace.body.status === 'PAID');

  const raceLog = await h.call('/payments/log', { headers: manager.auth });
  report.check('Only one row was written for the racing pair',
    raceLog.body.filter((r) => r.transactionId === raceId).length === 1);

  // --- A heart toggled twice at the same instant ---
  report.step('A heart clicked twice at the same instant settles on one answer');
  const post = await h.call('/community/posts', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ topic: 'MOMENT', title: 'IT trung lap', content: 'Kiem tra bam hai lan' }),
  });
  report.require('The post is written', post.status === 201, String(post.status));
  const postId = post.body._id;

  const reader = await h.newCustomer('double-reader');
  const [likeA, likeB] = await Promise.all([
    h.call(`/community/posts/${postId}/like`, { method: 'POST', headers: reader.auth }),
    h.call(`/community/posts/${postId}/like`, { method: 'POST', headers: reader.auth }),
  ]);
  const counts = [likeA.body?.likeCount, likeB.body?.likeCount];
  report.check('The heart count never goes above one',
    counts.every((c) => c === 0 || c === 1), counts.join(' / '));

  const seen = await h.call(`/community/posts/${postId}`, { headers: reader.auth });
  report.check('The stored count agrees with the rows',
    seen.body.post.likeCount === 0 || seen.body.post.likeCount === 1,
    String(seen.body.post.likeCount));

  // --- A favourite toggled twice at the same instant ---
  report.step('A favourite clicked twice at the same instant settles on one answer');
  await Promise.all([
    h.call('/favourites/PT-01/toggle', { method: 'POST', headers: reader.auth }),
    h.call('/favourites/PT-01/toggle', { method: 'POST', headers: reader.auth }),
  ]);
  const codes = await h.call('/favourites/codes', { headers: reader.auth });
  const marked = codes.body.filter((c) => c === 'PT-01');
  report.check('The product is marked at most once',
    marked.length <= 1, `${marked.length} rows`);

  // --- The same review sent twice ---
  report.step('The same review sent twice leaves one review');
  const journey = await placeOrder(customer);
  await h.sendTransfer(journey.code, Number(journey.total));
  for (const status of ['IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP', 'SHIPPING', 'DELIVERED']) {
    await h.call(`/admin/orders/${journey.code}/status`, {
      method: 'PATCH',
      headers: manager.auth,
      body: JSON.stringify({ status, reason: 'IT trung lap' }),
    });
  }

  const before = await h.call('/catalog/products/PT-02');
  const countBefore = before.body.rating.count;

  /*
   * The wording carries a marker unique to this run. The database is shared
   * with every earlier run, so a fixed phrase would match their reviews too and
   * the count would say nothing.
   */
  const mark = `IT-${Date.now()}`;
  const review = {
    productTypeCode: 'PT-02',
    orderCode: journey.code,
    rating: 4,
    comment: `${mark} lan mot`,
  };
  await h.call('/reviews', { method: 'POST', headers: customer.auth, body: JSON.stringify(review) });
  await h.call('/reviews', {
    method: 'POST',
    headers: customer.auth,
    body: JSON.stringify({ ...review, rating: 2, comment: `${mark} lan hai` }),
  });

  const after = await h.call('/catalog/products/PT-02');
  report.check('The second review replaces the first rather than adding one',
    after.body.rating.count === countBefore + 1,
    `${countBefore} -> ${after.body.rating.count}`);

  const listed = await h.call('/reviews/product/PT-02');
  const mine = listed.body.filter((r) => String(r.comment).startsWith(mark));
  report.check('Only the later wording is kept',
    mine.length === 1 && mine[0].comment === `${mark} lan hai`,
    mine.map((r) => r.comment).join(','));
}

if (require.main === module) {
  h.runScenario('IT-04  NOTHING IS PROCESSED TWICE', scenario).then((r) => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

module.exports = { name: 'IT-04 Double processing', scenario };
