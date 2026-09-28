/**
 * IT-06 — Two members meeting on the community feed.
 *
 * Follows one member writing a post and another finding it, reacting to it,
 * commenting, saving and following, then checks that every counter the feed
 * shows agrees with the rows behind it. Counters that drift are the usual way
 * a feed starts lying, so each one is compared against a second reading.
 *
 * Run: node tools/integration/it-06-community-journey.js
 */
const h = require('./harness');

async function scenario(report) {
  const author = await h.newCustomer('author');
  const reader = await h.newCustomer('reader');
  const manager = await h.signInInternal(h.ACCOUNT_MANAGER);

  // --- Writing ---
  report.step('One member writes a post with a photo');
  const post = await h.call('/community/posts', {
    method: 'POST',
    headers: author.auth,
    body: JSON.stringify({
      topic: 'MEMORIAL',
      title: 'Nho be Mun',
      content: 'Da mot nam roi, van nho em.',
      tags: ['tuong nho', 'meo'],
    }),
  });
  report.require('The post is written', post.status === 201, String(post.status));
  const postId = post.body._id;

  const form = new FormData();
  const bytes = await h.makePhoto(600);
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'anh.png');
  const withPhoto = await fetch(`${h.API}/community/posts/${postId}/photos`, {
    method: 'POST',
    headers: { Authorization: author.auth.Authorization },
    body: form,
  });
  report.check('A photo can be attached', withPhoto.status === 201, String(withPhoto.status));

  const served = await fetch(
    `${h.API}/community/posts/${postId}/photos/${(await withPhoto.json()).photos[0]}`,
  );
  report.check('The photo is served back through the checked path',
    served.ok && served.headers.get('content-type')?.startsWith('image/'),
    served.headers.get('content-type') ?? String(served.status));

  // --- Finding it ---
  report.step('The other member finds it by topic and by keyword');
  const byTopic = await h.call('/community/posts?topic=MEMORIAL', { headers: reader.auth });
  report.check('It shows under its topic',
    byTopic.body.rows.some((r) => r.id === postId), `${byTopic.body.total} in topic`);

  const byKeyword = await h.call('/community/posts?keyword=Mun', { headers: reader.auth });
  report.check('It is found by a word in the title',
    byKeyword.body.rows.some((r) => r.id === postId), `${byKeyword.body.total} found`);

  const byTag = await h.call('/community/posts?keyword=tuong%20nho', { headers: reader.auth });
  report.check('It is found by its tag', byTag.body.rows.some((r) => r.id === postId));

  const topics = await h.call('/community/topics');
  report.check('The topic counter went up',
    topics.body.MEMORIAL >= 1, `${topics.body.MEMORIAL} in memorial`);

  // --- Reacting ---
  report.step('The other member reacts, comments, saves and follows');
  const liked = await h.call(`/community/posts/${postId}/like`, {
    method: 'POST',
    headers: reader.auth,
  });
  report.check('The heart is counted', liked.body.liked === true && liked.body.likeCount === 1,
    `${liked.body.likeCount}`);

  const comment = await h.call(`/community/posts/${postId}/comments`, {
    method: 'POST',
    headers: reader.auth,
    body: JSON.stringify({ content: 'Thuong be qua' }),
  });
  report.check('The comment is written', comment.status === 201, String(comment.status));

  const saved = await h.call(`/community/posts/${postId}/save`, {
    method: 'POST',
    headers: reader.auth,
  });
  report.check('The post is saved', saved.body.saved === true);

  const followed = await h.call(`/community/users/${author.id}/follow`, {
    method: 'POST',
    headers: reader.auth,
  });
  report.check('The author is followed', followed.body.following === true);

  // --- The counters agree with the rows ---
  report.step('Every counter agrees with what is actually stored');
  const detail = await h.call(`/community/posts/${postId}`, { headers: reader.auth });
  const comments = await h.call(`/community/posts/${postId}/comments`);
  report.check('The comment counter matches the comments stored',
    detail.body.post.commentCount === comments.body.length,
    `${detail.body.post.commentCount} vs ${comments.body.length}`);
  report.check('The heart counter matches the reader having liked it',
    detail.body.post.likeCount === 1 && detail.body.post.likedByMe === true);
  report.check('The post shows as saved to the reader', detail.body.post.savedByMe === true);
  report.check('The author shows as followed', detail.body.author.followedByMe === true);
  report.check('The view counter went up', detail.body.post.viewCount >= 1,
    String(detail.body.post.viewCount));

  const savedFeed = await h.call('/community/posts?scope=SAVED', { headers: reader.auth });
  report.check('The saved feed contains exactly what was saved',
    savedFeed.body.rows.every((r) => r.savedByMe) && savedFeed.body.rows.some((r) => r.id === postId));

  const followingFeed = await h.call('/community/posts?scope=FOLLOWING', { headers: reader.auth });
  report.check('The following feed contains the followed author',
    followingFeed.body.rows.some((r) => r.author.id === author.id));

  const profile = await h.call(`/community/users/${author.id}`, { headers: reader.auth });
  report.check('The profile counts the follower', profile.body.followerCount === 1,
    String(profile.body.followerCount));
  report.check('The profile counts the post', profile.body.postCount === 1,
    String(profile.body.postCount));

  // --- Taking it back ---
  report.step('Taking a reaction back puts the counters back');
  await h.call(`/community/posts/${postId}/like`, { method: 'POST', headers: reader.auth });
  const unliked = await h.call(`/community/posts/${postId}`, { headers: reader.auth });
  report.check('The heart counter goes back down',
    unliked.body.post.likeCount === 0 && unliked.body.post.likedByMe === false,
    String(unliked.body.post.likeCount));

  await h.call(`/community/users/${author.id}/follow`, { method: 'POST', headers: reader.auth });
  const unfollowed = await h.call(`/community/users/${author.id}`, { headers: reader.auth });
  report.check('The follower counter goes back down', unfollowed.body.followerCount === 0,
    String(unfollowed.body.followerCount));

  // --- Moderation ---
  report.step('Internal staff can take a post down and it disappears');
  const removed = await h.call(`/community/posts/${postId}/moderate`, {
    method: 'DELETE',
    headers: manager.auth,
  });
  report.check('A manager can take it down', removed.status === 200, String(removed.status));

  const gone = await h.call(`/community/posts/${postId}`);
  report.check('It is gone from view', gone.status === 404, String(gone.status));

  const feedAfter = await h.call('/community/posts?topic=MEMORIAL');
  report.check('It is gone from the feed',
    !feedAfter.body.rows.some((r) => r.id === postId));

  const profileAfter = await h.call(`/community/users/${author.id}`);
  report.check('The author post counter goes back down',
    profileAfter.body.postCount === 0, String(profileAfter.body.postCount));
}

if (require.main === module) {
  h.runScenario('IT-06  COMMUNITY JOURNEY', scenario).then((r) => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

module.exports = { name: 'IT-06 Community journey', scenario };
