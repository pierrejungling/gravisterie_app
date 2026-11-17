"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LagModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entity_1 = require("./model/entity");
const service_1 = require("./service");
const controller_1 = require("./controller");
let LagModule = class LagModule {
};
exports.LagModule = LagModule;
exports.LagModule = LagModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([entity_1.Commande, entity_1.Client, entity_1.Gravure, entity_1.Personnalisation, entity_1.Support, entity_1.CommandeSupport, entity_1.CommandeLignePrix, entity_1.CommandeFichier, entity_1.Bon, entity_1.FraisCommission, entity_1.ApercuLien, entity_1.Evenement])
        ],
        providers: [service_1.CommandeService, service_1.R2Service, service_1.CommandeFichierService, service_1.BonService, service_1.FraisCommissionService, service_1.ClientService, service_1.ApercuLienService, service_1.EvenementService, service_1.ReseauxService],
        controllers: [controller_1.CommandeController, controller_1.BonController, controller_1.FraisCommissionController, controller_1.WebhookController, controller_1.ClientController, controller_1.ApercuLienController, controller_1.EvenementController, controller_1.ReseauxController],
        exports: [service_1.CommandeService, service_1.BonService, service_1.FraisCommissionService, service_1.ClientService]
    })
], LagModule);
//# sourceMappingURL=lag.module.js.map