import { Repository } from 'typeorm';
import { CommandeFichier } from '../model/entity/commande_fichier.entity';
import { Commande } from '../model/entity/commande.entity';
import { R2Service } from './r2.service';
export declare class CommandeFichierService {
    private readonly fichierRepository;
    private readonly commandeRepository;
    private readonly r2Service;
    constructor(fichierRepository: Repository<CommandeFichier>, commandeRepository: Repository<Commande>, r2Service: R2Service);
    listByCommande(idCommande: string): Promise<CommandeFichier[]>;
    upload(idCommande: string, file: Express.Multer.File): Promise<CommandeFichier>;
    getStream(idCommande: string, idFichier: string): Promise<{
        stream: import('stream').Readable;
        contentType?: string;
        nomFichier: string;
    }>;
    delete(idCommande: string, idFichier: string): Promise<void>;
    deleteAllByCommande(idCommande: string): Promise<void>;
    duplicateForCommande(sourceCommandeId: string, targetCommandeId: string): Promise<void>;
    private streamToBuffer;
}
