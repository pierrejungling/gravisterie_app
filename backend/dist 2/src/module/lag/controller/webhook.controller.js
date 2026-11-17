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
exports.WebhookController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const public_metadata_1 = require("../../../common/config/metadata/public.metadata");
const realtime_1 = require("../../../common/realtime");
const commande_service_1 = require("../service/commande.service");
const payload_1 = require("../model/payload");
let WebhookController = class WebhookController {
    commandeService;
    realtime;
    constructor(commandeService, realtime) {
        this.commandeService = commandeService;
        this.realtime = realtime;
    }
    async createFromWebhook(secret, dto, files) {
        const expectedSecret = process.env.WEBHOOK_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            throw new common_1.UnauthorizedException('Webhook secret invalide');
        }
        const commande = await this.commandeService.creerCommandeDepuisWebhook(dto, files ?? []);
        this.realtime.publish({ resource: 'commande', action: 'created', id: commande.id_commande, origin: null });
        return commande;
    }
};
exports.WebhookController = WebhookController;
__decorate([
    (0, public_metadata_1.Public)(),
    (0, common_1.Post)('webhook'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer une commande depuis un formulaire du site vitrine (send-order.php / send-mail.php)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-webhook-secret', description: 'Secret partagé avec le site vitrine', required: true }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)({
        limits: {
            fileSize: 50 * 1024 * 1024,
            files: 30,
        },
    })),
    __param(0, (0, common_1.Headers)('x-webhook-secret')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payload_1.CreateOrderFromWebhookDto, Array]),
    __metadata("design:returntype", Promise)
], WebhookController.prototype, "createFromWebhook", null);
exports.WebhookController = WebhookController = __decorate([
    (0, swagger_1.ApiTags)('Webhook'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [commande_service_1.CommandeService,
        realtime_1.RealtimeService])
], WebhookController);
//# sourceMappingURL=webhook.controller.js.map