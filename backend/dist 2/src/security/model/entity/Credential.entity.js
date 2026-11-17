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
exports.Credential = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
let Credential = class Credential {
    credential_id;
    username;
    password;
    mail;
    facebookHash;
    googleHash;
    isAdmin;
    active;
    created;
    updated;
};
exports.Credential = Credential;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Identifiant unique du credential', example: '01HZJ8K9M2N3P4Q5R6S7T8U9V' }),
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 26, default: () => `'${(0, ulid_1.ulid)()}'` }),
    __metadata("design:type", String)
], Credential.prototype, "credential_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Nom d\'utilisateur', example: 'john.doe' }),
    (0, typeorm_1.Column)({ nullable: false, unique: true }),
    __metadata("design:type", String)
], Credential.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Mot de passe hashé', example: '$2b$10$...', required: false }),
    (0, class_transformer_1.Exclude)({ toPlainOnly: true }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Credential.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Adresse email', example: 'john.doe@example.com' }),
    (0, typeorm_1.Column)({ nullable: false, unique: true }),
    __metadata("design:type", String)
], Credential.prototype, "mail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Hash Facebook pour connexion sociale', required: false }),
    (0, typeorm_1.Column)({ nullable: true, unique: false }),
    __metadata("design:type", String)
], Credential.prototype, "facebookHash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Hash Google pour connexion sociale', required: false }),
    (0, typeorm_1.Column)({ nullable: true, unique: false }),
    __metadata("design:type", String)
], Credential.prototype, "googleHash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Indique si l\'utilisateur est administrateur', example: false }),
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Credential.prototype, "isAdmin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Indique si le compte est actif', example: true }),
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Credential.prototype, "active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Date de création du compte' }),
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Credential.prototype, "created", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Date de dernière mise à jour' }),
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Credential.prototype, "updated", void 0);
exports.Credential = Credential = __decorate([
    (0, typeorm_1.Entity)()
], Credential);
//# sourceMappingURL=Credential.entity.js.map