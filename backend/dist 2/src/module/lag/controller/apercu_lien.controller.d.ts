import { ApercuLienService } from '../service/apercu_lien.service';
import { ImageApercuLienPayload } from '../model/payload/apercu_lien.payload';
export declare class ApercuLienController {
    private readonly apercuService;
    constructor(apercuService: ApercuLienService);
    getApercu(url: string, forcer?: string): Promise<import("../service/apercu_lien.service").Apercu>;
    setImage(payload: ImageApercuLienPayload): Promise<import("../service/apercu_lien.service").Apercu>;
}
