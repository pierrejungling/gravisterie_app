"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenGenerationException = exports.TokenExpiredException = exports.UserNotFoundException = exports.NoTokenFoundedException = void 0;
const api_1 = require("../common/api");
class NoTokenFoundedException extends api_1.ApiException {
    constructor() {
        super(api_1.ApiCodeResponse.NO_TOKEN_FOUNDED, 401);
    }
}
exports.NoTokenFoundedException = NoTokenFoundedException;
class UserNotFoundException extends api_1.ApiException {
    constructor() {
        super(api_1.ApiCodeResponse.USER_NOT_FOUND, 200);
    }
}
exports.UserNotFoundException = UserNotFoundException;
class TokenExpiredException extends api_1.ApiException {
    constructor() {
        super(api_1.ApiCodeResponse.TOKEN_EXPIRED, 401);
    }
}
exports.TokenExpiredException = TokenExpiredException;
class TokenGenerationException extends api_1.ApiException {
    constructor() {
        super(api_1.ApiCodeResponse.TOKEN_GEN_ERROR, 500);
    }
}
exports.TokenGenerationException = TokenGenerationException;
//# sourceMappingURL=security.exception.js.map