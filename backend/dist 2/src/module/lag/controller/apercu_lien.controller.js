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
exports.ApercuLienController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const apercu_lien_service_1 = require("../service/apercu_lien.service");
const apercu_lien_payload_1 = require("../model/payload/apercu_lien.payload");
let ApercuLienController = class ApercuLienController {
    apercuService;
    constructor(apercuService) {
        this.apercuService = apercuService;
    }
    async getApercu(url, forcer) {
        return await this.apercuService.getApercu(url, forcer === '1' || forcer === 'true');
    }
    async setImage(payload) {
        return await this.apercuService.setImage(payload.url, payload.image);
    }
};
exports.ApercuLienController = ApercuLienController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Image et titre d'un lien (frais, support acheté)" }),
    __param(0, (0, common_1.Query)('url')),
    __param(1, (0, common_1.Query)('forcer')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ApercuLienController.prototype, "getApercu", null);
__decorate([
    (0, common_1.Put)('image'),
    (0, swagger_1.ApiOperation)({ summary: "Choisir l'image d'un lien à la main (vide = image automatique)" }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [apercu_lien_payload_1.ImageApercuLienPayload]),
    __metadata("design:returntype", Promise)
], ApercuLienController.prototype, "setImage", null);
exports.ApercuLienController = ApercuLienController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('Aperçu de lien'),
    (0, common_1.Controller)('apercu-lien'),
    __metadata("design:paramtypes", [apercu_lien_service_1.ApercuLienService])
], ApercuLienController);
//# sourceMappingURL=apercu_lien.controller.js.map