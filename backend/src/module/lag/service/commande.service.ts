import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport } from '../model/entity';
import { AjouterCommandePayload } from '../model/payload';
import { StatutCommande } from '../model/entity/enum';
import { ulid } from 'ulid';
import { CommandeFichierService } from './commande-fichier.service';

@Injectable()
export class CommandeService {
    constructor(
        @InjectRepository(Commande) private readonly commandeRepository: Repository<Commande>,
        @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
        @InjectRepository(Gravure) private readonly gravureRepository: Repository<Gravure>,
        @InjectRepository(Personnalisation) private readonly personnalisationRepository: Repository<Personnalisation>,
        @InjectRepository(Support) private readonly supportRepository: Repository<Support>,
        @InjectRepository(CommandeSupport) private readonly commandeSupportRepository: Repository<CommandeSupport>,
        private readonly commandeFichierService: CommandeFichierService,
    ) {}

    async ajouterCommande(payload: AjouterCommandePayload): Promise<Commande> {
        // Créer ou récupérer le client
        let client: Client | null = null;
        
        // Chercher un client existant seulement si un email est fourni
        if (payload.coordonnees_contact?.mail && payload.coordonnees_contact.mail.trim()) {
            client = await this.clientRepository.findOne({
                where: { mail: payload.coordonnees_contact.mail.trim() }
            });
        }

        if (!client) {
            // Générer un ID unique manuellement
            const clientId = ulid();
            const mailValue = payload.coordonnees_contact?.mail?.trim() || null;
            const telephoneValue = payload.coordonnees_contact?.telephone?.trim() || null;
            const societeValue = payload.coordonnees_contact?.societe?.trim() || null;
            
            // Vérifier si un client avec cet email existe déjà (seulement si un email est fourni)
            let existingClient: Client | null = null;
            if (mailValue) {
                existingClient = await this.clientRepository.findOne({
                    where: { mail: mailValue }
                });
            }
            
            if (!existingClient) {
                client = new Client();
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
                } catch (error: any) {
                    // Si erreur de duplication de clé, essayer de récupérer le client existant
                    if (error.code === '23505' && error.constraint === 'PK_83f4571a0e37e3822fff36d6b8a') {
                        // L'ID existe déjà, générer un nouveau et réessayer
                        client.id_client = ulid();
                        client = await this.clientRepository.save(client);
                    } else {
                        throw error;
                    }
                }
            } else {
                client = existingClient;
            }
        } else {
            // Mettre à jour les informations du client si elles ont changé
            if (payload.coordonnees_contact?.nom !== undefined) {
                client.nom = payload.coordonnees_contact.nom?.trim() || null;
            }
            if (payload.coordonnees_contact?.prenom !== undefined) {
                client.prénom = payload.coordonnees_contact.prenom?.trim() || null;
            }
            if (payload.coordonnees_contact?.telephone !== undefined) {
                client.téléphone = payload.coordonnees_contact.telephone?.trim() || null;
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

        // Créer la commande
        const commande = new Commande();
        commande.id_commande = ulid(); // Générer l'ID manuellement
        commande.produit = payload.nom_commande;
        commande.deadline = payload.deadline ? new Date(payload.deadline) : null;
        commande.date_commande = payload.date_commande ? new Date(payload.date_commande) : new Date();
        commande.description = payload.description_projet ?? null;
        commande.quantité = payload.quantité ?? 1;
        commande.payé = payload.payé ?? false;
        commande.commentaire_paye = payload.commentaire_paye?.trim() || null;
        commande.attente_reponse = payload.attente_reponse ?? false; // Par défaut false = client attend réponse (rouge)
        commande.mode_contact = payload.mode_contact || null;
        commande.fichiers_joints = payload.fichiers_joints && payload.fichiers_joints.length > 0 ? payload.fichiers_joints.join(',') : null;
        
        // Gérer le statut initial
        const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
        const ordreEtapes: StatutCommande[] = [
            StatutCommande.EN_ATTENTE_INFORMATION,
            StatutCommande.A_MODELLISER_PREPARER,
            StatutCommande.A_GRAVER,
            StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
            StatutCommande.A_PRENDRE_EN_PHOTO,
        ];
        
        if (payload.statut_initial && payload.statut_initial.trim()) {
            const statutInitial = payload.statut_initial as StatutCommande;
            
            // Si un statut final est sélectionné, créer la duplication dans les 4 colonnes
            if (statutsFinaux.includes(statutInitial)) {
                // Cas spécial : statut final sélectionné -> duplication dans les 4 colonnes
                commande.statut_commande = StatutCommande.A_PRENDRE_EN_PHOTO;
                commande.statuts_actifs = statutsFinaux;
            } else {
                // Cas normal : utiliser le statut sélectionné comme statut principal
                // Les statuts précédents sont automatiquement validés (pas besoin de les stocker)
                commande.statut_commande = statutInitial;
                commande.statuts_actifs = null;
            }
        } else {
            // Par défaut : En Attente de + d'infos
            commande.statut_commande = StatutCommande.EN_ATTENTE_INFORMATION;
            commande.statuts_actifs = null;
        }
        commande.client = client;
        commande.CGV_acceptée = false;
        commande.newsletter_acceptée = false;

        let commandeSauvegardee: Commande;
        try {
            commandeSauvegardee = await this.commandeRepository.save(commande);
        } catch (error: any) {
            // Si erreur de duplication de clé, générer un nouvel ID et réessayer
            if (error.code === '23505' && error.constraint === 'PK_dc8b0018d21d1d1563e04643da9') {
                commande.id_commande = ulid();
                commandeSauvegardee = await this.commandeRepository.save(commande);
            } else {
                throw error;
            }
        }

        // Créer la gravure associée
        const gravure = new Gravure();
        gravure.id_gravure = ulid(); // Générer l'ID manuellement
        gravure.date_gravure = new Date();
        gravure.commande = commandeSauvegardee;
        let gravureSauvegardee: Gravure;
        try {
            gravureSauvegardee = await this.gravureRepository.save(gravure);
        } catch (error: any) {
            if (error.code === '23505') {
                gravure.id_gravure = ulid();
                gravureSauvegardee = await this.gravureRepository.save(gravure);
            } else {
                throw error;
            }
        }

        // Créer le support
        const support = new Support();
        support.id_support = ulid(); // Générer l'ID manuellement
        support.nom_support = payload.support || 'CP 3,6mm Méranti';
        support.dimensions = payload.dimensions_souhaitees ?? null;
        support.gravure = gravureSauvegardee;
        try {
            await this.supportRepository.save(support);
        } catch (error: any) {
            if (error.code === '23505') {
                support.id_support = ulid();
                await this.supportRepository.save(support);
            } else {
                throw error;
            }
        }

        // Créer la personnalisation
        const personnalisation = new Personnalisation();
        personnalisation.id_personnalisation = ulid(); // Générer l'ID manuellement
        // Le texte est obligatoire dans l'entité, donc on utilise une valeur par défaut si vide
        personnalisation.texte = payload.texte_personnalisation || '';
        personnalisation.police = payload.police_ecriture ?? null;
        // Convertir le tableau de couleurs en format simple-array pour TypeORM
        personnalisation.couleur = payload.couleur && payload.couleur.length > 0 ? payload.couleur : null;
        personnalisation.gravure = gravureSauvegardee;
        try {
            await this.personnalisationRepository.save(personnalisation);
        } catch (error: any) {
            if (error.code === '23505') {
                personnalisation.id_personnalisation = ulid();
                await this.personnalisationRepository.save(personnalisation);
            } else {
                throw error;
            }
        }

        // Créer les supports multiples de la commande si fournis
        if (payload.supports && Array.isArray(payload.supports) && payload.supports.length > 0) {
            const supportsToCreate = payload.supports.map((supportData: any) => {
                const commandeSupport = new CommandeSupport();
                commandeSupport.id_commande_support = ulid();
                commandeSupport.commande = commandeSauvegardee;
                commandeSupport.nom_support = supportData.nom_support || null;
                commandeSupport.prix_support = supportData.prix_support || null;
                commandeSupport.url_support = supportData.url_support || null;
                commandeSupport.prix_unitaire = supportData.prix_unitaire !== undefined ? supportData.prix_unitaire : true;
                commandeSupport.nombre_unites = supportData.nombre_unites || null;
                commandeSupport.prix_support_unitaire = supportData.prix_support_unitaire || null;
                return commandeSupport;
            });
            await this.commandeSupportRepository.save(supportsToCreate);
        }

        return commandeSauvegardee;
    }

    async getAllCommandes(): Promise<Commande[]> {
        return await this.commandeRepository.find({
            relations: ['client', 'supports'],
            order: {
                date_commande: 'DESC'
            }
        });
    }

    async getCommandeById(idCommande: string): Promise<any> {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client', 'supports']
        });

