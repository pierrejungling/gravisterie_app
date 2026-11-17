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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReseauxController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reseaux_service_1 = require("../service/reseaux.service");
let ReseauxController = class ReseauxController {
    reseauxService;
    constructor(reseauxService) {
        this.reseauxService = reseauxService;
    }
    async getAbonnes() {
        return await this.reseauxService.getAbonnes();
    }
};
exports.ReseauxController = ReseauxController;
__decorate([
    (0, common_1.Get)('abonnes'),
    (0, swagger_1.ApiOperation)({ summary: 'Nombre d\'abonnés Facebook et Instagram (cache 10 min)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReseauxController.prototype, "getAbonnes", null);
exports.ReseauxController = ReseauxController = __decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiTags)('Reseaux'),
    (0, common_1.Controller)('reseaux'),
    __metadata("design:paramtypes", [reseaux_service_1.ReseauxService])
], ReseauxController);
//# sourceMappingURL=reseaux.controller.js.map