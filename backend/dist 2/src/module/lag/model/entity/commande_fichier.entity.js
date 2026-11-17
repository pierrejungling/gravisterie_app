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
exports.CommandeFichier = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const commande_entity_1 = require("./commande.entity");
let CommandeFichier = class CommandeFichier {
    id_fichier;
    key_r2;
    nom_fichier;
    type_mime;
    taille_octets;
    date_upload;
    commande;
};
exports.CommandeFichier = CommandeFichier;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], CommandeFichier.prototype, "id_fichier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 512 }),
    __metadata("design:type", String)
], CommandeFichier.prototype, "key_r2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], CommandeFichier.prototype, "nom_fichier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], CommandeFichier.prototype, "type_mime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], CommandeFichier.prototype, "taille_octets", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], CommandeFichier.prototype, "date_upload", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => commande_entity_1.Commande, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'id_commande' }),
    __metadata("design:type", commande_entity_1.Commande)
], CommandeFichier.prototype, "commande", void 0);
exports.CommandeFichier = CommandeFichier = __decorate([
    (0, typeorm_1.Entity)()
], CommandeFichier);
//# sourceMappingURL=commande_fichier.entity.js.map