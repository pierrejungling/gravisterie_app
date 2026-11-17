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
var TokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("../../common/config");
const enum_1 = require("../../common/config/enum");
const model_1 = require("../model");
const security_exception_1 = require("../security.exception");
const ulid_1 = require("ulid");
let TokenService = TokenService_1 = class TokenService {
    repository;
    credentialRepository;
    jwtService;
    logger = new common_1.Logger(TokenService_1.name);
    constructor(repository, credentialRepository, jwtService) {
        this.repository = repository;
        this.credentialRepository = credentialRepository;
        this.jwtService = jwtService;
    }
    async getTokens(credential) {
        try {
            await this.repository.delete({ credential });
            const payload = { sub: credential.credential_id };
            const tokenOptions = {
                secret: config_1.configManager.getValue(enum_1.ConfigKey.JWT_TOKEN_SECRET),
                expiresIn: config_1.configManager.getValue(enum_1.ConfigKey.JWT_TOKEN_EXPIRE_IN)
            };
            const refreshTokenOptions = {
                secret: config_1.configManager.getValue(enum_1.ConfigKey.JWT_REFRESH_TOKEN_SECRET),
                expiresIn: config_1.configManager.getValue(enum_1.ConfigKey.JWT_REFRESH_TOKEN_EXPIRE_IN)
            };
            const token = await this.jwtService.signAsync(payload, tokenOptions);
            const refreshToken = await this.jwtService.signAsync(payload, refreshTokenOptions);
            const tokenEntity = new model_1.Token();
            tokenEntity.token_id = (0, ulid_1.ulid)();
            tokenEntity.token = token;
            tokenEntity.refreshToken = refreshToken;
            tokenEntity.credential = credential;
            await this.repository.upsert(tokenEntity, ['credential']);
            const savedToken = await this.repository.findOneBy({ token: token });
            if (!savedToken) {
                throw new security_exception_1.TokenGenerationException();
            }
            return savedToken;
        }
        catch (e) {
            this.logger.error(e.message);
            throw new security_exception_1.TokenGenerationException();
        }
    }
    async refresh(payload) {
        try {
            const id = this.jwtService.verify(payload.refresh, { secret: config_1.configManager.getValue(enum_1.ConfigKey.JWT_REFRESH_TOKEN_SECRET) }).sub;
            const credential = await this.credentialRepository.findOneBy({ credential_id: id });
            if (!credential) {
                throw new security_exception_1.TokenExpiredException();
            }
            return await this.getTokens(credential);
        }
        catch (e) {
            this.logger.error(e.message);
            throw new security_exception_1.TokenExpiredException();
        }
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = TokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(model_1.Token)),
    __param(1, (0, typeorm_1.InjectRepository)(model_1.Credential)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService])
], TokenService);
//# sourceMappingURL=token.service.js.map