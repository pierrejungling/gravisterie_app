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
exports.FraisCommission = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
let FraisCommission = class FraisCommission {
    id_frais_commission;
    libelle;
    pourcentage;
};
exports.FraisCommission = FraisCommission;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], FraisCommission.prototype, "id_frais_commission", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], FraisCommission.prototype, "libelle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, nullable: false }),
    __metadata("design:type", Number)
], FraisCommission.prototype, "pourcentage", void 0);
exports.FraisCommission = FraisCommission = __decorate([
    (0, typeorm_1.Entity)()
], FraisCommission);
//# sourceMappingURL=frais_commission.entity.js.map