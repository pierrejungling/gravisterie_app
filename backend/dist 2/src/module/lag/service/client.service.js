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
exports.ClientService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ulid_1 = require("ulid");
const entity_1 = require("../model/entity");
const enum_1 = require("../model/entity/enum");
const format_telephone_util_1 = require("../util/format-telephone.util");
const search_util_1 = require("../util/search.util");
let ClientService = class ClientService {
    clientRepository;
    commandeRepository;
    constructor(clientRepository, commandeRepository) {
        this.clientRepository = clientRepository;
        this.commandeRepository = commandeRepository;
    }
    async getAllClients() {
        const [clients, commandes] = await Promise.all([
            this.clientRepository.find(),
            this.getCommandesResumees(),
        ]);
        const parClient = this.grouperParClient(commandes);
        return clients
            .map((client) => ({ ...client, stats: this.calculerStats(parClient.get(client.id_client) ?? []) }))
            .sort((a, b) => this.dateValue(b.stats.derniere_commande) - this.dateValue(a.stats.derniere_commande));
    }
    async rechercherClients(query, limit = 8) {
        const trimmed = (0, search_util_1.normalizeSearchText)(query || '');
        if (trimmed.length < 2) {
            return [];
        }
        const tous = await this.getAllClients();
        return tous
            .map((client) => ({ client, score: (0, search_util_1.scoreFlexibleSearch)(this.texteRecherche(client), trimmed) }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score || b.client.stats.nb_commandes - a.client.stats.nb_commandes)
            .slice(0, limit)
            .map((r) => r.client);
    }
    async getClientById(idClient) {
        const client = await this.clientRepository.findOne({ where: { id_client: idClient } });
        if (!client) {
            throw new common_1.NotFoundException('Client introuvable');
        }
        const commandes = (await this.getCommandesResumees(idClient)).map((c) => c.commande);
        commandes.sort((a, b) => this.dateValue(b.date_commande) - this.dateValue(a.date_commande));
        return { ...client, stats: this.calculerStats(commandes), commandes };
    }
    async ajouterClient(payload) {
        const client = new entity_1.Client();
        client.id_client = (0, ulid_1.ulid)();
        this.appliquerPayload(client, payload);
        if (!client.nom && !client.prénom && !client.société) {
            throw new common_1.BadRequestException('Indique au moins un nom, un prénom ou une société');
        }
        return this.clientRepository.save(client);
    }
    async modifierClient(idClient, payload) {
        const client = await this.clientRepository.findOne({ where: { id_client: idClient } });
        if (!client) {
            throw new common_1.NotFoundException('Client introuvable');
        }
        this.appliquerPayload(client, payload);
        return this.clientRepository.save(client);
    }
    async supprimerClient(idClient) {
        const client = await this.clientRepository.findOne({ where: { id_client: idClient } });
        if (!client) {
            throw new common_1.NotFoundException('Client introuvable');
        }
        const nb = await this.commandeRepository.count({ where: { client: { id_client: idClient } } });
        if (nb > 0) {
            throw new common_1.BadRequestException(`Ce client a ${nb} commande(s) : fusionne-le plutôt avec une autre fiche`);
        }
        await this.clientRepository.remove(client);
    }
    async fusionnerClients(idCible, idsSources) {
        const sources = [...new Set(idsSources.filter((id) => id && id !== idCible))];
        if (sources.length === 0) {
            throw new common_1.BadRequestException('Aucune fiche à fusionner');
        }
        await this.clientRepository.manager.transaction(async (manager) => {
            const clientRepo = manager.getRepository(entity_1.Client);
            const commandeRepo = manager.getRepository(entity_1.Commande);
            const cible = await clientRepo.findOne({ where: { id_client: idCible } });
            if (!cible) {
                throw new common_1.NotFoundException('Fiche cible introuvable');
            }
            const fiches = await clientRepo.find({ where: { id_client: (0, typeorm_2.In)(sources) } });
            if (fiches.length !== sources.length) {
                throw new common_1.NotFoundException('Une des fiches à fusionner est introuvable');
            }
            const champs = ['nom', 'prénom', 'société', 'mail', 'téléphone', 'adresse', 'tva'];
            const vide = (champ, valeur) => !valeur ||
                (champ === 'adresse' &&
                    String(valeur)
                        .split(',')
                        .map((p) => p.trim().toLowerCase())
                        .every((p) => !p || p === 'belgique'));
            for (const fiche of fiches) {
                for (const champ of champs) {
                    if (vide(champ, cible[champ]) && !vide(champ, fiche[champ])) {
                        cible[champ] = fiche[champ];
                    }
                }
                if (fiche.notes?.trim()) {
                    cible.notes = [cible.notes?.trim(), fiche.notes.trim()].filter(Boolean).join('\n');
                }
            }
            await clientRepo.save(cible);
            await commandeRepo
                .createQueryBuilder()
                .update(entity_1.Commande)
                .set({ client: { id_client: idCible } })
                .where('id_client IN (:...ids)', { ids: sources })
                .execute();
            await clientRepo.remove(fiches);
        });
        return this.getClientById(idCible);
    }
    async trouverCorrespondances(criteres, limit = 4) {
        const mail = criteres.mail?.trim().toLowerCase() || '';
        const tel = this.normaliserTelephone(criteres.telephone);
        const nom = (0, search_util_1.normalizeSearchText)(criteres.nom || '');
        const prenom = (0, search_util_1.normalizeSearchText)(criteres.prenom || '');
        const societe = (0, search_util_1.normalizeSearchText)(criteres.societe || '');
        if (!mail && tel.length < 6 && nom.length < 3 && prenom.length < 3 && societe.length < 3)
            return [];
        const commence = (valeur, debut) => !!debut && (0, search_util_1.normalizeSearchText)(valeur || '').split(/\s+/).some((mot) => mot.startsWith(debut));
        const resultats = [];
        for (const client of await this.getAllClients()) {
            const raisons = [];
            let score = 0;
            const mailClient = client.mail?.trim().toLowerCase() || '';
            if (mail.length >= 5 && mailClient && (mailClient === mail || (mail.length >= 6 && mailClient.startsWith(mail)))) {
                raisons.push('mail');
                score += 4;
            }
            const telClient = this.normaliserTelephone(client.téléphone);
            if (tel.length >= 6 && telClient.length >= 6 && (telClient === tel || telClient.startsWith(tel))) {
                raisons.push('téléphone');
                score += 4;
            }
            const nomClientOk = (a) => a.length >= 3 && (commence(client.nom, a) || commence(client.prénom, a));
            const prenomOk = (a) => a.length >= 2 && (commence(client.prénom, a) || commence(client.nom, a));
            if (nomClientOk(nom) || (!nom && nomClientOk(prenom))) {
                raisons.push('nom');
                score += nom && prenom && prenomOk(prenom) ? 3 : 2;
            }
            if (societe.length >= 3 && (0, search_util_1.normalizeSearchText)(client.société || '').includes(societe)) {
                raisons.push('société');
                score += 2;
            }
            if (raisons.length)
                resultats.push({ ...client, raisons, score });
        }
        return resultats
            .sort((a, b) => b.score - a.score || b.stats.nb_commandes - a.stats.nb_commandes)
            .slice(0, limit)
            .map(({ score, ...reste }) => reste);
    }
    normaliserTelephone(valeur) {
        return (valeur || '').replace(/\D/g, '').replace(/^(0032|32)/, '0');
    }
    async getDoublons() {
        const clients = await this.getAllClients();
        const parent = new Map();
        const find = (id) => {
            const p = parent.get(id) ?? id;
            if (p === id)
                return id;
            const root = find(p);
            parent.set(id, root);
            return root;
        };
        const union = (a, b) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb)
                parent.set(rb, ra);
        };
        const index = new Map();
        for (const client of clients) {
            for (const cle of this.clesDoublon(client)) {
                const existant = index.get(cle);
                if (existant) {
                    union(existant, client.id_client);
                }
                else {
                    index.set(cle, client.id_client);
                }
            }
        }
        const groupes = new Map();
        for (const client of clients) {
            const racine = find(client.id_client);
            const groupe = groupes.get(racine) ?? [];
            groupe.push(client);
            groupes.set(racine, groupe);
        }
        return [...groupes.values()]
            .filter((g) => g.length > 1)
            .map((g) => g.sort((a, b) => b.stats.nb_commandes - a.stats.nb_commandes))
            .sort((a, b) => b.length - a.length);
    }
    clesDoublon(client) {
        const cles = [];
        const mail = client.mail?.trim().toLowerCase();
        if (mail)
            cles.push(`mail:${mail}`);
        const tel = (client.téléphone || '').replace(/\D/g, '').replace(/^(0032|32)/, '0');
        if (tel.length >= 8)
            cles.push(`tel:${tel}`);
        const nom = (0, search_util_1.normalizeSearchText)(client.nom || '');
        const prenom = (0, search_util_1.normalizeSearchText)(client.prénom || '');
        if (nom && prenom) {
            cles.push(`nom:${[nom, prenom].sort().join('|')}`);
        }
        else if (!nom && !prenom) {
            const societe = (0, search_util_1.normalizeSearchText)(client.société || '');
            if (societe)
                cles.push(`societe:${societe}`);
        }
        return cles;
    }
    appliquerPayload(client, payload) {
        const texte = (v) => (v === undefined ? undefined : v.trim() || null);
        const champs = [
            ['nom', texte(payload.nom)],
            ['prénom', texte(payload.prenom)],
            ['société', texte(payload.societe)],
            ['mail', texte(payload.mail)],
            ['adresse', texte(payload.adresse)],
            ['tva', texte(payload.tva)],
            ['notes', texte(payload.notes)],
        ];
        for (const [champ, valeur] of champs) {
            if (valeur !== undefined)
                client[champ] = valeur;
        }
        if (payload.telephone !== undefined) {
            client.téléphone = (0, format_telephone_util_1.formatTelephoneBE)(payload.telephone);
        }
        for (const champ of ['nom', 'prénom', 'société', 'mail', 'téléphone', 'adresse', 'tva', 'notes']) {
            if (client[champ] === undefined)
                client[champ] = null;
        }
    }
    texteRecherche(client) {
        return [client.nom, client.prénom, client.société, client.mail, client.téléphone]
            .filter(Boolean)
            .join(' ');
    }
    async getCommandesResumees(idClient) {
        const qb = this.commandeRepository
            .createQueryBuilder('c')
            .leftJoin('c.client', 'cl')
            .select([
            'c.id_commande',
            'c.produit',
            'c.date_commande',
            'c.deadline',
            'c.statut_commande',
            'c.statuts_actifs',
            'c.prix_final',
            'c.payé',
            'c.quantité',
            'cl.id_client',
        ]);
        if (idClient) {
            qb.where('cl.id_client = :idClient', { idClient });
        }
        const commandes = await qb.getMany();
        return commandes.map((c) => ({
            id_client: c.client?.id_client ?? null,
            commande: {
                id_commande: c.id_commande,
                produit: c.produit ?? null,
                date_commande: c.date_commande ?? null,
                deadline: c.deadline ?? null,
                statut_commande: c.statut_commande,
                statuts_actifs: c.statuts_actifs ?? null,
                prix_final: c.prix_final != null ? Number(c.prix_final) : null,
                payé: !!c.payé,
                quantité: c.quantité ?? null,
            },
        }));
    }
    grouperParClient(lignes) {
        const map = new Map();
        for (const { id_client, commande } of lignes) {
            if (!id_client)
                continue;
            const liste = map.get(id_client) ?? [];
            liste.push(commande);
            map.set(id_client, liste);
        }
        return map;
    }
    calculerStats(commandes) {
        const valides = commandes.filter((c) => c.statut_commande !== enum_1.StatutCommande.ANNULEE);
        const avecPrix = valides.filter((c) => c.prix_final != null && c.prix_final > 0);
        const ca = avecPrix.reduce((total, c) => total + (c.prix_final ?? 0), 0);
        const resteAPayer = avecPrix.filter((c) => !c.payé).reduce((total, c) => total + (c.prix_final ?? 0), 0);
        const dates = commandes.map((c) => this.dateValue(c.date_commande)).filter((d) => d > 0);
        return {
            nb_commandes: commandes.length,
            nb_en_cours: commandes.filter((c) => c.statut_commande !== enum_1.StatutCommande.TERMINE && c.statut_commande !== enum_1.StatutCommande.ANNULEE).length,
            nb_terminees: commandes.filter((c) => c.statut_commande === enum_1.StatutCommande.TERMINE).length,
            nb_annulees: commandes.filter((c) => c.statut_commande === enum_1.StatutCommande.ANNULEE).length,
            ca_total: Math.round(ca * 100) / 100,
            panier_moyen: avecPrix.length ? Math.round((ca / avecPrix.length) * 100) / 100 : 0,
            reste_a_payer: Math.round(resteAPayer * 100) / 100,
            premiere_commande: dates.length ? new Date(Math.min(...dates)) : null,
            derniere_commande: dates.length ? new Date(Math.max(...dates)) : null,
        };
    }
    dateValue(date) {
        if (!date)
            return 0;
        const value = new Date(date).getTime();
        return Number.isNaN(value) ? 0 : value;
    }
};
exports.ClientService = ClientService;
exports.ClientService = ClientService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entity_1.Client)),
    __param(1, (0, typeorm_1.InjectRepository)(entity_1.Commande)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ClientService);
//# sourceMappingURL=client.service.js.map