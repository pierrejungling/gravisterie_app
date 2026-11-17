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
exports.BonService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bon_entity_1 = require("../model/entity/bon.entity");
const ulid_1 = require("ulid");
let BonService = class BonService {
    bonRepository;
    constructor(bonRepository) {
        this.bonRepository = bonRepository;
    }
    async ajouterBon(payload) {
        const bon = new bon_entity_1.Bon();
        bon.id_bon = (0, ulid_1.ulid)();
        bon.numero = payload.numero.trim();
        bon.intitule = payload.intitule.trim();
        bon.date_creation = new Date(payload.date_creation);
        bon.nom = payload.nom?.trim() || null;
        bon.prenom = payload.prenom?.trim() || null;
        bon.duree_validite = payload.duree_validite?.trim() || null;
        bon.date_echeance = payload.date_echeance ? new Date(payload.date_echeance) : null;
        bon.utilise = false;
        bon.valeur = payload.valeur != null ? Number(payload.valeur) : null;
        return await this.bonRepository.save(bon);
    }
    async getAllBons() {
        return await this.bonRepository.find({
            order: { date_creation: 'DESC', numero: 'ASC' },
        });
    }
    async getBonById(idBon) {
        const bon = await this.bonRepository.findOne({ where: { id_bon: idBon } });
        if (!bon) {
            throw new Error('Bon non trouvé');
        }
        return bon;
    }
    async getNextNumero() {
        const bons = await this.bonRepository.find({ select: ['numero'] });
        if (!bons.length) {
            return 'BG001';
        }
        const prefix = 'BG';
        const maxNumeric = bons.reduce((max, b) => {
            const match = b.numero.replace(new RegExp(`^${prefix}`, 'i'), '').trim();
            const n = parseInt(match, 10);
            return Number.isNaN(n) ? max : Math.max(max, n);
        }, 0);
        return `${prefix}${(maxNumeric + 1).toString().padStart(3, '0')}`;
    }
    async updateBon(idBon, payload) {
        const bon = await this.bonRepository.findOne({ where: { id_bon: idBon } });
        if (!bon) {
            throw new Error('Bon non trouvé');
        }
        if (payload.numero !== undefined)
            bon.numero = payload.numero.trim();
        if (payload.intitule !== undefined)
            bon.intitule = payload.intitule.trim();
        if (payload.date_creation !== undefined)
            bon.date_creation = new Date(payload.date_creation);
        if (payload.nom !== undefined)
            bon.nom = payload.nom?.trim() || null;
        if (payload.prenom !== undefined)
            bon.prenom = payload.prenom?.trim() || null;
        if (payload.duree_validite !== undefined)
            bon.duree_validite = payload.duree_validite?.trim() || null;
        if (payload.date_echeance !== undefined)
            bon.date_echeance = payload.date_echeance ? new Date(payload.date_echeance) : null;
        if (payload.utilise !== undefined) {
            bon.utilise = payload.utilise;
            if (payload.utilise) {
                bon.date_utilisation = payload.date_utilisation ? new Date(payload.date_utilisation) : new Date();
            }
            else {
                bon.date_utilisation = null;
            }
        }
        if (payload.date_utilisation !== undefined && payload.utilise === undefined) {
            bon.date_utilisation = payload.date_utilisation ? new Date(payload.date_utilisation) : null;
        }
        if (payload.valeur !== undefined)
            bon.valeur = payload.valeur != null ? Number(payload.valeur) : null;
        return await this.bonRepository.save(bon);
    }
    async marquerUtilise(idBon) {
        const dateUtilisation = new Date().toISOString().split('T')[0];
        return this.updateBon(idBon, { utilise: true, date_utilisation: dateUtilisation });
    }
    async deleteBon(idBon) {
        const bon = await this.bonRepository.findOne({ where: { id_bon: idBon } });
        if (!bon) {
            throw new Error('Bon non trouvé');
        }
        await this.bonRepository.remove(bon);
    }
};
exports.BonService = BonService;
exports.BonService = BonService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(bon_entity_1.Bon)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BonService);
//# sourceMappingURL=bon.service.js.map