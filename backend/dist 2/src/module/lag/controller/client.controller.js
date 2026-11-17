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
exports.ClientController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const realtime_1 = require("../../../common/realtime");
const client_service_1 = require("../service/client.service");
const payload_1 = require("../model/payload");
let ClientController = class ClientController {
    clientService;
    realtime;
    constructor(clientService, realtime) {
        this.clientService = clientService;
        this.realtime = realtime;
    }
    async getAllClients() {
        return await this.clientService.getAllClients();
    }
    async rechercherClients(query, limit) {
        const parsedLimit = Math.min(Math.max(parseInt(limit || '8', 10) || 8, 1), 50);
        return await this.clientService.rechercherClients(query || '', parsedLimit);
    }
    async trouverCorrespondances(nom, prenom, mail, telephone, societe) {
        return await this.clientService.trouverCorrespondances({ nom, prenom, mail, telephone, societe });
    }
    async getDoublons() {
        return await this.clientService.getDoublons();
    }
    async ajouterClient(payload, origin) {
        const client = await this.clientService.ajouterClient(payload);
        this.realtime.publish({ resource: 'client', action: 'created', id: client.id_client, origin });
        return client;
    }
    async fusionnerClients(payload, origin) {
        const client = await this.clientService.fusionnerClients(payload.id_client_cible, payload.ids_clients_sources);
        this.realtime.publish({ resource: 'client', action: 'updated', id: payload.id_client_cible, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', origin });
        return client;
    }
    async getClientById(id) {
        return await this.clientService.getClientById(id);
    }
    async modifierClient(id, payload, origin) {
        const client = await this.clientService.modifierClient(id, payload);
        this.realtime.publish({ resource: 'client', action: 'updated', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', origin });
        return client;
    }
    async supprimerClient(id, origin) {
        await this.clientService.supprimerClient(id);
        this.realtime.publish({ resource: 'client', action: 'deleted', id, origin });
        return { success: true };
    }
};
exports.ClientController = ClientController;
__decorate([
    (0, common_1.Get)('liste'),
    (0, swagger_1.ApiOperation)({ summary: 'Tous les clients avec leurs chiffres' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getAllClients", null);
__decorate([
    (0, common_1.Get)('recherche'),
    (0, swagger_1.ApiOperation)({ summary: 'Rechercher un client (nom, société, mail, téléphone)' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "rechercherClients", null);
__decorate([
    (0, common_1.Get)('correspondances'),
    (0, swagger_1.ApiOperation)({ summary: 'Fiches existantes qui correspondent à des coordonnées saisies' }),
    __param(0, (0, common_1.Query)('nom')),
    __param(1, (0, common_1.Query)('prenom')),
    __param(2, (0, common_1.Query)('mail')),
    __param(3, (0, common_1.Query)('telephone')),
    __param(4, (0, common_1.Query)('societe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "trouverCorrespondances", null);
__decorate([
    (0, common_1.Get)('doublons'),
    (0, swagger_1.ApiOperation)({ summary: 'Fiches clients probablement en double' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getDoublons", null);
__decorate([
    (0, common_1.Post)('ajouter'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer une fiche client' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payload_1.AjouterClientPayload, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "ajouterClient", null);
__decorate([
    (0, common_1.Post)('fusionner'),
    (0, swagger_1.ApiOperation)({ summary: 'Fusionner des fiches clients (les commandes passent sur la fiche cible)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payload_1.FusionnerClientsPayload, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "fusionnerClients", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Fiche client avec historique des commandes' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getClientById", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifier une fiche client' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, payload_1.ModifierClientPayload, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "modifierClient", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer une fiche client sans commande' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "supprimerClient", null);
exports.ClientController = ClientController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('Client'),
    (0, common_1.Controller)('client'),
    __metadata("design:paramtypes", [client_service_1.ClientService,
        realtime_1.RealtimeService])
], ClientController);
//# sourceMappingURL=client.controller.js.map