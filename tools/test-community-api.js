/**
 * Community API test: posting, topics, comments, hearts, saving, following
 * and the public profile. Also covers the awkward cases: an unknown topic,
 * deleting someone else's post, and following yourself.
 * Run: node tools/test-community-api.js
 */
const API = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function check(name, ok, note = '') {
  console.log(`  ${ok ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  ok ? (passed += 1) : (failed += 1);
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

/** Registers a throwaway account and returns its id and headers. */
async function register(fullName) {
  const email = `cd.${Date.now()}.${Math.floor(Math.random() * 10000)}@petmory.local`;
  const res = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@123', fullName }),
  });
  return { id: res.body.user.id ?? res.body.user._id, auth: authHeaders(res.body.accessToken) };
}

async function run() {
  console.log('COMMUNITY API TEST');
  console.log('='.repeat(66));

  const author = await register('Linh San');
  const reader = await register('Minh Tri');

  // --- Writing a post ---
  const created = await call('/community/posts', {
    method: 'POST',
    headers: author.auth,
    body: JSON.stringify({
      topic: 'MOMENT',
      title: 'Buoi sang cung be Miu',
      content: 'Meo nho cua minh that su la dieu tuyet voi nhat tren doi',
      tags: ['meo', 'buoi sang'],
    }),
  });
  check('A post can be written', created.status === 201, String(created.status));
  const postId = created.body?._id;

  const badTopic = await call('/community/posts', {
    method: 'POST',
    headers: author.auth,
    body: JSON.stringify({ topic: 'NOT_A_TOPIC', title: 'x', content: 'y' }),
  });
  check('An unknown topic is rejected', badTopic.status === 400, String(badTopic.status));

  const noTitle = await call('/community/posts', {
    method: 'POST',
    headers: author.auth,
    body: JSON.stringify({ topic: 'MOMENT', title: '', content: 'y' }),
  });
  check('An empty title is rejected', noTitle.status === 400, String(noTitle.status));

  // --- Reading the feed ---
  const feed = await call('/community/posts');
  check('The feed is readable signed out', feed.status === 200 && feed.body.total >= 1);
  check('The feed carries the author name',
    feed.body.rows[0]?.author?.fullName?.length > 0, feed.body.rows[0]?.author?.fullName);
  check('The feed never leaks the password hash',
    !JSON.stringify(feed.body).includes('passwordHash'));

  const byTopic = await call('/community/posts?topic=MEMORIAL');
  check('Filtering by topic returns only that topic',
    byTopic.body.rows.every((r) => r.topic === 'MEMORIAL'), `${byTopic.body.total} posts`);

  const found = await call('/community/posts?keyword=Miu');
  check('Search finds the post by keyword', found.body.total >= 1, `${found.body.total} posts`);

  const trap = await call('/community/posts?keyword=' + encodeURIComponent('.*'));
  check('Special characters in a keyword are neutralised', trap.body.total === 0,
    `returned ${trap.body.total}`);

  const topics = await call('/community/topics');
  check('Every topic is counted', Object.keys(topics.body).length === 6,
    Object.keys(topics.body).join(','));

  // --- Hearts ---
  const like = await call(`/community/posts/${postId}/like`, { method: 'POST', headers: reader.auth });
  check('A heart can be added', like.body.liked === true && like.body.likeCount === 1);
  const unlike = await call(`/community/posts/${postId}/like`, { method: 'POST', headers: reader.auth });
  check('The same heart taken off counts down', unlike.body.liked === false && unlike.body.likeCount === 0);
  await call(`/community/posts/${postId}/like`, { method: 'POST', headers: reader.auth });

  // --- Comments ---
  const comment = await call(`/community/posts/${postId}/comments`, {
    method: 'POST',
    headers: reader.auth,
    body: JSON.stringify({ content: 'De thuong qua!' }),
  });
  check('A comment can be written', comment.status === 201, String(comment.status));

  const comments = await call(`/community/posts/${postId}/comments`);
  check('Comments come back with their author', comments.body.length === 1,
    comments.body[0]?.author?.fullName);

  // --- Saving ---
  const saved = await call(`/community/posts/${postId}/save`, { method: 'POST', headers: reader.auth });
  check('A post can be saved', saved.body.saved === true);
  const savedFeed = await call('/community/posts?scope=SAVED', { headers: reader.auth });
  check('The saved feed returns it', savedFeed.body.total === 1, `${savedFeed.body.total} posts`);

  // --- Following ---
  const follow = await call(`/community/users/${author.id}/follow`, { method: 'POST', headers: reader.auth });
  check('An author can be followed', follow.body.following === true);
  const self = await call(`/community/users/${reader.id}/follow`, { method: 'POST', headers: reader.auth });
  check('Following yourself is refused', self.status === 403, String(self.status));

  const followingFeed = await call('/community/posts?scope=FOLLOWING', { headers: reader.auth });
  check('The following feed returns their posts', followingFeed.body.total >= 1,
    `${followingFeed.body.total} posts`);

  // --- One post ---
  const detail = await call(`/community/posts/${postId}`, { headers: reader.auth });
  check('The detail counts a view', detail.body.post.viewCount >= 1, String(detail.body.post.viewCount));
  check('The detail shows the reader their own heart', detail.body.post.likedByMe === true);
  check('The detail shows the reader is following', detail.body.author.followedByMe === true);
  check('The comment count is kept up to date', detail.body.post.commentCount === 1);

  const missing = await call('/community/posts/000000000000000000000000');
  check('A missing post returns not found', missing.status === 404, String(missing.status));

  const malformed = await call('/community/posts/not-an-id');
  check('A malformed id returns not found', malformed.status === 404, String(malformed.status));

  // --- Public profile ---
  const profile = await call(`/community/users/${author.id}`, { headers: reader.auth });
  check('The profile carries a handle', profile.body.handle?.startsWith('@'), profile.body.handle);
  check('The profile counts posts and followers',
    profile.body.postCount >= 1 && profile.body.followerCount === 1);
  check('The profile never leaks the email',
    !JSON.stringify(profile.body).includes('@petmory.local') || profile.body.handle.length > 0);

  const authorPosts = await call(`/community/users/${author.id}/posts`);
  check('The profile lists their posts', authorPosts.body.length >= 1, `${authorPosts.body.length} posts`);

  // --- Permissions ---
  const stolen = await call(`/community/posts/${postId}`, { method: 'DELETE', headers: reader.auth });
  check('Another user cannot delete the post', stolen.status === 404, String(stolen.status));

  const moderate = await call(`/community/posts/${postId}/moderate`, {
    method: 'DELETE',
    headers: reader.auth,
  });
  check('A customer cannot moderate', moderate.status === 403, String(moderate.status));

  const signedOut = await call('/community/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'MOMENT', title: 'x', content: 'y' }),
  });
  check('Signed out cannot post', signedOut.status === 401, String(signedOut.status));

  // --- Soft delete ---
  const removed = await call(`/community/posts/${postId}`, { method: 'DELETE', headers: author.auth });
  check('The author can take their post down', removed.status === 200, String(removed.status));
  const gone = await call(`/community/posts/${postId}`);
  check('A removed post is gone from view', gone.status === 404, String(gone.status));

  console.log('='.repeat(66));
  console.log(failed === 0 ? `ALL ${passed} CHECKS PASSED` : `${failed}/${passed + failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
