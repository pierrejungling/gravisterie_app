"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isR2Configured = isR2Configured;
exports.getR2ConfigOrThrow = getR2ConfigOrThrow;
function getR2Config() {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const bucket = process.env.R2_BUCKET_NAME || '';
    const endpoint = accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : '';
    return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}
function isR2Configured() {
    const c = getR2Config();
    return !!(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket);
}
function getR2ConfigOrThrow() {
    const c = getR2Config();
    if (!c.accountId || !c.accessKeyId || !c.secretAccessKey || !c.bucket) {
        throw new Error('R2 non configuré : définir R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    }
    return c;
}
//# sourceMappingURL=r2.config.js.map