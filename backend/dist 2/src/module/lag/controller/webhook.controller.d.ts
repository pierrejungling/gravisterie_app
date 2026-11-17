import { RealtimeService } from "../../../common/realtime";
import { CommandeService } from '../service/commande.service';
import { CreateOrderFromWebhookDto } from '../model/payload';
export declare class WebhookController {
    private readonly commandeService;
    private readonly realtime;
    constructor(commandeService: CommandeService, realtime: RealtimeService);
    createFromWebhook(secret: string | undefined, dto: CreateOrderFromWebhookDto, files: Express.Multer.File[]): Promise<import("../model/entity").Commande>;
}
