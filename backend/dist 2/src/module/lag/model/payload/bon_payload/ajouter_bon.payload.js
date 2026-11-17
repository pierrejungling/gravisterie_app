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
exports.AjouterBonPayload = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const DUREES_VALIDES = ['1M', '2M', '3M', '6M', '1Y', 'LIFE'];
class AjouterBonPayload {
    numero;
    intitule;
    date_creation;
    nom;
    prenom;
    duree_validite;
    date_echeance;
    valeur;
}
exports.AjouterBonPayload = AjouterBonPayload;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numéro du bon (ex: BG001)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 20),
    __metadata("design:type", String)
], AjouterBonPayload.prototype, "numero", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Intitulé du bon (personne, événement, foire, etc.)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], AjouterBonPayload.prototype, "intitule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Date de création (ISO yyyy-MM-dd)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AjouterBonPayload.prototype, "date_creation", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 50),
    __metadata("design:type", Object)
], AjouterBonPayload.prototype, "nom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 50),
    __metadata("design:type", Object)
], AjouterBonPayload.prototype, "prenom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: DUREES_VALIDES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(DUREES_VALIDES),
    __metadata("design:type", Object)
], AjouterBonPayload.prototype, "duree_validite", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Date d\'échéance manuelle (ISO yyyy-MM-dd)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], AjouterBonPayload.prototype, "date_echeance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Valeur du bon en euros' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], AjouterBonPayload.prototype, "valeur", void 0);
//# sourceMappingURL=ajouter_bon.payload.js.map