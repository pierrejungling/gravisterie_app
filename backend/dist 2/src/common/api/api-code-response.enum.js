"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiCodeResponse = void 0;
var ApiCodeResponse;
(function (ApiCodeResponse) {
    ApiCodeResponse["TEST"] = "api.result.test";
    ApiCodeResponse["NO_TOKEN_FOUNDED"] = "api.security.no_token_founded";
    ApiCodeResponse["USER_NOT_FOUND"] = "api.security.user_not_found";
    ApiCodeResponse["TOKEN_EXPIRED"] = "api.security.token_expired";
    ApiCodeResponse["TOKEN_GEN_ERROR"] = "api.security.token_gen_error";
    ApiCodeResponse["PAYLOAD_IS_NOT_VALID"] = "api.validation.payload_is_not_valid";
    ApiCodeResponse["PAYLOAD_PARAM_IS_MISSING"] = "api.validation.payload_param_is_missing";
    ApiCodeResponse["USERNAME_IS_NOT_EMPTY"] = "api.error.username_is_missing";
    ApiCodeResponse["PASSWORD_IS_NOT_EMPTY"] = "api.error.password_is_missing";
    ApiCodeResponse["MAIL_IS_NOT_EMPTY"] = "api.error.mail_is_missing";
    ApiCodeResponse["MAIL_IS_EMAIL"] = "api.error.mail_is_not_email";
    ApiCodeResponse["USERNAME_IS_LENGTH"] = "api.error.username_length";
    ApiCodeResponse["PASSWORD_IS_LENGTH"] = "api.error.password_length";
    ApiCodeResponse["COMMON_SUCCESS"] = "api.common.success";
    ApiCodeResponse["ACCOUNT_SIGNIN_SUCCESS"] = "api.signin_success";
    ApiCodeResponse["ACCOUNT_ADMIN_SIGNIN_SUCCESS"] = "api.admin_signin_success";
    ApiCodeResponse["ACCOUNT_REFRESH_SUCCESS"] = "api.refresh_success";
    ApiCodeResponse["ACCOUNT_ME_SUCCESS"] = "api.me_success";
})(ApiCodeResponse || (exports.ApiCodeResponse = ApiCodeResponse = {}));
//# sourceMappingURL=api-code-response.enum.js.map