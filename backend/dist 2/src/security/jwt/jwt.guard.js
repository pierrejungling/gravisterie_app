"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var JwtGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const rxjs_1 = require("rxjs");
const security_exception_1 = require("../security.exception");
const core_1 = require("@nestjs/core");
const public_metadata_1 = require("../../common/config/metadata/public.metadata");
const lodash_1 = require("lodash");
const service_1 = require("../service");
const operators_1 = require("rxjs/operators");
let JwtGuard = JwtGuard_1 = class JwtGuard {
    jwtService;
    securityService;
    reflector;
    logger = new common_1.Logger(JwtGuard_1.name);
    constructor(jwtService, securityService, reflector) {
        this.jwtService = jwtService;
        this.securityService = securityService;
        this.reflector = reflector;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_metadata_1.IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        return isPublic ? true : this.validateToken(context.switchToHttp().getRequest());
    }
    validateToken(request) {
        if (!(0, lodash_1.isNil)(request.headers['authorization'])) {
            try {
                const id = this.jwtService.verify(request.headers['authorization'].replace('Bearer ', '')).sub;
                return (0, rxjs_1.from)(this.securityService.detail(id)).pipe((0, operators_1.map)((user) => {
                    request.user = user;
                    return true;
                }));
            }
            catch (e) {
                this.logger.log(e.message);
                throw new security_exception_1.TokenExpiredException();
            }
        }
        throw new security_exception_1.NoTokenFoundedException();
    }
};
exports.JwtGuard = JwtGuard;
exports.JwtGuard = JwtGuard = JwtGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, service_1.SecurityService,
        core_1.Reflector])
], JwtGuard);
//# sourceMappingURL=jwt.guard.js.map