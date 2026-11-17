import { RealtimeService } from "../../../common/realtime";
import { ClientService } from '../service/client.service';
import { AjouterClientPayload, FusionnerClientsPayload, ModifierClientPayload } from '../model/payload';
export declare class ClientController {
    private readonly clientService;
    private readonly realtime;
    constructor(clientService: ClientService, realtime: RealtimeService);
    getAllClients(): Promise<import("../service/client.service").ClientAvecStats[]>;
    rechercherClients(query?: string, limit?: string): Promise<import("../service/client.service").ClientAvecStats[]>;
    trouverCorrespondances(nom?: string, prenom?: string, mail?: string, telephone?: string, societe?: string): Promise<(import("../model/entity").Client & {
        stats: import("../service/client.service").StatsClient;
    } & {
        raisons: string[];
    })[]>;
    getDoublons(): Promise<import("../service/client.service").ClientAvecStats[][]>;
    ajouterClient(payload: AjouterClientPayload, origin?: string): Promise<import("../model/entity").Client>;
    fusionnerClients(payload: FusionnerClientsPayload, origin?: string): Promise<import("../model/entity").Client & {
        stats: import("../service/client.service").StatsClient;
    } & {
        commandes: import("../service/client.service").CommandeResume[];
    }>;
    getClientById(id: string): Promise<import("../model/entity").Client & {
        stats: import("../service/client.service").StatsClient;
    } & {
        commandes: import("../service/client.service").CommandeResume[];
    }>;
    modifierClient(id: string, payload: ModifierClientPayload, origin?: string): Promise<import("../model/entity").Client>;
    supprimerClient(id: string, origin?: string): Promise<{
        success: boolean;
    }>;
}
