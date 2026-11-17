import { ReseauxService } from '../service/reseaux.service';
export declare class ReseauxController {
    private readonly reseauxService;
    constructor(reseauxService: ReseauxService);
    getAbonnes(): Promise<import("../service/reseaux.service").AbonnesResultat>;
}
