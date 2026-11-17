"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ApiInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiInterceptor = void 0;
const lodash_1 = require("lodash");
const api_code_response_enum_1 = require("./api-code-response.enum");
const config_1 = require("../config");
const enum_1 = require("../config/enum");
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const common_3 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const class_transformer_1 = require("class-transformer");
let ApiInterceptor = ApiInterceptor_1 = class ApiInterceptor {
    logger = new common_1.Logger(ApiInterceptor_1.name);
    intercept(context, next) {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const url = String(request?.originalUrl || request?.url || '');
        if (url.includes('/events')) {
            return next.handle();
        }
        const path = request.route.path;
        return next
            .handle()
            .pipe((0, operators_1.map)((response) => {
            if (response instanceof common_3.StreamableFile) {
                return response;
            }
            return { code: this.map(path), data: (0, class_transformer_1.instanceToPlain)(response), result: true };
        }));
    }
    map(path) {
        this.logger.log(`path ${path}`);
        const part = path
            .replace(config_1.configManager.getValue(enum_1.ConfigKey.APP_BASE_URL), '')
            .split('/')
            .filter(s => s.length > 0)
            .slice(0, 2)
            .map(s => s.toUpperCase().replace('-', '_'));
        const code = api_code_response_enum_1.ApiCodeResponse[`${part.join('_')}_SUCCESS`];
        return (0, lodash_1.isNil)(code) ? api_code_response_enum_1.ApiCodeResponse.COMMON_SUCCESS : code;
    }
};
exports.ApiInterceptor = ApiInterceptor;
exports.ApiInterceptor = ApiInterceptor = ApiInterceptor_1 = __decorate([
    (0, common_2.Injectable)()
], ApiInterceptor);
//# sourceMappingURL=api.interceptor.js.map