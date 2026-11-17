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
exports.BonController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const realtime_1 = require("../../../common/realtime");
const bon_service_1 = require("../service/bon.service");
const bon_payload_1 = require("../model/payload/bon_payload");
let BonController = class BonController {
    bonService;
    realtime;
    constructor(bonService, realtime) {
        this.bonService = bonService;
        this.realtime = realtime;
    }
    async ajouterBon(payload, origin) {
        const bon = await this.bonService.ajouterBon(payload);
        this.realtime.publish({ resource: 'bon', action: 'created', id: bon.id_bon, origin });
        return bon;
    }
    async getAllBons() {
        return await this.bonService.getAllBons();
    }
    async getNextNumero() {
        const numero = await this.bonService.getNextNumero();
        return { numero };
    }
    async getBonById(id) {
        return await this.bonService.getBonById(id);
    }
    async updateBon(id, payload, origin) {
        const bon = await this.bonService.updateBon(id, payload);
        this.realtime.publish({ resource: 'bon', action: 'updated', id, origin });
        return bon;
    }
    async marquerUtilise(id, origin) {
        const bon = await this.bonService.marquerUtilise(id);
        this.realtime.publish({ resource: 'bon', action: 'updated', id, origin });
        return bon;
    }
    async deleteBon(id, origin) {
        await this.bonService.deleteBon(id);
        this.realtime.publish({ resource: 'bon', action: 'deleted', id, origin });
        return { success: true };
    }
};
exports.BonController = BonController;
__decorate([
    (0, common_1.Post)('ajouter'),
    (0, swagger_1.ApiOperation)({ summary: 'Ajouter un nouveau bon cadeau' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bon_payload_1.AjouterBonPayload, String]),
    __metadata("design:returntype", Promise)
], BonController.prototype, "ajouterBon", null);
__decorate([
    (0, common_1.Get)('liste'),
    (0, swagger_1.ApiOperation)({ summary: 'Récupérer tous les bons cadeaux' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BonController.prototype, "getAllBons", null);
__decorate([
    (0, common_1.Get)('prochain-numero'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtenir le prochain numéro de bon auto-généré' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BonController.prototype, "getNextNumero", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Récupérer un bon par son ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BonController.prototype, "getBonById", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Mettre à jour un bon' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bon_payload_1.ModifierBonPayload, String]),
    __metadata("design:returntype", Promise)
], BonController.prototype, "updateBon", null);
__decorate([
    (0, common_1.Put)(':id/utilise'),
    (0, swagger_1.ApiOperation)({ summary: 'Marquer un bon comme utilisé' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BonController.prototype, "marquerUtilise", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer un bon' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BonController.prototype, "deleteBon", null);
exports.BonController = BonController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('Bon'),
    (0, common_1.Controller)('bon'),
    __metadata("design:paramtypes", [bon_service_1.BonService,
        realtime_1.RealtimeService])
], BonController);
//# sourceMappingURL=bon.controller.js.map