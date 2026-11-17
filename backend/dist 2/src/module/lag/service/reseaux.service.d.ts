export interface AbonnesCompte {
    nom: string;
    facebook: number | null;
    instagram: {
        username: string;
        abonnes: number;
    } | null;
}
export interface AbonnesResultat {
    comptes: AbonnesCompte[];
    mis_a_jour: string;
}
export declare class ReseauxService {
    private readonly logger;
    private cache;
    private lireConfig;
    getAbonnes(): Promise<AbonnesResultat>;
    private lirePage;
}
