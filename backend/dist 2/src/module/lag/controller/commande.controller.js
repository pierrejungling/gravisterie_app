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
exports.CommandeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const realtime_1 = require("../../../common/realtime");
const commande_service_1 = require("../service/commande.service");
const commande_fichier_service_1 = require("../service/commande-fichier.service");
const payload_1 = require("../model/payload");
let CommandeController = class CommandeController {
    commandeService;
    commandeFichierService;
    realtime;
    constructor(commandeService, commandeFichierService, realtime) {
        this.commandeService = commandeService;
        this.commandeFichierService = commandeFichierService;
        this.realtime = realtime;
    }
    async ajouterCommande(payload, origin) {
        const commande = await this.commandeService.ajouterCommande(payload);
        this.realtime.publish({ resource: 'commande', action: 'created', id: commande.id_commande, origin });
        return commande;
    }
    async getAllCommandes() {
        return await this.commandeService.getAllCommandes();
    }
    async rechercherCommandes(query, limit) {
        const parsedLimit = Math.min(Math.max(parseInt(limit || '8', 10) || 8, 1), 50);
        return await this.commandeService.rechercherCommandes(query || '', parsedLimit);
    }
    async updateStatut(payload, origin) {
        const commande = await this.commandeService.updateStatutCommande(payload.id_commande, payload.statut);
        this.realtime.publish({ resource: 'commande', action: 'updated', id: payload.id_commande, origin });
        return commande;
    }
    async listFichiers(idCommande) {
        return await this.commandeFichierService.listByCommande(idCommande);
    }
    async uploadFichier(idCommande, file, origin) {
        if (!file) {
            throw new common_1.BadRequestException('Aucun fichier fourni');
        }
        const fichier = await this.commandeFichierService.upload(idCommande, file);
        this.realtime.publish({ resource: 'commande', action: 'updated', id: idCommande, origin });
        return fichier;
    }
    async downloadFichier(idCommande, idFichier) {
        const { stream, contentType, nomFichier } = await this.commandeFichierService.getStream(idCommande, idFichier);
        const filename = encodeURIComponent(nomFichier);
        return new common_1.StreamableFile(stream, {
            type: contentType || 'application/octet-stream',
            disposition: `attachment; filename*=UTF-8''${filename}`,
        });
    }
    async deleteFichier(idCommande, idFichier, origin) {
        await this.commandeFichierService.delete(idCommande, idFichier);
        this.realtime.publish({ resource: 'commande', action: 'updated', id: idCommande, origin });
        return { success: true };
    }
    async getCommandeById(id) {
        return await this.commandeService.getCommandeById(id);
    }
    async updateCommande(id, payload, origin) {
        const commande = await this.commandeService.updateCommande(id, payload);
        this.realtime.publish({ resource: 'commande', action: 'updated', id, origin });
        if (payload?.id_client)
            this.realtime.publish({ resource: 'client', action: 'updated', id: payload.id_client, origin });
        const { revision } = await this.commandeService.getCommandeById(id);
        return { ...commande, revision };
    }
    async deleteCommande(id, origin) {
        const result = await this.commandeService.deleteCommande(id);
        this.realtime.publish({ resource: 'commande', action: 'deleted', id, origin });
        return result;
    }
    async dupliquerCommande(id, origin) {
        const commande = await this.commandeService.dupliquerCommande(id);
        this.realtime.publish({
            resource: 'commande',
            action: 'created',
            id: commande?.id_commande,
            origin,
        });
        return commande;
    }
};
exports.CommandeController = CommandeController;
__decorate([
    (0, common_1.Post)('ajouter'),
    (0, swagger_1.ApiOperation)({ summary: 'Ajouter une nouvelle commande' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payload_1.AjouterCommandePayload, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "ajouterCommande", null);
__decorate([
    (0, common_1.Get)('liste'),
    (0, swagger_1.ApiOperation)({ summary: 'Récupérer toutes les commandes' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "getAllCommandes", null);
__decorate([
    (0, common_1.Get)('recherche'),
    (0, swagger_1.ApiOperation)({ summary: 'Rechercher des commandes (accents, casse, pluriels, fautes)' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "rechercherCommandes", null);
__decorate([
    (0, common_1.Put)('statut'),
    (0, swagger_1.ApiOperation)({ summary: 'Mettre à jour le statut d\'une commande' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payload_1.UpdateStatutPayload, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "updateStatut", null);
__decorate([
    (0, common_1.Get)(':id/fichiers'),
    (0, swagger_1.ApiOperation)({ summary: 'Liste des fichiers d\'une commande' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "listFichiers", null);
__decorate([
    (0, common_1.Post)(':id/fichiers'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload un fichier pour une commande' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "uploadFichier", null);
__decorate([
    (0, common_1.Get)(':id/fichiers/:idFichier/download'),
    (0, swagger_1.ApiOperation)({ summary: 'Télécharger un fichier' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('idFichier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "downloadFichier", null);
__decorate([
    (0, common_1.Delete)(':id/fichiers/:idFichier'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer un fichier d\'une commande' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('idFichier')),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "deleteFichier", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Récupérer une commande par son ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "getCommandeById", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Mettre à jour une commande' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "updateCommande", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer une commande' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "deleteCommande", null);
__decorate([
    (0, common_1.Post)(':id/dupliquer'),
    (0, swagger_1.ApiOperation)({ summary: 'Dupliquer une commande' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('x-client-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CommandeController.prototype, "dupliquerCommande", null);
exports.CommandeController = CommandeController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('Commande'),
    (0, common_1.Controller)('commande'),
    __metadata("design:paramtypes", [commande_service_1.CommandeService,
        commande_fichier_service_1.CommandeFichierService,
        realtime_1.RealtimeService])
], CommandeController);
//# sourceMappingURL=commande.controller.js.map