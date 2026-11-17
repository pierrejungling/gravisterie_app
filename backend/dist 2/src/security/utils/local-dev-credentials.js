"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_DEV_CREDENTIALS = void 0;
exports.isLocalDevMode = isLocalDevMode;
exports.isLocalDevCredential = isLocalDevCredential;
exports.LOCAL_DEV_CREDENTIALS = {
    username: 'test',
    password: 'test',
    mail: 'test@localhost.dev',
};
function isLocalDevMode() {
    if (process.env.RENDER) {
        return false;
    }
    return (process.env.APP_MODE || '').toLowerCase() === 'development';
}
function isLocalDevCredential(username) {
    return username === exports.LOCAL_DEV_CREDENTIALS.username;
}
//# sourceMappingURL=local-dev-credentials.js.map