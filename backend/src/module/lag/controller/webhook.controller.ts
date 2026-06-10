import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/config/metadata/public.metadata';
import { CommandeService } from '../service/commande.service';
import { CreateOrderFromWebhookDto } from '../model/payload';

@ApiTags('Webhook')
@Controller('orders')
export class WebhookController {
    constructor(private readonly commandeService: CommandeService) {}

    @Public()
    @Post('webhook')
    @ApiOperation({ summary: 'Créer une commande depuis un formulaire du site vitrine (send-order.php / send-mail.php)' })
    @ApiHeader({ name: 'x-webhook-secret', description: 'Secret partagé avec le site vitrine', required: true })
    async createFromWebhook(
        @Headers('x-webhook-secret') secret: string | undefined,
        @Body() dto: CreateOrderFromWebhookDto,
    ) {
        const expectedSecret = process.env.WEBHOOK_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            throw new UnauthorizedException('Webhook secret invalide');
        }
        return await this.commandeService.creerCommandeDepuisWebhook(dto);
    }
}
