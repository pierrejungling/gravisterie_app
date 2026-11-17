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
exports.Gravure = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const commande_entity_1 = require("./commande.entity");
let Gravure = class Gravure {
    id_gravure;
    date_gravure;
    commande;
};
exports.Gravure = Gravure;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], Gravure.prototype, "id_gravure", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: false }),
    __metadata("design:type", Date)
], Gravure.prototype, "date_gravure", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => commande_entity_1.Commande, (commande) => commande.id_commande),
    (0, typeorm_1.JoinColumn)({ name: 'id_commande' }),
    __metadata("design:type", commande_entity_1.Commande)
], Gravure.prototype, "commande", void 0);
exports.Gravure = Gravure = __decorate([
    (0, typeorm_1.Entity)()
], Gravure);
//# sourceMappingURL=gravure.entity.js.map