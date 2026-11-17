"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configMinimalKeys = exports.ConfigKey = void 0;
var ConfigKey;
(function (ConfigKey) {
    ConfigKey["DB_TYPE"] = "DB_TYPE";
    ConfigKey["DB_HOST"] = "DB_HOST";
    ConfigKey["DB_PORT"] = "DB_PORT";
    ConfigKey["DB_USER"] = "DB_USER";
    ConfigKey["DB_PASSWORD"] = "DB_PASSWORD";
    ConfigKey["DB_DATABASE"] = "DB_DATABASE";
    ConfigKey["DB_SYNC"] = "DB_SYNC";
    ConfigKey["JWT_TOKEN_SECRET"] = "JWT_TOKEN_SECRET";
    ConfigKey["JWT_TOKEN_EXPIRE_IN"] = "JWT_TOKEN_EXPIRE_IN";
    ConfigKey["JWT_REFRESH_TOKEN_SECRET"] = "JWT_REFRESH_TOKEN_SECRET";
    ConfigKey["JWT_REFRESH_TOKEN_EXPIRE_IN"] = "JWT_REFRESH_TOKEN_EXPIRE_IN";
    ConfigKey["APP_BASE_URL"] = "APP_BASE_URL";
    ConfigKey["APP_MODE"] = "APP_MODE";
    ConfigKey["APP_PORT"] = "APP_PORT";
})(ConfigKey || (exports.ConfigKey = ConfigKey = {}));
exports.configMinimalKeys = Object.keys(ConfigKey);
//# sourceMappingURL=config-key.enum.js.map