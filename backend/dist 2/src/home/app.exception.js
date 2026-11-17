"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestException = void 0;
const api_1 = require("../common/api");
class TestException extends api_1.ApiException {
    constructor() {
        super(api_1.ApiCodeResponse.TEST, 200);
    }
}
exports.TestException = TestException;
//# sourceMappingURL=app.exception.js.map