        if (!commande) {
            throw new Error('Commande non trouvée');
        }

        // Récupérer la gravure associée avec ses relations
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } },
            relations: ['commande']
        });

        let support: Support | null = null;
        let personnalisation: Personnalisation | null = null;

        if (gravure) {
            support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });

            personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
        }

        // Convertir les supports de la commande en format attendu par le frontend
        const supports = commande.supports ? commande.supports.map((cs: CommandeSupport) => ({
            nom_support: cs.nom_support,
            prix_support: cs.prix_support,
            url_support: cs.url_support,
            prix_unitaire: cs.prix_unitaire,
            nombre_unites: cs.nombre_unites,
            prix_support_unitaire: cs.prix_support_unitaire
        })) : [];

        // Retourner un objet avec les propriétés explicitement listées pour éviter les conflits de type
        return {
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
            quantité: commande.quantité,
            quantite_realisee: commande.quantite_realisee ?? 0,
            payé: commande.payé,
            commentaire_paye: commande.commentaire_paye,
            attente_reponse: commande.attente_reponse,
            mode_contact: commande.mode_contact,
            client: commande.client,
            supports: supports as any,
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
        } as any;
    }

    async dupliquerCommande(idCommande: string): Promise<any> {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client', 'supports']
        });

        if (!commande) {
            throw new Error('Commande non trouvée');
        }

        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } },
            relations: ['commande']
        });

        let support: Support | null = null;
        let personnalisation: Personnalisation | null = null;

        if (gravure) {
            support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });

            personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
        }

        const supports = commande.supports ? commande.supports.map((cs: CommandeSupport) => ({
            nom_support: cs.nom_support,
            prix_support: cs.prix_support,
            url_support: cs.url_support,
            prix_unitaire: cs.prix_unitaire,
            nombre_unites: cs.nombre_unites,
            prix_support_unitaire: cs.prix_support_unitaire
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
        const payload: AjouterCommandePayload = {
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
            statut_initial: isVente ? StatutCommande.TERMINE : StatutCommande.EN_ATTENTE_INFORMATION,
            supports: supports as any,
        };

        const nouvelleCommande = await this.ajouterCommande(payload);

        await this.updateCommande(nouvelleCommande.id_commande, {
            prix_final: commande.prix_final ?? null,
            prix_unitaire_final: commande.prix_unitaire_final ?? null,
            quantite_realisee: 0,
        });

        await this.commandeFichierService.duplicateForCommande(idCommande, nouvelleCommande.id_commande);

        return this.getCommandeById(nouvelleCommande.id_commande);
    }

    async updateCommande(idCommande: string, payload: any): Promise<any> {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client', 'supports']
        });

        if (!commande) {
            throw new Error('Commande non trouvée');
        }

        // Mettre à jour les champs de la commande
        if (payload.produit !== undefined) commande.produit = payload.produit;
        if (payload.deadline !== undefined) commande.deadline = payload.deadline ? new Date(payload.deadline) : null;
        if (payload.date_commande !== undefined) commande.date_commande = payload.date_commande ? new Date(payload.date_commande) : commande.date_commande;
        if (payload.description !== undefined) commande.description = payload.description;
        if (payload.quantité !== undefined) commande.quantité = payload.quantité;
        if (payload.quantite_realisee !== undefined) commande.quantite_realisee = payload.quantite_realisee !== null ? parseInt(String(payload.quantite_realisee), 10) : 0;
        if (payload.payé !== undefined) commande.payé = payload.payé;
        if (payload.commentaire_paye !== undefined) commande.commentaire_paye = payload.commentaire_paye?.trim() || null;
        if (payload.attente_reponse !== undefined) commande.attente_reponse = payload.attente_reponse;
        if (payload.mode_contact !== undefined) commande.mode_contact = payload.mode_contact || null;
        if (payload.prix_final !== undefined) commande.prix_final = payload.prix_final !== null ? Number(payload.prix_final) : null;
        if (payload.prix_unitaire_final !== undefined) commande.prix_unitaire_final = payload.prix_unitaire_final !== null ? Number(payload.prix_unitaire_final) : null;

        // Mettre à jour les coordonnées du client si fournies
        if (payload.coordonnees_contact) {
            const client = commande.client;
            if (payload.coordonnees_contact.nom !== undefined) client.nom = payload.coordonnees_contact.nom?.trim() || null;
            if (payload.coordonnees_contact.prenom !== undefined) client.prénom = payload.coordonnees_contact.prenom?.trim() || null;
            if (payload.coordonnees_contact.telephone !== undefined) client.téléphone = payload.coordonnees_contact.telephone?.trim() || null;
            if (payload.coordonnees_contact.mail !== undefined) client.mail = payload.coordonnees_contact.mail?.trim() || null;
            if (payload.coordonnees_contact.societe !== undefined) client.société = payload.coordonnees_contact.societe?.trim() || null;
            if (payload.coordonnees_contact.adresse !== undefined) client.adresse = payload.coordonnees_contact.adresse?.trim() || null;
            if (payload.coordonnees_contact.tva !== undefined) client.tva = payload.coordonnees_contact.tva?.trim() || null;
            await this.clientRepository.save(client);
        }

        // Récupérer la gravure associée
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } }
        });

        if (gravure) {
            // Mettre à jour le support
            if (payload.support) {
                let support = await this.supportRepository.findOne({
                    where: { gravure: { id_gravure: gravure.id_gravure } }
                });

                if (!support) {
                    support = new Support();
                    support.id_support = ulid();
                    support.gravure = gravure;
                }

                if (payload.support.nom_support !== undefined) support.nom_support = payload.support.nom_support;
                if (payload.support.prix_support !== undefined) support.prix_support = payload.support.prix_support;
                if (payload.support.url_support !== undefined) support.url_support = payload.support.url_support;
                if (payload.gravure?.dimensions !== undefined) support.dimensions = payload.gravure.dimensions;

                await this.supportRepository.save(support);
            }

            // Mettre à jour la personnalisation
            if (payload.personnalisation) {
                let personnalisation = await this.personnalisationRepository.findOne({
                    where: { gravure: { id_gravure: gravure.id_gravure } }
                });

                if (!personnalisation) {
                    personnalisation = new Personnalisation();
                    personnalisation.id_personnalisation = ulid();
                    personnalisation.texte = '';
                    personnalisation.gravure = gravure;
                }

                if (payload.personnalisation.texte !== undefined) personnalisation.texte = payload.personnalisation.texte;
                if (payload.personnalisation.police !== undefined) personnalisation.police = payload.personnalisation.police;
                if (payload.personnalisation.couleur !== undefined) personnalisation.couleur = payload.personnalisation.couleur;

                await this.personnalisationRepository.save(personnalisation);
            }
        }

        // Sauvegarder d'abord la commande pour s'assurer qu'elle existe en DB
        const commandeUpdated = await this.commandeRepository.save(commande);

        // Gérer les supports multiples de la commande
        if (payload.supports !== undefined) {
            // Supprimer les anciens supports
            await this.commandeSupportRepository.delete({ commande: { id_commande: idCommande } });

            // Créer les nouveaux supports (même si le tableau est vide, on supprime tout)
            if (Array.isArray(payload.supports) && payload.supports.length > 0) {
                const supportsToCreate = payload.supports.map((supportData: any) => {
                    // Créer l'entité manuellement pour avoir un contrôle total sur la relation
                    const commandeSupport = new CommandeSupport();
                    commandeSupport.id_commande_support = ulid();
                    // Assigner directement l'entité commande sauvegardée
                    commandeSupport.commande = commandeUpdated;
                    commandeSupport.nom_support = supportData.nom_support || null;
                    commandeSupport.prix_support = supportData.prix_support !== null && supportData.prix_support !== undefined && supportData.prix_support !== '' ? Number(supportData.prix_support) : null;
                    commandeSupport.url_support = supportData.url_support || null;
                    commandeSupport.prix_unitaire = supportData.prix_unitaire !== undefined ? Boolean(supportData.prix_unitaire) : true;
                    commandeSupport.nombre_unites = supportData.nombre_unites !== null && supportData.nombre_unites !== undefined && supportData.nombre_unites !== '' ? parseInt(String(supportData.nombre_unites), 10) : null;
                    commandeSupport.prix_support_unitaire = supportData.prix_support_unitaire !== null && supportData.prix_support_unitaire !== undefined && supportData.prix_support_unitaire !== '' ? Number(supportData.prix_support_unitaire) : null;
                    return commandeSupport;
                });
                await this.commandeSupportRepository.save(supportsToCreate);
            }
        }
        
        // Recharger avec les relations pour retourner le format complet
        // Utiliser une requête séparée pour forcer le rechargement des supports
        const commandeReloaded = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client']
        });

        if (!commandeReloaded) {
            return commandeUpdated;
        }

        // Charger les supports séparément pour éviter les problèmes de cache
        const supportsReloaded = await this.commandeSupportRepository.find({
            where: { commande: { id_commande: idCommande } }
        });
        commandeReloaded.supports = supportsReloaded;

        // Retourner le même format que getCommandeById pour cohérence
        const gravureReloaded = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } },
            relations: ['commande']
        });

        let support: Support | null = null;
        let personnalisation: Personnalisation | null = null;

        if (gravureReloaded) {
            support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravureReloaded.id_gravure } }
            });

            personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravureReloaded.id_gravure } }
            });
        }

        // Convertir les supports de la commande en format attendu par le frontend
        const supports = commandeReloaded.supports ? commandeReloaded.supports.map((cs: CommandeSupport) => ({
            nom_support: cs.nom_support,
            prix_support: cs.prix_support,
            url_support: cs.url_support,
            prix_unitaire: cs.prix_unitaire,
            nombre_unites: cs.nombre_unites,
            prix_support_unitaire: cs.prix_support_unitaire
        })) : [];

        // Retourner un objet avec les propriétés explicitement listées pour éviter les conflits de type
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
            quantité: commandeReloaded.quantité,
            quantite_realisee: commandeReloaded.quantite_realisee ?? 0,
            payé: commandeReloaded.payé,
            commentaire_paye: commandeReloaded.commentaire_paye,
            attente_reponse: commandeReloaded.attente_reponse,
            mode_contact: commandeReloaded.mode_contact,
            client: commandeReloaded.client,
            supports: supports as any,
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
        } as any;
    }

    async updateStatutCommande(idCommande: string, nouveauStatut: StatutCommande): Promise<Commande> {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande }
        });

        if (!commande) {
            throw new Error('Commande non trouvée');
        }

        const statutActuel = commande.statut_commande;
        let statutsActifs = commande.statuts_actifs || [];

        // Gestion du statut ANNULEE
        if (nouveauStatut === StatutCommande.ANNULEE) {
            commande.statut_commande = StatutCommande.ANNULEE;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }

        // Si on décoche ANNULEE (retour à un autre statut)
        // Utiliser une comparaison de string pour éviter l'erreur TypeScript
        if (statutActuel === 'annulee' && nouveauStatut as string !== 'annulee') {
            commande.statut_commande = nouveauStatut as any;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }

        // Ordre des étapes dans le workflow
        const ordreEtapes: StatutCommande[] = [
            StatutCommande.EN_ATTENTE_INFORMATION,
            StatutCommande.A_MODELLISER_PREPARER,
            StatutCommande.A_GRAVER,
            StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
            StatutCommande.A_PRENDRE_EN_PHOTO,
        ];

        // Si on demande un retour à "À Prendre en photo" depuis les colonnes finales
        const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
        if (nouveauStatut === StatutCommande.A_PRENDRE_EN_PHOTO && statutsActifs.length > 0) {
            // Retour à "À Prendre en photo" : supprimer tous les statuts_actifs
            commande.statut_commande = StatutCommande.A_PRENDRE_EN_PHOTO;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }

        // Si on coche/décoche un des 4 statuts finaux
        if (statutsFinaux.includes(nouveauStatut)) {
            // Si le statut est dans statuts_actifs, on le coche (le compléter)
            if (statutsActifs.includes(nouveauStatut)) {
                // Retirer ce statut de la liste (la commande est complétée pour ce statut)
                statutsActifs = statutsActifs.filter(s => s !== nouveauStatut);
                
                // Si tous les 4 statuts finaux sont complétés (statutsActifs est vide), passer à TERMINE
                const tousCompletes = statutsActifs.length === 0 || 
                    statutsFinaux.every(statut => !statutsActifs.includes(statut));
                
                if (tousCompletes) {
                    commande.statut_commande = StatutCommande.TERMINE;
                    commande.statuts_actifs = null;
                } else {
                    commande.statuts_actifs = statutsActifs.length > 0 ? statutsActifs : null;
                }
            } else {
                // Le statut n'est pas dans statuts_actifs, donc on le décoche (retour en arrière)
                // Le remettre dans statuts_actifs
                if (!statutsActifs || statutsActifs.length === 0) {
                    // Si aucun statut actif, recréer la liste avec ce statut
                    statutsActifs = [nouveauStatut];
                } else {
                    // Ajouter ce statut à la liste s'il n'y est pas déjà
                    if (!statutsActifs.includes(nouveauStatut)) {
                        statutsActifs.push(nouveauStatut);
                    }
                }
                commande.statuts_actifs = statutsActifs;
                // Si on était à TERMINE, revenir à "À Prendre en photo"
                if (commande.statut_commande === StatutCommande.TERMINE) {
                    commande.statut_commande = StatutCommande.A_PRENDRE_EN_PHOTO;
                }
            }
            return await this.commandeRepository.save(commande);
        }

        // Si on coche dans "À prendre en photo", créer les 4 statuts finaux
        if (statutActuel === StatutCommande.A_PRENDRE_EN_PHOTO && nouveauStatut === StatutCommande.A_PRENDRE_EN_PHOTO) {
            // La commande doit apparaître dans les 4 colonnes simultanément
            commande.statuts_actifs = [
                StatutCommande.A_LIVRER,
                StatutCommande.A_METTRE_EN_LIGNE,
                StatutCommande.A_FACTURER,
                StatutCommande.DEMANDE_AVIS
            ];
            // Le statut principal reste "À prendre en photo"
            return await this.commandeRepository.save(commande);
        }

        // Si on demande un retour en arrière (nouveauStatut est une étape précédente)
        const indexActuel = ordreEtapes.indexOf(statutActuel);
        const indexNouveau = ordreEtapes.indexOf(nouveauStatut);
        
        // Si la commande est terminée et qu'on demande un retour en arrière
        if (statutActuel === StatutCommande.TERMINE && indexNouveau !== -1) {
            // Retour en arrière depuis TERMINE : mettre le statut à l'étape demandée
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        
        // Si la commande est dans les 3 dernières colonnes (a des statuts_actifs), on peut revenir en arrière
        if (statutsActifs.length > 0 && indexNouveau !== -1) {
            // Retour en arrière depuis les colonnes finales : mettre le statut à l'étape demandée
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }
        
        if (indexNouveau !== -1 && indexActuel !== -1 && indexNouveau < indexActuel) {
            // Retour en arrière : mettre le statut à l'étape précédente demandée
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
            return await this.commandeRepository.save(commande);
        }

        // Transitions normales : En attente -> À modéliser -> À graver -> À finir/laver/assembler/peindre -> À prendre en photo
        // Quand on coche dans une colonne, on passe au statut suivant
        const transitions: Record<StatutCommande, StatutCommande | null> = {
            [StatutCommande.EN_ATTENTE_INFORMATION]: StatutCommande.A_MODELLISER_PREPARER,
            [StatutCommande.A_MODELLISER_PREPARER]: StatutCommande.A_GRAVER,
            [StatutCommande.A_GRAVER]: StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
            [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: StatutCommande.A_PRENDRE_EN_PHOTO,
            [StatutCommande.A_PRENDRE_EN_PHOTO]: null, // Géré séparément ci-dessus
            [StatutCommande.A_LIVRER]: null, // Géré ci-dessus
            [StatutCommande.A_METTRE_EN_LIGNE]: null, // Géré ci-dessus
            [StatutCommande.A_FACTURER]: null, // Géré ci-dessus
            [StatutCommande.DEMANDE_AVIS]: null, // Géré ci-dessus
            [StatutCommande.TERMINE]: null,
            [StatutCommande.ANNULEE]: null, // Géré séparément ci-dessus
        };

        // Vérifier que la transition est valide (on coche dans la colonne actuelle)
        if (statutActuel === nouveauStatut && transitions[statutActuel] !== null) {
            // C'est une case à cocher, passer au statut suivant
            commande.statut_commande = transitions[statutActuel]!;
            commande.statuts_actifs = null;
        } else if (nouveauStatut !== statutActuel && !statutsFinaux.includes(nouveauStatut)) {
            // Transition directe vers un autre statut (non géré normalement, mais on l'autorise)
            commande.statut_commande = nouveauStatut;
            commande.statuts_actifs = null;
        }

        return await this.commandeRepository.save(commande);
    }

    async deleteCommande(idCommande: string): Promise<void> {
        const commande = await this.commandeRepository.findOne({
            where: { id_commande: idCommande },
            relations: ['client']
        });

        if (!commande) {
            throw new Error('Commande non trouvée');
        }

        // Trouver la gravure associée à cette commande
        const gravure = await this.gravureRepository.findOne({
            where: { commande: { id_commande: idCommande } }
        });

        if (gravure) {
            // Supprimer le support associé à cette gravure
            const support = await this.supportRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
            if (support) {
                await this.supportRepository.remove(support);
            }

            // Supprimer la personnalisation associée à cette gravure
            const personnalisation = await this.personnalisationRepository.findOne({
                where: { gravure: { id_gravure: gravure.id_gravure } }
            });
            if (personnalisation) {
                await this.personnalisationRepository.remove(personnalisation);
            }

            // Supprimer la gravure
            await this.gravureRepository.remove(gravure);
        }

        // Supprimer les fichiers de la commande (R2 + table commande_fichier)
        await this.commandeFichierService.deleteAllByCommande(idCommande);

        // Supprimer la commande
        await this.commandeRepository.remove(commande);
    }
}
