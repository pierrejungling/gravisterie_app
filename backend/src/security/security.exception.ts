import {ApiCodeResponse, ApiException} from '@common/api';

export class NoTokenFoundedException extends ApiException {
    constructor() {
        super(ApiCodeResponse.NO_TOKEN_FOUNDED, 401);
    }
}

export class UserNotFoundException extends ApiException {
    constructor() {
        super(ApiCodeResponse.USER_NOT_FOUND, 200);
    }
}

export class TokenExpiredException extends ApiException {
    constructor() {
        super(ApiCodeResponse.TOKEN_EXPIRED, 401);
    }
}

export class TokenGenerationException extends ApiException {
    constructor() {
        super(ApiCodeResponse.TOKEN_GEN_ERROR, 500);
    }
}