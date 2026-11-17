import { StreamableFile } from '@nestjs/common';
import { RealtimeService } from "../../../common/realtime";
import { CommandeService } from '../service/commande.service';
import { CommandeFichierService } from '../service/commande-fichier.service';
import { AjouterCommandePayload, UpdateStatutPayload } from '../model/payload';
export declare class CommandeController {
    private readonly commandeService;
    private readonly commandeFichierService;
    private readonly realtime;
    constructor(commandeService: CommandeService, commandeFichierService: CommandeFichierService, realtime: RealtimeService);
    ajouterCommande(payload: AjouterCommandePayload, origin?: string): Promise<import("../model/entity").Commande>;
    getAllCommandes(): Promise<import("../model/entity").Commande[]>;
    rechercherCommandes(query?: string, limit?: string): Promise<import("../model/entity").Commande[]>;
    updateStatut(payload: UpdateStatutPayload, origin?: string): Promise<import("../model/entity").Commande>;
    listFichiers(idCommande: string): Promise<import("../model/entity").CommandeFichier[]>;
    uploadFichier(idCommande: string, file: Express.Multer.File, origin?: string): Promise<import("../model/entity").CommandeFichier>;
    downloadFichier(idCommande: string, idFichier: string): Promise<StreamableFile>;
    deleteFichier(idCommande: string, idFichier: string, origin?: string): Promise<{
        success: boolean;
    }>;
    getCommandeById(id: string): Promise<any>;
    updateCommande(id: string, payload: any, origin?: string): Promise<any>;
    deleteCommande(id: string, origin?: string): Promise<void>;
    dupliquerCommande(id: string, origin?: string): Promise<any>;
}
