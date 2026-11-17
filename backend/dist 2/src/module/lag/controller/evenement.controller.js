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
exports.EvenementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const realtime_1 = require("../../../common/realtime");
const evenement_service_1 = require("../service/evenement.service");
const evenement_payload_1 = require("../model/payload/evenement.payload");
let EvenementController = class EvenementController {
    evenementService;
    realtime;
    constructor(evenementService, realtime) {
        this.evenementService = evenementService;
        this.realtime = realtime;
    }
    async liste() {
        return await this.evenementService.liste();
    }
    async creer(payload, origin) {
        const e = await this.evenementService.creer(payload);
        this.realtime.publish({ resource: 'evenement', action: 'created', id: e.id_evenement, origin });
        return e;
    }
    async resume(id) {
        return await this.evenementService.resume(id);
    }
    async detail(id) {
        return await this.evenementService.detail(id);
    }
    async modifier(id, payload, origin) {
        const e = await this.evenementService.modifier(id, payload);
        this.realtime.publish({ resource: 'evenement', action: 'updated', id, origin });
        return e;
    }
    async supprimer(id, origin) {
        await this.evenementService.supprimer(id);
        this.realtime.publish({ resource: 'evenement', action: 'deleted', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', origin });
        return true;
    }
    async lier(id, payload, origin) {
        await this.evenementService.lierCommande(id, payload.id_commande);
        this.realtime.publish({ resource: 'evenement', action: 'updated', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', id: payload.id_commande, origin });
        return true;
    }
    async delier(id, idCommande, origin) {
        await this.evenementService.delierCommande(id, idCommande);
        this.realtime.publish({ resource: 'evenement', action: 'updated', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', id: idCommande, origin });
        return true;
    }
};
exports.EvenementController = EvenementController;
__decorate([
    (0, common_1.Get)('liste'),
    (0, swagger_1.ApiOperation)({ summary: 'Tous les événements avec leurs chiffres' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "liste", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Créer un événement' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [evenement_payload_1.EvenementPayload, String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "creer", null);
__decorate([
    (0, common_1.Get)(':id/resume'),
    (0, swagger_1.ApiOperation)({ summary: "Nom et date d'un événement" }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "resume", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Événement avec ses commandes liées' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "detail", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifier un événement' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, evenement_payload_1.EvenementPayload, String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "modifier", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer un événement (les commandes liées sont gardées)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "supprimer", null);
__decorate([
    (0, common_1.Post)(':id/commandes'),
    (0, swagger_1.ApiOperation)({ summary: 'Rattacher une commande à un événement' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, evenement_payload_1.LierCommandeEvenementPayload, String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "lier", null);
__decorate([
    (0, common_1.Delete)(':id/commandes/:idCommande'),
    (0, swagger_1.ApiOperation)({ summary: "Détacher une commande d'un événement" }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('idCommande')),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], EvenementController.prototype, "delier", null);
exports.EvenementController = EvenementController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('Événement'),
    (0, common_1.Controller)('evenement'),
    __metadata("design:paramtypes", [evenement_service_1.EvenementService,
        realtime_1.RealtimeService])
], EvenementController);
//# sourceMappingURL=evenement.controller.js.map