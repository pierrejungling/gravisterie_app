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
exports.CommandeSupport = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const commande_entity_1 = require("./commande.entity");
let CommandeSupport = class CommandeSupport {
    id_commande_support;
    commande;
    nom_support;
    prix_support;
    url_support;
    prix_unitaire;
    nombre_unites;
    prix_support_unitaire;
    actif;
    id_ligne_prix;
};
exports.CommandeSupport = CommandeSupport;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], CommandeSupport.prototype, "id_commande_support", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => commande_entity_1.Commande, (commande) => commande.id_commande, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'id_commande' }),
    __metadata("design:type", commande_entity_1.Commande)
], CommandeSupport.prototype, "commande", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CommandeSupport.prototype, "nom_support", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], CommandeSupport.prototype, "prix_support", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CommandeSupport.prototype, "url_support", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], CommandeSupport.prototype, "prix_unitaire", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], CommandeSupport.prototype, "nombre_unites", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], CommandeSupport.prototype, "prix_support_unitaire", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], CommandeSupport.prototype, "actif", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 26, nullable: true }),
    __metadata("design:type", Object)
], CommandeSupport.prototype, "id_ligne_prix", void 0);
exports.CommandeSupport = CommandeSupport = __decorate([
    (0, typeorm_1.Entity)()
], CommandeSupport);
//# sourceMappingURL=commande_support.entity.js.map