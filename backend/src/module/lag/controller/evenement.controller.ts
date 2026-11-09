import { Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RealtimeService } from '@common/realtime';
import { EvenementService } from '../service/evenement.service';
import { EvenementPayload, LierCommandeEvenementPayload } from '../model/payload/evenement.payload';

@ApiBearerAuth('access-token')
@ApiTags('Événement')
@Controller('evenement')
export class EvenementController {
    constructor(
        private readonly evenementService: EvenementService,
        private readonly realtime: RealtimeService,
    ) {}

    @Get('liste')
    @ApiOperation({ summary: 'Tous les événements avec leurs chiffres' })
    async liste() {
        return await this.evenementService.liste();
    }

    @Post()
    @ApiOperation({ summary: 'Créer un événement' })
    async creer(@Body() payload: EvenementPayload, @Headers('x-client-id') origin?: string) {
        const e = await this.evenementService.creer(payload);
        this.realtime.publish({ resource: 'evenement', action: 'created', id: e.id_evenement, origin });
        return e;
    }

    @Get(':id/resume')
    @ApiOperation({ summary: "Nom et date d'un événement" })
    async resume(@Param('id') id: string) {
        return await this.evenementService.resume(id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Événement avec ses commandes liées' })
    async detail(@Param('id') id: string) {
        return await this.evenementService.detail(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Modifier un événement' })
    async modifier(@Param('id') id: string, @Body() payload: EvenementPayload, @Headers('x-client-id') origin?: string) {
        const e = await this.evenementService.modifier(id, payload);
        this.realtime.publish({ resource: 'evenement', action: 'updated', id, origin });
        return e;
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer un événement (les commandes liées sont gardées)' })
    async supprimer(@Param('id') id: string, @Headers('x-client-id') origin?: string) {
        await this.evenementService.supprimer(id);
        this.realtime.publish({ resource: 'evenement', action: 'deleted', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', origin });
        return true;
    }

    @Post(':id/commandes')
    @ApiOperation({ summary: 'Rattacher une commande à un événement' })
    async lier(@Param('id') id: string, @Body() payload: LierCommandeEvenementPayload, @Headers('x-client-id') origin?: string) {
        await this.evenementService.lierCommande(id, payload.id_commande);
        this.realtime.publish({ resource: 'evenement', action: 'updated', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', id: payload.id_commande, origin });
        return true;
    }

    @Delete(':id/commandes/:idCommande')
    @ApiOperation({ summary: "Détacher une commande d'un événement" })
    async delier(@Param('id') id: string, @Param('idCommande') idCommande: string, @Headers('x-client-id') origin?: string) {
        await this.evenementService.delierCommande(id, idCommande);
        this.realtime.publish({ resource: 'evenement', action: 'updated', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', id: idCommande, origin });
        return true;
    }
}
