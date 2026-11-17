"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelToSnake = exports.validationErrorToApiCodeResponse = exports.ValidationException = exports.ApiException = void 0;
const common_1 = require("@nestjs/common");
const api_code_response_enum_1 = require("./api-code-response.enum");
const lodash_1 = require("lodash");
class ApiException extends common_1.HttpException {
    constructor(code, status) {
        super({
            code: code,
            data: null,
            result: false
        }, status);
    }
}
exports.ApiException = ApiException;
class ValidationException extends common_1.HttpException {
    constructor(errors) {
        super({
            code: api_code_response_enum_1.ApiCodeResponse.PAYLOAD_IS_NOT_VALID,
            data: errors.map((e) => (0, exports.validationErrorToApiCodeResponse)(e)).flat(),
            result: false
        }, 499);
    }
}
exports.ValidationException = ValidationException;
const validationErrorToApiCodeResponse = (error) => {
    if ((0, lodash_1.isNil)(error.constraints)) {
        return [];
    }
    const keys = Object.keys(error.constraints);
    return keys.map((k) => {
        const code = api_code_response_enum_1.ApiCodeResponse[`${(0, exports.camelToSnake)(error.property)}_${(0, exports.camelToSnake)(k)}`];
        return (0, lodash_1.isNil)(code) ? api_code_response_enum_1.ApiCodeResponse.PAYLOAD_PARAM_IS_MISSING : code;
    });
};
exports.validationErrorToApiCodeResponse = validationErrorToApiCodeResponse;
const camelToSnake = (str) => {
    return str.replace(/([A-Z])/g, " $1").split(' ').join('_').toUpperCase();
};
exports.camelToSnake = camelToSnake;
//# sourceMappingURL=api.exception.js.map