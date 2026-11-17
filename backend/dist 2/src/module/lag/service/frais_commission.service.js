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
exports.FraisCommissionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ulid_1 = require("ulid");
const frais_commission_entity_1 = require("../model/entity/frais_commission.entity");
let FraisCommissionService = class FraisCommissionService {
    fraisCommissionRepository;
    constructor(fraisCommissionRepository) {
        this.fraisCommissionRepository = fraisCommissionRepository;
    }
    async getAllFraisCommissions() {
        return await this.fraisCommissionRepository.find({
            order: { libelle: 'ASC' },
        });
    }
    async ajouterFraisCommission(payload) {
        const existing = await this.fraisCommissionRepository.findOne({
            where: {
                libelle: payload.libelle.trim(),
            },
        });
        if (existing) {
            existing.pourcentage = Number(payload.pourcentage);
            return await this.fraisCommissionRepository.save(existing);
        }
        const fraisCommission = new frais_commission_entity_1.FraisCommission();
        fraisCommission.id_frais_commission = (0, ulid_1.ulid)();
        fraisCommission.libelle = payload.libelle.trim();
        fraisCommission.pourcentage = Number(payload.pourcentage);
        return await this.fraisCommissionRepository.save(fraisCommission);
    }
};
exports.FraisCommissionService = FraisCommissionService;
exports.FraisCommissionService = FraisCommissionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(frais_commission_entity_1.FraisCommission)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], FraisCommissionService);
//# sourceMappingURL=frais_commission.service.js.map