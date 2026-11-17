import { Repository } from 'typeorm';
import { Bon } from '../model/entity/bon.entity';
import { AjouterBonPayload, ModifierBonPayload } from '../model/payload/bon_payload';
export declare class BonService {
    private readonly bonRepository;
    constructor(bonRepository: Repository<Bon>);
    ajouterBon(payload: AjouterBonPayload): Promise<Bon>;
    getAllBons(): Promise<Bon[]>;
    getBonById(idBon: string): Promise<Bon>;
    getNextNumero(): Promise<string>;
    updateBon(idBon: string, payload: ModifierBonPayload): Promise<Bon>;
    marquerUtilise(idBon: string): Promise<Bon>;
    deleteBon(idBon: string): Promise<void>;
}
