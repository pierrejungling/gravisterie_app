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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandeFichierService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const commande_fichier_entity_1 = require("../model/entity/commande_fichier.entity");
const commande_entity_1 = require("../model/entity/commande.entity");
const r2_service_1 = require("./r2.service");
const ulid_1 = require("ulid");
const PREFIX = 'commandes';
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}
let CommandeFichierService = class CommandeFichierService {
    fichierRepository;
    commandeRepository;
    r2Service;
    constructor(fichierRepository, commandeRepository, r2Service) {
        this.fichierRepository = fichierRepository;
        this.commandeRepository = commandeRepository;
        this.r2Service = r2Service;
    }
    async listByCommande(idCommande) {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
        });
        if (!commande) {
            throw new common_1.NotFoundException('Commande non trouvée');
        }
        return this.fichierRepository.find({
            where: { commande: { id_commande: idCommande } },
            order: { date_upload: 'DESC' },
        });
    }
    async upload(idCommande, file) {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
        });
        if (!commande) {
            throw new common_1.NotFoundException('Commande non trouvée');
        }
        const idFichier = (0, ulid_1.ulid)();
        const nomSanitized = sanitizeFileName(file.originalname || 'fichier');
        const keyR2 = `${PREFIX}/${idCommande}/${idFichier}_${nomSanitized}`;
        await this.r2Service.upload(keyR2, file.buffer, file.mimetype || 'application/octet-stream');
        const fichier = new commande_fichier_entity_1.CommandeFichier();
        fichier.id_fichier = idFichier;
        fichier.key_r2 = keyR2;
        fichier.nom_fichier = file.originalname || 'fichier';
        fichier.type_mime = file.mimetype || null;
        fichier.taille_octets = file.size ?? null;
        fichier.date_upload = new Date();
        fichier.commande = commande;
        return this.fichierRepository.save(fichier);
    }
    async getStream(idCommande, idFichier) {
        const fichier = await this.fichierRepository.findOne({
            where: {
                id_fichier: idFichier,
                commande: { id_commande: idCommande },
            },
        });
        if (!fichier) {
            throw new common_1.NotFoundException('Fichier non trouvé');
        }
        const { stream, contentType } = await this.r2Service.getStream(fichier.key_r2);
        return { stream, contentType, nomFichier: fichier.nom_fichier };
    }
    async delete(idCommande, idFichier) {
        const fichier = await this.fichierRepository.findOne({
            where: {
                id_fichier: idFichier,
                commande: { id_commande: idCommande },
            },
        });
        if (!fichier) {
            throw new common_1.NotFoundException('Fichier non trouvé');
        }
        await this.r2Service.delete(fichier.key_r2);
        await this.fichierRepository.remove(fichier);
    }
    async deleteAllByCommande(idCommande) {
        const fichiers = await this.fichierRepository.find({
            where: { commande: { id_commande: idCommande } },
        });
        for (const f of fichiers) {
            await this.r2Service.delete(f.key_r2);
            await this.fichierRepository.remove(f);
        }
    }
    async duplicateForCommande(sourceCommandeId, targetCommandeId) {
        const targetCommande = await this.commandeRepository.findOne({
            where: { id_commande: targetCommandeId },
        });
        if (!targetCommande) {
            throw new common_1.NotFoundException('Commande cible non trouvée');
        }
        const fichiers = await this.fichierRepository.find({
            where: { commande: { id_commande: sourceCommandeId } },
        });
        for (const f of fichiers) {
            const { stream, contentType } = await this.r2Service.getStream(f.key_r2);
            const buffer = await this.streamToBuffer(stream);
            const idFichier = (0, ulid_1.ulid)();
            const nomSanitized = sanitizeFileName(f.nom_fichier || 'fichier');
            const keyR2 = `${PREFIX}/${targetCommandeId}/${idFichier}_${nomSanitized}`;
            await this.r2Service.upload(keyR2, buffer, f.type_mime || contentType || 'application/octet-stream');
            const fichier = new commande_fichier_entity_1.CommandeFichier();
            fichier.id_fichier = idFichier;
            fichier.key_r2 = keyR2;
            fichier.nom_fichier = f.nom_fichier;
            fichier.type_mime = f.type_mime;
            fichier.taille_octets = f.taille_octets ?? buffer.length;
            fichier.date_upload = new Date();
            fichier.commande = targetCommande;
            await this.fichierRepository.save(fichier);
        }
    }
    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
};
exports.CommandeFichierService = CommandeFichierService;
exports.CommandeFichierService = CommandeFichierService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(commande_fichier_entity_1.CommandeFichier)),
    __param(1, (0, typeorm_1.InjectRepository)(commande_entity_1.Commande)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        r2_service_1.R2Service])
], CommandeFichierService);
//# sourceMappingURL=commande-fichier.service.js.map