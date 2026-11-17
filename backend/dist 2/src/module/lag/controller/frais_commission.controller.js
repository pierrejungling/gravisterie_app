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
exports.FraisCommissionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const realtime_1 = require("../../../common/realtime");
const frais_commission_service_1 = require("../service/frais_commission.service");
const frais_commission_payload_1 = require("../model/payload/frais_commission_payload");
let FraisCommissionController = class FraisCommissionController {
    fraisCommissionService;
    realtime;
    constructor(fraisCommissionService, realtime) {
        this.fraisCommissionService = fraisCommissionService;
        this.realtime = realtime;
    }
    async getAllFraisCommissions() {
        return await this.fraisCommissionService.getAllFraisCommissions();
    }
    async ajouterFraisCommission(payload, origin) {
        const frais = await this.fraisCommissionService.ajouterFraisCommission(payload);
        this.realtime.publish({
            resource: 'frais',
            action: 'updated',
            id: frais.id_frais_commission,
            origin,
        });
        return frais;
    }
};
exports.FraisCommissionController = FraisCommissionController;
__decorate([
    (0, common_1.Get)('liste'),
    (0, swagger_1.ApiOperation)({ summary: 'Récupérer tous les frais / commissions enregistrés' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FraisCommissionController.prototype, "getAllFraisCommissions", null);
__decorate([
    (0, common_1.Post)('ajouter'),
    (0, swagger_1.ApiOperation)({ summary: 'Ajouter un nouveau frais / commission à la liste' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [frais_commission_payload_1.AjouterFraisCommissionPayload, String]),
    __metadata("design:returntype", Promise)
], FraisCommissionController.prototype, "ajouterFraisCommission", null);
exports.FraisCommissionController = FraisCommissionController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('FraisCommission'),
    (0, common_1.Controller)('frais-commission'),
    __metadata("design:paramtypes", [frais_commission_service_1.FraisCommissionService,
        realtime_1.RealtimeService])
], FraisCommissionController);
//# sourceMappingURL=frais_commission.controller.js.map