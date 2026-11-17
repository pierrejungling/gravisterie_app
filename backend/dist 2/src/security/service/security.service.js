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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const model_1 = require("../model");
const jwt_1 = require("../jwt");
const security_exception_1 = require("../security.exception");
const utils_1 = require("../utils");
const local_dev_credentials_1 = require("../utils/local-dev-credentials");
let SecurityService = class SecurityService {
    repository;
    tokenService;
    constructor(repository, tokenService) {
        this.repository = repository;
        this.tokenService = tokenService;
    }
    async detail(id) {
        const result = await this.repository.findOneBy({ credential_id: id });
        if (result !== null && result !== undefined) {
            return result;
        }
        throw new security_exception_1.UserNotFoundException();
    }
    async signIn(payload, isAdmin) {
        let result = null;
        if (payload.socialLogin) {
            if (payload.facebookHash !== null && payload.facebookHash !== undefined && payload.facebookHash.length > 0) {
                result = await this.repository.findOneBy({ facebookHash: payload.facebookHash });
            }
            else if (payload.googleHash !== null && payload.googleHash !== undefined && payload.googleHash.length > 0) {
                result = await this.repository.findOneBy({ googleHash: payload.googleHash });
            }
        }
        else {
            if ((0, local_dev_credentials_1.isLocalDevCredential)(payload.username)) {
                if (!(0, local_dev_credentials_1.isLocalDevMode)() || payload.password !== local_dev_credentials_1.LOCAL_DEV_CREDENTIALS.password) {
                    throw new security_exception_1.UserNotFoundException();
                }
                result = await this.ensureLocalDevCredential();
                return this.tokenService.getTokens(result);
            }
            result = await this.repository.findOneBy({ username: payload.username });
        }
        if (result !== null && result !== undefined) {
            if ((0, local_dev_credentials_1.isLocalDevCredential)(result.username) && !(0, local_dev_credentials_1.isLocalDevMode)()) {
                throw new security_exception_1.UserNotFoundException();
            }
            if (payload.socialLogin) {
                return this.tokenService.getTokens(result);
            }
            else {
                if (!result.password || result.password.length === 0) {
                    throw new security_exception_1.UserNotFoundException();
                }
                const passwordMatch = await (0, utils_1.comparePassword)(payload.password, result.password);
                if (passwordMatch) {
                    return this.tokenService.getTokens(result);
                }
            }
        }
        throw new security_exception_1.UserNotFoundException();
    }
    async ensureLocalDevCredential() {
        let credential = await this.repository.findOneBy({
            username: local_dev_credentials_1.LOCAL_DEV_CREDENTIALS.username,
        });
        if (credential) {
            return credential;
        }
        credential = new model_1.Credential();
        credential.username = local_dev_credentials_1.LOCAL_DEV_CREDENTIALS.username;
        credential.password = await (0, utils_1.encryptPassword)(local_dev_credentials_1.LOCAL_DEV_CREDENTIALS.password);
        credential.mail = local_dev_credentials_1.LOCAL_DEV_CREDENTIALS.mail;
        credential.facebookHash = '';
        credential.googleHash = '';
        credential.isAdmin = true;
        credential.active = true;
        return this.repository.save(credential);
    }
    async refresh(payload) {
        return this.tokenService.refresh(payload);
    }
};
exports.SecurityService = SecurityService;
exports.SecurityService = SecurityService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(model_1.Credential)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.TokenService])
], SecurityService);
//# sourceMappingURL=security.service.js.map