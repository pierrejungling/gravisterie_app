import { Repository } from 'typeorm';
import { ApercuLien } from '../model/entity';
export interface Apercu {
    url: string;
    image: string | null;
    titre: string | null;
    site: string | null;
    manuel: boolean;
}
export declare class ApercuLienService {
    private readonly repo;
    private readonly logger;
    private readonly enCours;
    constructor(repo: Repository<ApercuLien>);
    getApercu(brut: string, forcer?: boolean): Promise<Apercu>;
    setImage(brut: string, image: string | null | undefined): Promise<Apercu>;
    private charger;
    private lire;
    private meta;
    private lienImage;
    private titrePage;
    private imageAmazon;
    private absolue;
    private decoder;
    private verifierHote;
    private privee;
    private normaliser;
    private cle;
    private site;
    private vers;
}
