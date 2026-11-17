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
exports.AjouterCommandePayload = exports.CoordonneesContactPayload = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const enum_1 = require("../../entity/enum");
class CoordonneesContactPayload {
    nom;
    prenom;
    telephone;
    mail;
    societe;
    adresse;
    tva;
}
exports.CoordonneesContactPayload = CoordonneesContactPayload;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 50),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "nom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 50),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "prenom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 30),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "telephone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "mail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 50),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "societe", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 100),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "adresse", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 20),
    __metadata("design:type", String)
], CoordonneesContactPayload.prototype, "tva", void 0);
class AjouterCommandePayload {
    nom_commande;
    deadline;
    date_commande;
    coordonnees_contact;
    description_projet;
    dimensions_souhaitees;
    couleur;
    support;
    police_ecriture;
    texte_personnalisation;
    fichiers_joints;
    quantité;
    payé;
    commentaire_paye;
    statut_initial;
    attente_reponse;
    mode_contact;
    prix_final;
    prix_unitaire_final;
    lignes_prix;
    supports;
    forcer_nouveau_client;
    nouvelle_fiche_client;
    id_client;
    frais_pourcentage;
    frais_commission_id;
    frais_commission_libelle;
}
exports.AjouterCommandePayload = AjouterCommandePayload;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "nom_commande", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "deadline", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "date_commande", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => CoordonneesContactPayload, required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", CoordonneesContactPayload)
], AjouterCommandePayload.prototype, "coordonnees_contact", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "description_projet", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "dimensions_souhaitees", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], enum: enum_1.Couleur }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AjouterCommandePayload.prototype, "couleur", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "support", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "police_ecriture", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "texte_personnalisation", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AjouterCommandePayload.prototype, "fichiers_joints", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AjouterCommandePayload.prototype, "quantit\u00E9", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AjouterCommandePayload.prototype, "pay\u00E9", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "commentaire_paye", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "statut_initial", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AjouterCommandePayload.prototype, "attente_reponse", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "mode_contact", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AjouterCommandePayload.prototype, "prix_final", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AjouterCommandePayload.prototype, "prix_unitaire_final", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AjouterCommandePayload.prototype, "lignes_prix", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AjouterCommandePayload.prototype, "supports", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AjouterCommandePayload.prototype, "forcer_nouveau_client", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: "Avec id_client : enregistrer les coordonnées sur une copie de la fiche au lieu de modifier la fiche d'origine" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AjouterCommandePayload.prototype, "nouvelle_fiche_client", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Client existant à lier à la commande (fiche client)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 26),
    __metadata("design:type", String)
], AjouterCommandePayload.prototype, "id_client", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Frais/commission en pourcentage (par exemple 35 pour 35%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], AjouterCommandePayload.prototype, "frais_pourcentage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Identifiant du frais/commission prédéfini sélectionné' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AjouterCommandePayload.prototype, "frais_commission_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Libellé du frais/commission (prédéfini ou saisie libre)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AjouterCommandePayload.prototype, "frais_commission_libelle", void 0);
//# sourceMappingURL=ajouter_commande.payload.js.map