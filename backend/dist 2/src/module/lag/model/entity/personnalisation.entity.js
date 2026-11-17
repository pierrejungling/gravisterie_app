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
exports.Personnalisation = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const gravure_entity_1 = require("./gravure.entity");
let Personnalisation = class Personnalisation {
    id_personnalisation;
    texte;
    police;
    fichier_source;
    informations_supplémentaires;
    couleur;
    gravure;
};
exports.Personnalisation = Personnalisation;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], Personnalisation.prototype, "id_personnalisation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: false }),
    __metadata("design:type", String)
], Personnalisation.prototype, "texte", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Personnalisation.prototype, "police", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Personnalisation.prototype, "fichier_source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Personnalisation.prototype, "informations_suppl\u00E9mentaires", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], Personnalisation.prototype, "couleur", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => gravure_entity_1.Gravure, (gravure) => gravure.id_gravure),
    (0, typeorm_1.JoinColumn)({ name: 'id_gravure' }),
    __metadata("design:type", gravure_entity_1.Gravure)
], Personnalisation.prototype, "gravure", void 0);
exports.Personnalisation = Personnalisation = __decorate([
    (0, typeorm_1.Entity)()
], Personnalisation);
//# sourceMappingURL=personnalisation.entity.js.map