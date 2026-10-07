/**
 * Ham Vercel phuc vu moi duong dan bat dau bang tien to api.
 *
 * Ban than API la NestJS trong thu muc ung dung api, duoc build ra thu muc
 * dist o buoc build cua Vercel. Tep nay chi trao yeu cau cho ban da build do.
 */
module.exports = require('../apps/api/dist/serverless.js').default;
