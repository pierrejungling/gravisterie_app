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
exports.EvenementService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ulid_1 = require("ulid");
const entity_1 = require("../model/entity");
const enum_1 = require("../model/entity/enum");
let EvenementService = class EvenementService {
    repo;
    commandeRepo;
    clientRepo;
    constructor(repo, commandeRepo, clientRepo) {
        this.repo = repo;
        this.commandeRepo = commandeRepo;
        this.clientRepo = clientRepo;
    }
    async liste() {
        const [evenements, commandes] = await Promise.all([
            this.repo.find(),
            this.commandeRepo
                .createQueryBuilder('c')
                .select(['c.id_commande', 'c.id_evenement', 'c.prix_final', 'c.statut_commande'])
                .where('c.id_evenement IS NOT NULL')
                .getMany(),
        ]);
        const clients = await this.clients(evenements.map((e) => e.id_client));
        return evenements
            .map((e) => {
            const liees = commandes.filter((c) => c.id_evenement === e.id_evenement);
            return { ...e, client: clients.get(e.id_client || '') ?? null, stats: this.stats(e, liees) };
        })
            .sort((a, b) => this.date(b.date_debut) - this.date(a.date_debut));
    }
    async detail(id) {
        const e = await this.trouver(id);
        const commandes = await this.commandeRepo.find({
            where: { id_evenement: id },
            relations: ['client'],
            order: { date_commande: 'DESC' },
        });
        const clients = await this.clients([e.id_client]);
        return {
            ...e,
            client: clients.get(e.id_client || '') ?? null,
            stats: this.stats(e, commandes),
            commandes: commandes.map((c) => ({
                id_commande: c.id_commande,
                produit: c.produit,
                date_commande: c.date_commande,
                deadline: c.deadline,
                statut_commande: c.statut_commande,
                prix_final: c.prix_final !== null ? Number(c.prix_final) : null,
                payé: c.payé,
                quantité: c.quantité,
                client: c.client ? this.nomClient(c.client) : null,
            })),
        };
    }
    async creer(payload) {
        const e = this.repo.create({ id_evenement: (0, ulid_1.ulid)(), materiel: [], type: 'gravure_direct', statut: 'propose', formule: 'a_definir' });
        this.appliquer(e, payload);
        if (!e.nom?.trim())
            throw new common_1.BadRequestException("Donne un nom à l'événement");
        return this.repo.save(e);
    }
    async modifier(id, payload) {
        const e = await this.trouver(id);
        this.appliquer(e, payload);
        if (!e.nom?.trim())
            throw new common_1.BadRequestException("Donne un nom à l'événement");
        return this.repo.save(e);
    }
    async supprimer(id) {
        const e = await this.trouver(id);
        await this.commandeRepo.update({ id_evenement: id }, { id_evenement: null });
        await this.repo.remove(e);
    }
    async lierCommande(id, idCommande) {
        await this.trouver(id);
        const res = await this.commandeRepo.update({ id_commande: idCommande }, { id_evenement: id });
        if (!res.affected)
            throw new common_1.NotFoundException('Commande introuvable');
    }
    async delierCommande(id, idCommande) {
        await this.commandeRepo.update({ id_commande: idCommande, id_evenement: id }, { id_evenement: null });
    }
    async resume(id) {
        const e = await this.trouver(id);
        return { id_evenement: e.id_evenement, nom: e.nom, date_debut: e.date_debut, statut: e.statut };
    }
    async trouver(id) {
        const e = await this.repo.findOne({ where: { id_evenement: id } });
        if (!e)
            throw new common_1.NotFoundException('Événement introuvable');
        return e;
    }
    appliquer(e, p) {
        const texte = (v) => (v === undefined ? undefined : (v ?? '').trim() || null);
        const champsTexte = ['heure_arrivee', 'lieu', 'adresse', 'contact_nom', 'contact_telephone', 'contact_mail', 'id_client', 'notes'];
        if (p.nom !== undefined)
            e.nom = (p.nom || '').trim();
        if (p.type !== undefined)
            e.type = p.type;
        if (p.statut !== undefined)
            e.statut = p.statut;
        if (p.formule !== undefined)
            e.formule = p.formule;
        if (p.paye !== undefined)
            e.paye = p.paye;
        champsTexte.forEach((champ) => {
            const v = texte(p[champ]);
            if (v !== undefined)
                e[champ] = v;
        });
        ['date_debut', 'date_fin'].forEach((champ) => {
            if (p[champ] === undefined)
                return;
            const v = p[champ] ? new Date(p[champ]) : null;
            if (v && isNaN(v.getTime()))
                throw new common_1.BadRequestException('Date invalide');
            e[champ] = v;
        });
        ['prix_forfait', 'prix_gravure', 'nb_gravures', 'heures_sur_place', 'heures_trajet', 'forfait_carburant'].forEach((champ) => {
            if (p[champ] === undefined)
                return;
            e[champ] = p[champ] === null || !isFinite(Number(p[champ])) ? null : Number(p[champ]);
        });
        if (p.materiel !== undefined) {
            e.materiel = (p.materiel || [])
                .filter((m) => m && typeof m.texte === 'string' && m.texte.trim())
                .slice(0, 100)
                .map((m) => ({ texte: m.texte.trim().slice(0, 200), fait: !!m.fait }));
        }
    }
    stats(e, commandes) {
        const valides = commandes.filter((c) => c.statut_commande !== enum_1.StatutCommande.ANNULEE);
        const ca = valides.reduce((s, c) => s + (Number(c.prix_final) || 0), 0);
        let prestation = Number(e.prix_forfait) || 0;
        if (e.formule === 'a_la_gravure')
            prestation += (Number(e.prix_gravure) || 0) * (e.nb_gravures || 0);
        if (e.statut === 'annule' || e.statut === 'refuse')
            prestation = 0;
        const arrondi = (n) => Math.round(n * 100) / 100;
        return { nb_commandes: commandes.length, ca_commandes: arrondi(ca), prestation: arrondi(prestation), total: arrondi(ca + prestation) };
    }
    async clients(ids) {
        const uniques = [...new Set(ids.filter((v) => !!v))];
        if (uniques.length === 0)
            return new Map();
        const list = await this.clientRepo.find({ where: { id_client: (0, typeorm_2.In)(uniques) } });
        return new Map(list.map((c) => [c.id_client, { id_client: c.id_client, nom: c.nom, prénom: c.prénom, société: c.société }]));
    }
    nomClient(c) {
        return [c.prénom, c.nom].filter((v) => v && String(v).trim()).join(' ') || c.société || null;
    }
    date(d) {
        return d ? new Date(d).getTime() : 0;
    }
};
exports.EvenementService = EvenementService;
exports.EvenementService = EvenementService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entity_1.Evenement)),
    __param(1, (0, typeorm_1.InjectRepository)(entity_1.Commande)),
    __param(2, (0, typeorm_1.InjectRepository)(entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EvenementService);
//# sourceMappingURL=evenement.service.js.map