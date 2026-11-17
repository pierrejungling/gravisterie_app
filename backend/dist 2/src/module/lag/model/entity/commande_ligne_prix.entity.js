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
exports.CommandeLignePrix = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const commande_entity_1 = require("./commande.entity");
let CommandeLignePrix = class CommandeLignePrix {
    id_commande_ligne_prix;
    commande;
    remise;
    remise_pourcentage;
    nom;
    quantite;
    prix_unitaire;
    prix_final;
};
exports.CommandeLignePrix = CommandeLignePrix;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], CommandeLignePrix.prototype, "id_commande_ligne_prix", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => commande_entity_1.Commande, (commande) => commande.lignes_prix, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'id_commande' }),
    __metadata("design:type", commande_entity_1.Commande)
], CommandeLignePrix.prototype, "commande", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], CommandeLignePrix.prototype, "remise", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], CommandeLignePrix.prototype, "remise_pourcentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CommandeLignePrix.prototype, "nom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], CommandeLignePrix.prototype, "quantite", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], CommandeLignePrix.prototype, "prix_unitaire", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], CommandeLignePrix.prototype, "prix_final", void 0);
exports.CommandeLignePrix = CommandeLignePrix = __decorate([
    (0, typeorm_1.Entity)()
], CommandeLignePrix);
//# sourceMappingURL=commande_ligne_prix.entity.js.map