"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const jwt_guard_1 = require("./jwt/jwt.guard");
const config_1 = require("../common/config");
const enum_1 = require("../common/config/enum");
const model_1 = require("./model");
const jwt_2 = require("./jwt");
const service_1 = require("./service");
const security_controller_1 = require("./security.controller");
let SecurityModule = class SecurityModule {
};
exports.SecurityModule = SecurityModule;
exports.SecurityModule = SecurityModule = __decorate([
    (0, common_1.Module)({
        imports: [jwt_1.JwtModule.register({
                global: true,
                secret: config_1.configManager.getValue(enum_1.ConfigKey.JWT_TOKEN_SECRET),
                signOptions: { expiresIn: config_1.configManager.getValue(enum_1.ConfigKey.JWT_TOKEN_EXPIRE_IN) },
            }), typeorm_1.TypeOrmModule.forFeature([model_1.Credential, model_1.Token])],
        exports: [service_1.SecurityService, jwt_guard_1.JwtGuard],
        providers: [jwt_2.TokenService, service_1.SecurityService, jwt_guard_1.JwtGuard],
        controllers: [security_controller_1.SecurityController]
    })
], SecurityModule);
//# sourceMappingURL=security.module.js.map