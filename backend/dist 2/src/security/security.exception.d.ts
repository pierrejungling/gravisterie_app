import { ApiException } from "../common/api";
export declare class NoTokenFoundedException extends ApiException {
    constructor();
}
export declare class UserNotFoundException extends ApiException {
    constructor();
}
export declare class TokenExpiredException extends ApiException {
    constructor();
}
export declare class TokenGenerationException extends ApiException {
    constructor();
}
