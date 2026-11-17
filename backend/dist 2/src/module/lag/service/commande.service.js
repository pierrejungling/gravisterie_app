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
var CommandeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entity_1 = require("../model/entity");
const enum_1 = require("../model/entity/enum");
const ulid_1 = require("ulid");
const commande_fichier_service_1 = require("./commande-fichier.service");
const format_telephone_util_1 = require("../util/format-telephone.util");
const search_util_1 = require("../util/search.util");
const empreinte_util_1 = require("../util/empreinte.util");
let CommandeService = CommandeService_1 = class CommandeService {
    commandeRepository;
    clientRepository;
    gravureRepository;
    personnalisationRepository;
    supportRepository;
    commandeSupportRepository;
    commandeLignePrixRepository;
    commandeFichierService;
    logger = new common_1.Logger(CommandeService_1.name);
    constructor(commandeRepository, clientRepository, gravureRepository, personnalisationRepository, supportRepository, commandeSupportRepository, commandeLignePrixRepository, commandeFichierService) {
        this.commandeRepository = commandeRepository;
        this.clientRepository = clientRepository;
        this.gravureRepository = gravureRepository;
        this.personnalisationRepository = personnalisationRepository;
        this.supportRepository = supportRepository;
        this.commandeSupportRepository = commandeSupportRepository;
        this.commandeLignePrixRepository = commandeLignePrixRepository;
        this.commandeFichierService = commandeFichierService;
    }
    copierFicheClient(source) {
        const copie = new entity_1.Client();
        copie.id_client = (0, ulid_1.ulid)();
        copie.nom = source.nom;
        copie.prénom = source.prénom;
        copie.société = source.société;
        copie.mail = source.mail;
        copie.téléphone = source.téléphone;
        copie.adresse = source.adresse;
        copie.tva = source.tva;
        copie.notes = source.notes;
        return copie;
    }
    parseQuantiteProduitCompteursJson(raw) {
        if (!raw || !raw.trim()) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                return null;
            }
            const out = [];
            for (const item of parsed) {
                if (typeof item !== 'object' || item === null)
                    continue;
                const o = item;
                let idStr = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : (0, ulid_1.ulid)();
                const libelle = typeof o.libelle === 'string' ? o.libelle : '';
                let cible = parseInt(String(o.quantite_cible ?? 1), 10);
                let realise = parseInt(String(o.quantite_realisee ?? 0), 10);
                if (!Number.isFinite(cible))
                    cible = 1;
                if (cible < 1)
                    cible = 1;
                if (!Number.isFinite(realise))
                    realise = 0;
                if (realise < 0)
                    realise = 0;
                out.push({ id: idStr, libelle, quantite_cible: cible, quantite_realisee: realise });
            }
            return out.length === 0 ? null : out;
        }
        catch {
            return null;
        }
    }
    normalizeQuantiteProduitCompteursForStorage(input) {
        if (input === null)
            return null;
        if (!Array.isArray(input)) {
            throw new Error('quantite_produit_compteurs invalide');
        }
        if (input.length === 0)
            return null;
        const out = [];
        for (const item of input) {
            if (typeof item !== 'object' || item === null)
                continue;
            const o = item;
            const idStr = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : (0, ulid_1.ulid)();
            const libelle = typeof o.libelle === 'string' ? o.libelle : '';
            let cible = parseInt(String(o.quantite_cible ?? 1), 10);
            let realise = parseInt(String(o.quantite_realisee ?? 0), 10);
            if (!Number.isFinite(cible))
                cible = 1;
            if (cible < 1)
                cible = 1;
            if (!Number.isFinite(realise))
                realise = 0;
            if (realise < 0)
                realise = 0;
            out.push({ id: idStr, libelle, quantite_cible: cible, quantite_realisee: realise });
        }
        return out.length === 0 ? null : JSON.stringify(out);
    }
    async creerCommandeDepuisWebhook(dto, files = []) {
        const parseBool = (v) => v === '1' || v === 'true' || v === 'on';
        const newsletter = parseBool(dto.newsletter);
        const terms = parseBool(dto.terms);
        const adresseParts = [dto.street, dto.postal, dto.city, dto.country]
            .map((p) => p?.trim() ?? '')
            .filter((p) => p.length > 0);
        const adresse = adresseParts.length > 0 ? adresseParts.join(', ').slice(0, 100) : undefined;
        const deadlineRaw = dto.deadline?.trim() || '';
        const deadlineIsDate = deadlineRaw !== '' && !Number.isNaN(Date.parse(deadlineRaw));
        const descriptionParts = [];
        if (dto.product_name?.trim()) {
            descriptionParts.push(`Produit demandé : ${dto.product_name.trim()}`);
        }
        if (dto.message?.trim()) {
            descriptionParts.push(`Remarques supplémentaires :\n${dto.message.trim()}`);
        }
        descriptionParts.push(`Deadline : ${deadlineRaw || 'Non spécifiée'}`);
        descriptionParts.push(`Newsletter : ${newsletter ? 'Oui' : 'Non'}`);
        descriptionParts.push(`CGV acceptées : ${terms ? 'Oui' : 'Non'}`);
        const nomClient = [dto.lastname?.trim(), dto.firstname?.trim()].filter(Boolean).join(' ');
        const payload = {
            nom_commande: `🌐 ${nomClient || dto.email.trim()}`.slice(0, 100),
            deadline: deadlineIsDate ? new Date(deadlineRaw).toISOString() : undefined,
            coordonnees_contact: {
                nom: dto.lastname?.trim().slice(0, 50) || undefined,
                prenom: dto.firstname?.trim().slice(0, 50) || undefined,
                mail: dto.email?.trim().slice(0, 50) || undefined,
                telephone: (0, format_telephone_util_1.formatTelephoneBE)(dto.phone) || undefined,
                adresse,
            },
            description_projet: descriptionParts.join('\n\n'),
            mode_contact: 'mail',
            attente_reponse: false,
        };
        const commande = await this.ajouterCommande(payload);
        commande.CGV_acceptée = terms;
        commande.newsletter_acceptée = newsletter;
        commande.source_web = true;
        commande.site_traitee = false;
        const commandeSauvegardee = await this.commandeRepository.save(commande);
        for (const file of files) {
            try {
                await this.commandeFichierService.upload(commandeSauvegardee.id_commande, file);
            }
            catch (error) {
                this.logger.error(`Webhook : échec upload du fichier "${file.originalname}" pour la commande ${commandeSauvegardee.id_commande}: ${error?.message ?? error}`);
            }
        }
        return commandeSauvegardee;
    }
    async ajouterCommande(payload) {
        let client = null;
        const forcerNouveauClient = payload.forcer_nouveau_client === true;
        if (payload.id_client) {
            client = await this.clientRepository.findOne({ where: { id_client: payload.id_client } });
            if (!client) {
                throw new common_1.NotFoundException('Client introuvable');
            }
        }
        if (!client && !forcerNouveauClient && payload.coordonnees_contact?.mail && payload.coordonnees_contact.mail.trim()) {
            client = await this.clientRepository.findOne({
                where: { mail: payload.coordonnees_contact.mail.trim() }
            });
        }
        if (!client) {
            const clientId = (0, ulid_1.ulid)();
            const mailValue = payload.coordonnees_contact?.mail?.trim() || null;
            const telephoneValue = (0, format_telephone_util_1.formatTelephoneBE)(payload.coordonnees_contact?.telephone);
            const societeValue = payload.coordonnees_contact?.societe?.trim() || null;
            let existingClient = null;
            if (!forcerNouveauClient && mailValue) {
                existingClient = await this.clientRepository.findOne({
                    where: { mail: mailValue }
                });
            }
            if (!existingClient) {
                client = new entity_1.Client();
                client.id_client = clientId;
                client.nom = payload.coordonnees_contact?.nom?.trim() || null;
                client.prénom = payload.coordonnees_contact?.prenom?.trim() || null;
                client.mail = mailValue;
                client.téléphone = telephoneValue;
                client.société = societeValue;
                client.adresse = payload.coordonnees_contact?.adresse?.trim() || null;
                client.tva = payload.coordonnees_contact?.tva?.trim() || null;
                try {
                    client = await this.clientRepository.save(client);
                }
                catch (error) {
                    if (error.code === '23505' && error.constraint === 'PK_83f4571a0e37e3822fff36d6b8a') {
                        client.id_client = (0, ulid_1.ulid)();
                        client = await this.clientRepository.save(client);
                    }
                    else {
                        throw error;
                    }
                }
            }
            else {
                client = existingClient;
            }
        }
        else {
            if (payload.nouvelle_fiche_client === true && payload.coordonnees_contact) {
                client = this.copierFicheClient(client);
            }
            if (payload.coordonnees_contact?.nom !== undefined) {
                client.nom = payload.coordonnees_contact.nom?.trim() || null;
            }
            if (payload.coordonnees_contact?.prenom !== undefined) {
                client.prénom = payload.coordonnees_contact.prenom?.trim() || null;
            }
            if (payload.coordonnees_contact?.telephone !== undefined) {
                client.téléphone = (0, format_telephone_util_1.formatTelephoneBE)(payload.coordonnees_contact.telephone);
            }
            if (payload.coordonnees_contact?.societe !== undefined) {
                client.société = payload.coordonnees_contact.societe?.trim() || null;
            }
            if (payload.coordonnees_contact?.mail !== undefined) {
                client.mail = payload.coordonnees_contact.mail?.trim() || null;
            }
            if (payload.coordonnees_contact?.adresse !== undefined) {
                client.adresse = payload.coordonnees_contact.adresse?.trim() || null;
            }
            if (payload.coordonnees_contact?.tva !== undefined) {
                client.tva = payload.coordonnees_contact.tva?.trim() || null;
            }
            client = await this.clientRepository.save(client);
        }
        const commande = new entity_1.Commande();
        commande.id_commande = (0, ulid_1.ulid)();
        commande.produit = payload.nom_commande;
        commande.deadline = payload.deadline ? new Date(payload.deadline) : null;
        commande.date_commande = payload.date_commande ? new Date(payload.date_commande) : new Date();
        commande.description = payload.description_projet ?? null;
        commande.quantité = payload.quantité ?? 1;
        commande.prix_final = payload.prix_final ?? null;
        commande.prix_unitaire_final = payload.prix_unitaire_final ?? null;
        commande.frais_pourcentage = payload.frais_pourcentage ?? null;
        commande.frais_commission_id = payload.frais_commission_id?.trim() || null;
        commande.frais_commission_libelle = payload.frais_commission_libelle?.trim() || null;
        commande.payé = payload.payé ?? false;
        commande.commentaire_paye = payload.commentaire_paye?.trim() || null;
        commande.attente_reponse = payload.attente_reponse ?? false;
        commande.mode_contact = payload.mode_contact || null;
        commande.fichiers_joints = payload.fichiers_joints && payload.fichiers_joints.length > 0 ? payload.fichiers_joints.join(',') : null;
        const statutsFinaux = [enum_1.StatutCommande.A_LIVRER, enum_1.StatutCommande.A_METTRE_EN_LIGNE, enum_1.StatutCommande.A_FACTURER, enum_1.StatutCommande.DEMANDE_AVIS];
        const ordreEtapes = [
            enum_1.StatutCommande.EN_ATTENTE_INFORMATION,
            enum_1.StatutCommande.A_MODELLISER_PREPARER,
            enum_1.StatutCommande.A_GRAVER,
            enum_1.StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
            enum_1.StatutCommande.A_PRENDRE_EN_PHOTO,
        ];
        if (payload.statut_initial && payload.statut_initial.trim()) {
            const statutInitial = payload.statut_initial;
            if (statutsFinaux.includes(statutInitial)) {
                commande.statut_commande = enum_1.StatutCommande.A_PRENDRE_EN_PHOTO;
                commande.statuts_actifs = statutsFinaux;
            }
            else {
                commande.statut_commande = statutInitial;
                commande.statuts_actifs = null;
            }
        }
        else {
            commande.statut_commande = enum_1.StatutCommande.EN_ATTENTE_INFORMATION;
            commande.statuts_actifs = null;
        }
        commande.client = client;
        commande.CGV_acceptée = false;
        commande.newsletter_acceptée = false;
        let commandeSauvegardee;
        try {
            commandeSauvegardee = await this.commandeRepository.save(commande);
        }
        catch (error) {
            if (error.code === '23505' && error.constraint === 'PK_dc8b0018d21d1d1563e04643da9') {
                commande.id_commande = (0, ulid_1.ulid)();
                commandeSauvegardee = await this.commandeRepository.save(commande);
            }
            else {
                throw error;
            }
        }
        const gravure = new entity_1.Gravure();
        gravure.id_gravure = (0, ulid_1.ulid)();
        gravure.date_gravure = new Date();
        gravure.commande = commandeSauvegardee;
        let gravureSauvegardee;
        try {
            gravureSauvegardee = await this.gravureRepository.save(gravure);
        }
        catch (error) {
            if (error.code === '23505') {
                gravure.id_gravure = (0, ulid_1.ulid)();
                gravureSauvegardee = await this.gravureRepository.save(gravure);
            }
            else {
                throw error;
            }
        }
        const support = new entity_1.Support();
        support.id_support = (0, ulid_1.ulid)();
        support.nom_support = payload.support || 'CP';
        support.dimensions = payload.dimensions_souhaitees ?? null;
        support.gravure = gravureSauvegardee;
        try {
            await this.supportRepository.save(support);
        }
        catch (error) {
            if (error.code === '23505') {
                support.id_support = (0, ulid_1.ulid)();
                await this.supportRepository.save(support);
            }
            else {
                throw error;
            }
        }
        const personnalisation = new entity_1.Personnalisation();
        personnalisation.id_personnalisation = (0, ulid_1.ulid)();
        personnalisation.texte = payload.texte_personnalisation || '';
        personnalisation.police = payload.police_ecriture ?? null;
        personnalisation.couleur = payload.couleur && payload.couleur.length > 0 ? payload.couleur : null;
        personnalisation.gravure = gravureSauvegardee;
        try {
            await this.personnalisationRepository.save(personnalisation);
        }
        catch (error) {
            if (error.code === '23505') {
                personnalisation.id_personnalisation = (0, ulid_1.ulid)();
                await this.personnalisationRepository.save(personnalisation);
            }
            else {
                throw error;
            }
        }
        if (payload.supports && Array.isArray(payload.supports) && payload.supports.length > 0) {
            const supportsToCreate = payload.supports.map((supportData) => {
                const commandeSupport = new entity_1.CommandeSupport();
                commandeSupport.id_commande_support = (0, ulid_1.ulid)();
                commandeSupport.commande = commandeSauvegardee;
                commandeSupport.nom_support = supportData.nom_support || null;
                commandeSupport.prix_support = supportData.prix_support || null;
                commandeSupport.url_support = supportData.url_support || null;
                commandeSupport.prix_unitaire = supportData.prix_unitaire !== undefined ? supportData.prix_unitaire : true;
                commandeSupport.nombre_unites = supportData.nombre_unites || null;
                commandeSupport.prix_support_unitaire = supportData.prix_support_unitaire || null;
                commandeSupport.actif = supportData.actif !== undefined ? Boolean(supportData.actif) : true;
                commandeSupport.id_ligne_prix = this.normalizeLignePrixId(supportData.id_ligne_prix);
                return commandeSupport;
            });
            await this.commandeSupportRepository.save(supportsToCreate);
        }
        await this.replaceLignesPrix(commandeSauvegardee, payload.lignes_prix);
        return commandeSauvegardee;
    }
    async getAllCommandes() {
        return await this.commandeRepository.find({
            relations: ['client', 'supports'],
            order: {
                date_commande: 'DESC'
            }
        });
    }
    async rechercherCommandes(query, limit = 8) {
        const trimmedQuery = query.trim();
        if (trimmedQuery.length < 2) {
            return [];
        }
        const [commandes, personnalisations] = await Promise.all([
            this.getAllCommandes(),
            this.personnalisationRepository
                .createQueryBuilder('personnalisation')
                .innerJoin('personnalisation.gravure', 'gravure')
                .select('personnalisation.texte', 'texte')
                .addSelect('gravure.id_commande', 'id_commande')
                .getRawMany(),
        ]);
        const personnalisationParCommande = new Map();
        for (const row of personnalisations) {
            if (!row.id_commande || !row.texte) {
                continue;
            }
            const existing = personnalisationParCommande.get(row.id_commande);
            personnalisationParCommande.set(row.id_commande, existing ? `${existing} ${row.texte}` : row.texte);
        }
        return commandes
            .map((commande) => ({
            commande,
            score: (0, search_util_1.scoreFlexibleSearch)(this.buildCommandeSearchHaystack(commande, personnalisationParCommande.get(commande.id_commande)), trimmedQuery),
        }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((entry) => entry.commande);
    }
    buildCommandeSearchHaystack(commande, personnalisationTexte) {
        const client = commande.client;
        const supportNames = commande.supports?.map((support) => support.nom_support).filter(Boolean) ?? [];
        return [
            commande.id_commande,
            commande.produit,
            commande.description,
            personnalisationTexte,
            client?.nom,
            client?.prénom,
            client?.société,
            client?.mail,
            client?.téléphone,
            client?.tva,
            ...supportNames,
        ]
            .filter(Boolean)
            .join(' ');
    }
    async getCommandeById(idCommande) {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client', 'supports', 'lignes_prix']
        });
        if (!commande) {
            throw new Error('Commande non trouvée');
        }
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } },
            relations: ['commande']
        });
        let support = null;
        let personnalisation = null;
        if (gravure) {
            support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
            personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
        }
        const supports = commande.supports ? commande.supports.map((cs) => ({
            nom_support: cs.nom_support,
            prix_support: cs.prix_support,
            url_support: cs.url_support,
            prix_unitaire: cs.prix_unitaire,
            nombre_unites: cs.nombre_unites,
            prix_support_unitaire: cs.prix_support_unitaire,
            actif: cs.actif !== undefined ? cs.actif : true,
            id_ligne_prix: cs.id_ligne_prix
        })) : [];
        const dto = {
            id_commande: commande.id_commande,
            date_commande: commande.date_commande,
            deadline: commande.deadline,
            produit: commande.produit,
            description: commande.description,
            fichiers_joints: commande.fichiers_joints,
            CGV_acceptée: commande.CGV_acceptée,
            newsletter_acceptée: commande.newsletter_acceptée,
            statut_commande: commande.statut_commande,
            statuts_actifs: commande.statuts_actifs,
            prix_final: commande.prix_final,
            prix_unitaire_final: commande.prix_unitaire_final,
            frais_pourcentage: commande.frais_pourcentage,
            frais_commission_id: commande.frais_commission_id,
            frais_commission_libelle: commande.frais_commission_libelle,
            quantité: commande.quantité,
            quantite_realisee: commande.quantite_realisee ?? 0,
            quantite_produit_compteurs: this.parseQuantiteProduitCompteursJson(commande.quantite_produit_compteurs),
            payé: commande.payé,
            commentaire_paye: commande.commentaire_paye,
            attente_reponse: commande.attente_reponse,
            mode_contact: commande.mode_contact,
            source_web: Boolean(commande.source_web),
            site_traitee: Boolean(commande.site_traitee),
            id_evenement: commande.id_evenement ?? null,
            client: commande.client,
            lignes_prix: this.toLignesPrixDto(commande.lignes_prix),
            supports: supports,
            support: support ? {
                nom_support: support.nom_support,
                prix_support: support.prix_support,
                url_support: support.url_support,
                dimensions: support.dimensions
            } : null,
            personnalisation: personnalisation ? {
                texte: personnalisation.texte,
                police: personnalisation.police,
                couleur: personnalisation.couleur
            } : null,
            gravure: gravure ? {
                dimensions: support ? support.dimensions : null
            } : null
        };
        return { ...dto, revision: (0, empreinte_util_1.empreinteCommande)(dto) };
    }
    async dupliquerCommande(idCommande) {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client', 'supports', 'lignes_prix']
        });
        if (!commande) {
            throw new Error('Commande non trouvée');
        }
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } },
            relations: ['commande']
        });
        let support = null;
        let personnalisation = null;
        if (gravure) {
            support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
            personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
        }
        const supports = commande.supports ? commande.supports.map((cs) => ({
            nom_support: cs.nom_support,
            prix_support: cs.prix_support,
            url_support: cs.url_support,
            prix_unitaire: cs.prix_unitaire,
            nombre_unites: cs.nombre_unites,
            prix_support_unitaire: cs.prix_support_unitaire,
            actif: cs.actif !== undefined ? cs.actif : true,
            id_ligne_prix: cs.id_ligne_prix
        })) : [];
        const originalNom = commande.produit || 'Commande sans nom';
        const ventePrefix = 'Vente | ';
        const isVente = originalNom.trimStart().startsWith(ventePrefix);
        const nomBase = isVente
            ? originalNom.trimStart().slice(ventePrefix.length).trimStart()
            : originalNom;
        const nomCommande = isVente
            ? `${ventePrefix}Copie | ${nomBase}`
            : `Copie | ${nomBase}`;
        const payload = {
            nom_commande: nomCommande,
            deadline: undefined,
            coordonnees_contact: {
                nom: commande.client?.nom ?? undefined,
                prenom: commande.client?.prénom ?? undefined,
                telephone: commande.client?.téléphone ?? undefined,
                mail: commande.client?.mail ?? undefined,
                adresse: commande.client?.adresse ?? undefined,
                societe: commande.client?.société ?? undefined,
                tva: commande.client?.tva ?? undefined,
            },
            description_projet: commande.description ?? undefined,
            dimensions_souhaitees: isVente ? undefined : (support?.dimensions ?? undefined),
            couleur: isVente ? undefined : (personnalisation?.couleur ?? undefined),
            support: isVente ? undefined : (support?.nom_support ?? undefined),
            police_ecriture: isVente ? undefined : (personnalisation?.police ?? undefined),
            texte_personnalisation: isVente ? undefined : (personnalisation?.texte ?? undefined),
            quantité: commande.quantité ?? 1,
            payé: false,
            commentaire_paye: undefined,
            attente_reponse: false,
            mode_contact: commande.mode_contact ?? undefined,
            statut_initial: isVente ? enum_1.StatutCommande.TERMINE : enum_1.StatutCommande.EN_ATTENTE_INFORMATION,
            supports: supports,
            lignes_prix: isVente ? undefined : this.toLignesPrixDto(commande.lignes_prix),
            id_client: commande.client?.id_client ?? undefined,
            forcer_nouveau_client: commande.client ? undefined : true,
            prix_final: isVente ? (commande.prix_final ?? undefined) : undefined,
            prix_unitaire_final: isVente ? (commande.prix_unitaire_final ?? undefined) : undefined,
            frais_pourcentage: isVente ? (commande.frais_pourcentage ?? undefined) : undefined,
            frais_commission_id: isVente ? (commande.frais_commission_id ?? undefined) : undefined,
            frais_commission_libelle: isVente ? (commande.frais_commission_libelle ?? undefined) : undefined,
        };
        const nouvelleCommande = await this.ajouterCommande(payload);
        await this.updateCommande(nouvelleCommande.id_commande, {
            prix_final: commande.prix_final ?? null,
            prix_unitaire_final: commande.prix_unitaire_final ?? null,
            frais_pourcentage: commande.frais_pourcentage ?? null,
            frais_commission_id: commande.frais_commission_id ?? null,
            frais_commission_libelle: commande.frais_commission_libelle ?? null,
            quantite_realisee: 0,
            quantite_produit_compteurs: null,
        });
        await this.commandeFichierService.duplicateForCommande(idCommande, nouvelleCommande.id_commande);
        return this.getCommandeById(nouvelleCommande.id_commande);
    }
    async updateCommande(idCommande, payload) {
        if (payload?.revision_base) {
            const actuelle = await this.getCommandeById(idCommande);
            if (actuelle.revision !== payload.revision_base) {
                throw new common_1.ConflictException({
                    code: 'COMMANDE_VERSION_PERIMEE',
                    data: { revision: actuelle.revision },
                    result: false,
                });
            }
        }
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client', 'supports']
        });
        if (!commande) {
            throw new Error('Commande non trouvée');
        }
        if (payload.produit !== undefined)
            commande.produit = payload.produit;
        if (payload.deadline !== undefined)
            commande.deadline = payload.deadline ? new Date(payload.deadline) : null;
        if (payload.date_commande !== undefined)
            commande.date_commande = payload.date_commande ? new Date(payload.date_commande) : commande.date_commande;
        if (payload.description !== undefined)
            commande.description = payload.description;
        if (payload.quantité !== undefined)
            commande.quantité = payload.quantité;
        if (payload.quantite_realisee !== undefined)
            commande.quantite_realisee = payload.quantite_realisee !== null ? parseInt(String(payload.quantite_realisee), 10) : 0;
        if (payload.quantite_produit_compteurs !== undefined) {
            if (payload.quantite_produit_compteurs === null) {
                commande.quantite_produit_compteurs = null;
            }
            else {
                commande.quantite_produit_compteurs = this.normalizeQuantiteProduitCompteursForStorage(payload.quantite_produit_compteurs);
            }
        }
        if (payload.payé !== undefined)
            commande.payé = payload.payé;
        if (payload.commentaire_paye !== undefined)
            commande.commentaire_paye = payload.commentaire_paye?.trim() || null;
        if (payload.attente_reponse !== undefined)
            commande.attente_reponse = payload.attente_reponse;
        if (payload.mode_contact !== undefined)
            commande.mode_contact = payload.mode_contact || null;
        if (payload.source_web !== undefined)
            commande.source_web = Boolean(payload.source_web);
        if (payload.site_traitee !== undefined)
            commande.site_traitee = Boolean(payload.site_traitee);
        if (payload.prix_final !== undefined)
            commande.prix_final = payload.prix_final !== null ? Number(payload.prix_final) : null;
        if (payload.prix_unitaire_final !== undefined)
            commande.prix_unitaire_final = payload.prix_unitaire_final !== null ? Number(payload.prix_unitaire_final) : null;
        if (payload.frais_pourcentage !== undefined) {
            const value = payload.frais_pourcentage;
            commande.frais_pourcentage = value !== null && value !== undefined ? Number(value) : null;
        }
        if (payload.frais_commission_id !== undefined) {
            commande.frais_commission_id = payload.frais_commission_id?.trim() || null;
        }
        if (payload.frais_commission_libelle !== undefined) {
            commande.frais_commission_libelle = payload.frais_commission_libelle?.trim() || null;
        }
        if (payload.id_client && payload.id_client !== commande.client?.id_client) {
            const nouveauClient = await this.clientRepository.findOne({ where: { id_client: payload.id_client } });
            if (!nouveauClient) {
                throw new common_1.NotFoundException('Client introuvable');
            }
            commande.client = nouveauClient;
        }
        if (payload.coordonnees_contact && commande.client) {
            let client = commande.client;
            if (payload.nouvelle_fiche_client === true) {
                client = this.copierFicheClient(client);
                commande.client = client;
            }
            if (payload.coordonnees_contact.nom !== undefined)
                client.nom = payload.coordonnees_contact.nom?.trim() || null;
            if (payload.coordonnees_contact.prenom !== undefined)
                client.prénom = payload.coordonnees_contact.prenom?.trim() || null;
            if (payload.coordonnees_contact.telephone !== undefined) {
                client.téléphone = (0, format_telephone_util_1.formatTelephoneBE)(payload.coordonnees_contact.telephone);
            }
            if (payload.coordonnees_contact.mail !== undefined)
                client.mail = payload.coordonnees_contact.mail?.trim() || null;
            if (payload.coordonnees_contact.societe !== undefined)
                client.société = payload.coordonnees_contact.societe?.trim() || null;
            if (payload.coordonnees_contact.adresse !== undefined)
                client.adresse = payload.coordonnees_contact.adresse?.trim() || null;
            if (payload.coordonnees_contact.tva !== undefined)
                client.tva = payload.coordonnees_contact.tva?.trim() || null;
            await this.clientRepository.save(client);
        }
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } }
        });
        if (gravure) {
            if (payload.support) {
                let support = await this.supportRepository.findOne({
                    where: { gravure: { id_gravure: gravure.id_gravure } }
                });
                if (!support) {
                    support = new entity_1.Support();
                    support.id_support = (0, ulid_1.ulid)();
                    support.gravure = gravure;
                }
                if (payload.support.nom_support !== undefined)
                    support.nom_support = payload.support.nom_support;
                if (payload.support.prix_support !== undefined)
                    support.prix_support = payload.support.prix_support;
                if (payload.support.url_support !== undefined)
                    support.url_support = payload.support.url_support;
                if (payload.gravure?.dimensions !== undefined)
                    support.dimensions = payload.gravure.dimensions;
                await this.supportRepository.save(support);
            }
            if (payload.personnalisation) {
                let personnalisation = await this.personnalisationRepository.findOne({
                    where: { gravure: { id_gravure: gravure.id_gravure } }
                });
                if (!personnalisation) {
                    personnalisation = new entity_1.Personnalisation();
                    personnalisation.id_personnalisation = (0, ulid_1.ulid)();
                    personnalisation.texte = '';
                    personnalisation.gravure = gravure;
                }
                if (payload.personnalisation.texte !== undefined)
                    personnalisation.texte = payload.personnalisation.texte;
                if (payload.personnalisation.police !== undefined)
                    personnalisation.police = payload.personnalisation.police;
                if (payload.personnalisation.couleur !== undefined)
                    personnalisation.couleur = payload.personnalisation.couleur;
                await this.personnalisationRepository.save(personnalisation);
            }
        }
        const commandeUpdated = await this.commandeRepository.save(commande);
        if (payload.supports !== undefined) {
            await this.commandeSupportRepository.delete({ commande: { id_commande: idCommande } });
            if (Array.isArray(payload.supports) && payload.supports.length > 0) {
                const supportsToCreate = payload.supports.map((supportData) => {
                    const commandeSupport = new entity_1.CommandeSupport();
                    commandeSupport.id_commande_support = (0, ulid_1.ulid)();
                    commandeSupport.commande = commandeUpdated;
                    commandeSupport.nom_support = supportData.nom_support || null;
                    commandeSupport.prix_support = supportData.prix_support !== null && supportData.prix_support !== undefined && supportData.prix_support !== '' ? Number(supportData.prix_support) : null;
                    commandeSupport.url_support = supportData.url_support || null;
                    commandeSupport.prix_unitaire = supportData.prix_unitaire !== undefined ? Boolean(supportData.prix_unitaire) : true;
                    commandeSupport.nombre_unites = supportData.nombre_unites !== null && supportData.nombre_unites !== undefined && supportData.nombre_unites !== '' ? parseInt(String(supportData.nombre_unites), 10) : null;
                    commandeSupport.prix_support_unitaire = supportData.prix_support_unitaire !== null && supportData.prix_support_unitaire !== undefined && supportData.prix_support_unitaire !== '' ? Number(supportData.prix_support_unitaire) : null;
                    commandeSupport.actif = supportData.actif !== undefined ? Boolean(supportData.actif) : true;
                    commandeSupport.id_ligne_prix = this.normalizeLignePrixId(supportData.id_ligne_prix);
                    return commandeSupport;
                });
                await this.commandeSupportRepository.save(supportsToCreate);
            }
        }
        await this.replaceLignesPrix(commandeUpdated, payload.lignes_prix);
        const commandeReloaded = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client']
        });
        if (!commandeReloaded) {
            return commandeUpdated;
        }
        const supportsReloaded = await this.commandeSupportRepository.find({
            where: { commande: { id_commande: idCommande } }
        });
        commandeReloaded.supports = supportsReloaded;
        const lignesPrixReloaded = await this.commandeLignePrixRepository.find({
            where: { commande: { id_commande: idCommande } }
        });
        commandeReloaded.lignes_prix = lignesPrixReloaded;
        const gravureReloaded = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } },
            relations: ['commande']
        });
        let support = null;
        let personnalisation = null;
        if (gravureReloaded) {
            support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravureReloaded.id_gravure } }
            });
            personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravureReloaded.id_gravure } }
            });
        }
        const supports = commandeReloaded.supports ? commandeReloaded.supports.map((cs) => ({
            nom_support: cs.nom_support,
            prix_support: cs.prix_support,
            url_support: cs.url_support,
            prix_unitaire: cs.prix_unitaire,
            nombre_unites: cs.nombre_unites,
            prix_support_unitaire: cs.prix_support_unitaire,
            actif: cs.actif !== undefined ? cs.actif : true,
            id_ligne_prix: cs.id_ligne_prix
        })) : [];
        return {
            id_commande: commandeReloaded.id_commande,
            date_commande: commandeReloaded.date_commande,
            deadline: commandeReloaded.deadline,
            produit: commandeReloaded.produit,
            description: commandeReloaded.description,
            fichiers_joints: commandeReloaded.fichiers_joints,
            CGV_acceptée: commandeReloaded.CGV_acceptée,
            newsletter_acceptée: commandeReloaded.newsletter_acceptée,
            statut_commande: commandeReloaded.statut_commande,
            statuts_actifs: commandeReloaded.statuts_actifs,
            prix_final: commandeReloaded.prix_final,
            prix_unitaire_final: commandeReloaded.prix_unitaire_final,
            frais_pourcentage: commandeReloaded.frais_pourcentage,
            frais_commission_id: commandeReloaded.frais_commission_id,
            frais_commission_libelle: commandeReloaded.frais_commission_libelle,
            quantité: commandeReloaded.quantité,
            quantite_realisee: commandeReloaded.quantite_realisee ?? 0,
            quantite_produit_compteurs: this.parseQuantiteProduitCompteursJson(commandeReloaded.quantite_produit_compteurs),
            payé: commandeReloaded.payé,
            commentaire_paye: commandeReloaded.commentaire_paye,
            attente_reponse: commandeReloaded.attente_reponse,
            mode_contact: commandeReloaded.mode_contact,
            source_web: Boolean(commandeReloaded.source_web),
            site_traitee: Boolean(commandeReloaded.site_traitee),
            client: commandeReloaded.client,
            lignes_prix: this.toLignesPrixDto(commandeReloaded.lignes_prix),
            supports: supports,
            support: support ? {
                nom_support: support.nom_support,
                prix_support: support.prix_support,
                url_support: support.url_support,
                dimensions: support.dimensions
            } : null,
            personnalisation: personnalisation ? {
                texte: personnalisation.texte,
                police: personnalisation.police,
                couleur: personnalisation.couleur
            } : null,
            gravure: gravureReloaded ? {
                dimensions: support ? support.dimensions : null
            } : null
        };
    }
    async updateStatutCommande(idCommande, nouveauStatut) {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande }
        });
        if (!commande) {
            throw new Error('Commande non trouvée');
        }
        const statutActuel = commande.statut_commande;
        let statutsActifs = commande.statuts_actifs || [];
        if (nouveauStatut === enum_1.StatutCommande.ANNULEE) {
            commande.statut_commande = enum_1.StatutCommande.ANNULEE;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        if (statutActuel === 'annulee' && nouveauStatut !== 'annulee') {
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        const ordreEtapes = [
            enum_1.StatutCommande.EN_ATTENTE_INFORMATION,
            enum_1.StatutCommande.A_MODELLISER_PREPARER,
            enum_1.StatutCommande.A_GRAVER,
            enum_1.StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
            enum_1.StatutCommande.A_PRENDRE_EN_PHOTO,
        ];
        const statutsFinaux = [enum_1.StatutCommande.A_LIVRER, enum_1.StatutCommande.A_METTRE_EN_LIGNE, enum_1.StatutCommande.A_FACTURER, enum_1.StatutCommande.DEMANDE_AVIS];
        if (nouveauStatut === enum_1.StatutCommande.A_PRENDRE_EN_PHOTO && statutsActifs.length > 0) {
            commande.statut_commande = enum_1.StatutCommande.A_PRENDRE_EN_PHOTO;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        if (statutsFinaux.includes(nouveauStatut)) {
            if (statutsActifs.includes(nouveauStatut)) {
                statutsActifs = statutsActifs.filter(s => s !== nouveauStatut);
                const tousCompletes = statutsActifs.length === 0 ||
                    statutsFinaux.every(statut => !statutsActifs.includes(statut));
                if (tousCompletes) {
                    commande.statut_commande = enum_1.StatutCommande.TERMINE;
                    commande.statuts_actifs = null;
                }
                else {
                    commande.statuts_actifs = statutsActifs.length > 0 ? statutsActifs : null;
                }
            }
            else {
                if (!statutsActifs || statutsActifs.length === 0) {
                    statutsActifs = [nouveauStatut];
                }
                else {
                    if (!statutsActifs.includes(nouveauStatut)) {
                        statutsActifs.push(nouveauStatut);
                    }
                }
                commande.statuts_actifs = statutsActifs;
                if (commande.statut_commande === enum_1.StatutCommande.TERMINE) {
                    commande.statut_commande = enum_1.StatutCommande.A_PRENDRE_EN_PHOTO;
                }
            }
            return await this.commandeRepository.save(commande);
        }
        if (statutActuel === enum_1.StatutCommande.A_PRENDRE_EN_PHOTO && nouveauStatut === enum_1.StatutCommande.A_PRENDRE_EN_PHOTO) {
            commande.statuts_actifs = [
                enum_1.StatutCommande.A_LIVRER,
                enum_1.StatutCommande.A_METTRE_EN_LIGNE,
                enum_1.StatutCommande.A_FACTURER,
                enum_1.StatutCommande.DEMANDE_AVIS
            ];
            return await this.commandeRepository.save(commande);
        }
        const indexActuel = ordreEtapes.indexOf(statutActuel);
        const indexNouveau = ordreEtapes.indexOf(nouveauStatut);
        if (statutActuel === enum_1.StatutCommande.TERMINE && indexNouveau !== -1) {
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        if (statutsActifs.length > 0 && indexNouveau !== -1) {
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        if (indexNouveau !== -1 && indexActuel !== -1 && indexNouveau < indexActuel) {
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        const transitions = {
            [enum_1.StatutCommande.EN_ATTENTE_INFORMATION]: enum_1.StatutCommande.A_MODELLISER_PREPARER,
            [enum_1.StatutCommande.A_MODELLISER_PREPARER]: enum_1.StatutCommande.A_GRAVER,
            [enum_1.StatutCommande.A_GRAVER]: enum_1.StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
            [enum_1.StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: enum_1.StatutCommande.A_PRENDRE_EN_PHOTO,
            [enum_1.StatutCommande.A_PRENDRE_EN_PHOTO]: null,
            [enum_1.StatutCommande.A_LIVRER]: null,
            [enum_1.StatutCommande.A_METTRE_EN_LIGNE]: null,
            [enum_1.StatutCommande.A_FACTURER]: null,
            [enum_1.StatutCommande.DEMANDE_AVIS]: null,
            [enum_1.StatutCommande.TERMINE]: null,
            [enum_1.StatutCommande.ANNULEE]: null,
        };
        if (statutActuel === nouveauStatut && transitions[statutActuel] !== null) {
            commande.statut_commande = transitions[statutActuel];
            commande.statuts_actifs = null;
        }
        else if (nouveauStatut !== statutActuel && !statutsFinaux.includes(nouveauStatut)) {
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
        }
        return await this.commandeRepository.save(commande);
    }
    async deleteCommande(idCommande) {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client']
        });
        if (!commande) {
            throw new Error('Commande non trouvée');
        }
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } }
        });
        if (gravure) {
            const support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
            if (support) {
                await this.supportRepository.remove(support);
            }
            const personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
            if (personnalisation) {
                await this.personnalisationRepository.remove(personnalisation);
            }
            await this.gravureRepository.remove(gravure);
        }
        await this.commandeFichierService.deleteAllByCommande(idCommande);
        await this.commandeRepository.remove(commande);
    }
    toLignesPrixDto(lignes) {
        return (lignes ?? []).map((ligne) => ({
            id: ligne.id_commande_ligne_prix,
            remise: !!ligne.remise,
            remise_pourcentage: !!ligne.remise_pourcentage,
            nom: ligne.nom,
            quantite: ligne.quantite !== null && ligne.quantite !== undefined ? Number(ligne.quantite) : null,
            prix_unitaire: ligne.prix_unitaire !== null && ligne.prix_unitaire !== undefined ? Number(ligne.prix_unitaire) : null,
            prix_final: ligne.prix_final !== null && ligne.prix_final !== undefined ? Number(ligne.prix_final) : null,
        }));
    }
    async replaceLignesPrix(commande, lignes) {
        if (lignes === undefined) {
            return;
        }
        await this.commandeLignePrixRepository.delete({ commande: { id_commande: commande.id_commande } });
        if (!Array.isArray(lignes) || lignes.length === 0) {
            return;
        }
        const lignesToCreate = lignes.map((ligneData) => {
            const ligne = new entity_1.CommandeLignePrix();
            ligne.id_commande_ligne_prix = this.resolveLignePrixId(ligneData?.id);
            ligne.commande = commande;
            ligne.remise = ligneData?.remise === true;
            ligne.remise_pourcentage = ligne.remise && ligneData?.remise_pourcentage === true;
            ligne.nom = ligneData?.nom?.trim() || null;
            const quantite = ligneData?.quantite;
            ligne.quantite = quantite !== null && quantite !== undefined && quantite !== ''
                ? parseInt(String(quantite), 10)
                : null;
            const prixUnitaire = ligneData?.prix_unitaire;
            ligne.prix_unitaire = prixUnitaire !== null && prixUnitaire !== undefined && prixUnitaire !== ''
                ? Number(prixUnitaire)
                : null;
            const prixFinal = ligneData?.prix_final;
            ligne.prix_final = prixFinal !== null && prixFinal !== undefined && prixFinal !== ''
                ? Number(prixFinal)
                : null;
            if (ligne.remise) {
                ligne.quantite = null;
                if (!ligne.remise_pourcentage) {
                    ligne.prix_unitaire = null;
                }
            }
            return ligne;
        });
        await this.commandeLignePrixRepository.save(lignesToCreate);
    }
    resolveLignePrixId(raw) {
        const value = typeof raw === 'string' ? raw.trim() : '';
        return /^[0-9A-Za-z]{26}$/.test(value) ? value : (0, ulid_1.ulid)();
    }
    normalizeLignePrixId(raw) {
        const value = typeof raw === 'string' ? raw.trim() : '';
        return /^[0-9A-Za-z]{26}$/.test(value) ? value : null;
    }
};
exports.CommandeService = CommandeService;
exports.CommandeService = CommandeService = CommandeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entity_1.Commande)),
    __param(1, (0, typeorm_1.InjectRepository)(entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(entity_1.Gravure)),
    __param(3, (0, typeorm_1.InjectRepository)(entity_1.Personnalisation)),
    __param(4, (0, typeorm_1.InjectRepository)(entity_1.Support)),
    __param(5, (0, typeorm_1.InjectRepository)(entity_1.CommandeSupport)),
    __param(6, (0, typeorm_1.InjectRepository)(entity_1.CommandeLignePrix)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        commande_fichier_service_1.CommandeFichierService])
], CommandeService);
//# sourceMappingURL=commande.service.js.map