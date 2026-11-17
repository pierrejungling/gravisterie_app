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
exports.Commande = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const enum_1 = require("./enum");
const client_entity_1 = require("./client.entity");
const commande_support_entity_1 = require("./commande_support.entity");
const commande_ligne_prix_entity_1 = require("./commande_ligne_prix.entity");
let Commande = class Commande {
    id_commande;
    date_commande;
    deadline;
    produit;
    description;
    fichiers_joints;
    CGV_acceptée;
    newsletter_acceptée;
    statut_commande;
    statuts_actifs;
    prix_final;
    prix_unitaire_final;
    frais_pourcentage;
    frais_commission_id;
    frais_commission_libelle;
    quantité;
    quantite_realisee;
    quantite_produit_compteurs;
    supports;
    lignes_prix;
    payé;
    commentaire_paye;
    attente_reponse;
    mode_contact;
    source_web;
    site_traitee;
    id_evenement;
    client;
};
exports.Commande = Commande;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], Commande.prototype, "id_commande", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: false }),
    __metadata("design:type", Date)
], Commande.prototype, "date_commande", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "deadline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "produit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "fichiers_joints", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Commande.prototype, "CGV_accept\u00E9e", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Commande.prototype, "newsletter_accept\u00E9e", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false, default: enum_1.StatutCommande.EN_ATTENTE_INFORMATION }),
    __metadata("design:type", String)
], Commande.prototype, "statut_commande", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "statuts_actifs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "prix_final", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "prix_unitaire_final", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "frais_pourcentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "frais_commission_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "frais_commission_libelle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "quantit\u00E9", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true, default: 0 }),
    __metadata("design:type", Object)
], Commande.prototype, "quantite_realisee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "quantite_produit_compteurs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => commande_support_entity_1.CommandeSupport, (commandeSupport) => commandeSupport.commande, { cascade: true }),
    __metadata("design:type", Array)
], Commande.prototype, "supports", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => commande_ligne_prix_entity_1.CommandeLignePrix, (ligne) => ligne.commande, { cascade: true }),
    __metadata("design:type", Array)
], Commande.prototype, "lignes_prix", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Commande.prototype, "pay\u00E9", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "commentaire_paye", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Commande.prototype, "attente_reponse", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "mode_contact", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Commande.prototype, "source_web", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Commande.prototype, "site_traitee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 26, nullable: true }),
    __metadata("design:type", Object)
], Commande.prototype, "id_evenement", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, (client) => client.id_client),
    (0, typeorm_1.JoinColumn)({ name: 'id_client' }),
    __metadata("design:type", client_entity_1.Client)
], Commande.prototype, "client", void 0);
exports.Commande = Commande = __decorate([
    (0, typeorm_1.Entity)()
], Commande);
//# sourceMappingURL=commande.entity.js.map