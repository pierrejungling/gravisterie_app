import { Body, Controller, Headers, Post, UnauthorizedException, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
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
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(AnyFilesInterceptor({
        limits: {
            fileSize: 50 * 1024 * 1024, // 50 Mo par fichier
            files: 30,
        },
    }))
    async createFromWebhook(
        @Headers('x-webhook-secret') secret: string | undefined,
        @Body() dto: CreateOrderFromWebhookDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        const expectedSecret = process.env.WEBHOOK_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            throw new UnauthorizedException('Webhook secret invalide');
        }
        return await this.commandeService.creerCommandeDepuisWebhook(dto, files ?? []);
    }
}
