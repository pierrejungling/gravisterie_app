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
exports.LierCommandeEvenementPayload = exports.EvenementPayload = exports.FORMULES_EVENEMENT = exports.STATUTS_EVENEMENT = exports.TYPES_EVENEMENT = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
exports.TYPES_EVENEMENT = ['gravure_direct', 'nocturne', 'salon', 'marche', 'atelier', 'autre'];
exports.STATUTS_EVENEMENT = ['prospect', 'propose', 'confirme', 'termine', 'annule', 'refuse'];
exports.FORMULES_EVENEMENT = ['a_definir', 'illimite', 'a_la_gravure', 'stand'];
class EvenementPayload {
    nom;
    type;
    statut;
    date_debut;
    date_fin;
    heure_arrivee;
    lieu;
    adresse;
    contact_nom;
    contact_telephone;
    contact_mail;
    id_client;
    formule;
    prix_forfait;
    prix_gravure;
    nb_gravures;
    heures_sur_place;
    heures_trajet;
    forfait_carburant;
    paye;
    materiel;
    notes;
}
exports.EvenementPayload = EvenementPayload;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EvenementPayload.prototype, "nom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: exports.TYPES_EVENEMENT }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.TYPES_EVENEMENT),
    __metadata("design:type", String)
], EvenementPayload.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: exports.STATUTS_EVENEMENT }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.STATUTS_EVENEMENT),
    __metadata("design:type", String)
], EvenementPayload.prototype, "statut", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "date_debut", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "date_fin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "heure_arrivee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "lieu", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "adresse", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "contact_nom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "contact_telephone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "contact_mail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "id_client", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: exports.FORMULES_EVENEMENT }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.FORMULES_EVENEMENT),
    __metadata("design:type", String)
], EvenementPayload.prototype, "formule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "prix_forfait", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "prix_gravure", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "nb_gravures", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "heures_sur_place", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "heures_trajet", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "forfait_carburant", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EvenementPayload.prototype, "paye", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], EvenementPayload.prototype, "materiel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EvenementPayload.prototype, "notes", void 0);
class LierCommandeEvenementPayload {
    id_commande;
}
exports.LierCommandeEvenementPayload = LierCommandeEvenementPayload;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LierCommandeEvenementPayload.prototype, "id_commande", void 0);
//# sourceMappingURL=evenement.payload.js.map