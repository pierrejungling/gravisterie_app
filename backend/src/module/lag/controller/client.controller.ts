import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RealtimeService } from '@common/realtime';
import { ClientService } from '../service/client.service';
import { AjouterClientPayload, FusionnerClientsPayload, ModifierClientPayload } from '../model/payload';

@ApiBearerAuth('access-token')
@ApiTags('Client')
@Controller('client')
export class ClientController {
    constructor(
        private readonly clientService: ClientService,
        private readonly realtime: RealtimeService,
    ) {}

    @Get('liste')
    @ApiOperation({ summary: 'Tous les clients avec leurs chiffres' })
    async getAllClients() {
        return await this.clientService.getAllClients();
    }

    @Get('recherche')
    @ApiOperation({ summary: 'Rechercher un client (nom, société, mail, téléphone)' })
    async rechercherClients(@Query('q') query?: string, @Query('limit') limit?: string) {
        const parsedLimit = Math.min(Math.max(parseInt(limit || '8', 10) || 8, 1), 50);
        return await this.clientService.rechercherClients(query || '', parsedLimit);
    }

    @Get('correspondances')
    @ApiOperation({ summary: 'Fiches existantes qui correspondent à des coordonnées saisies' })
    async trouverCorrespondances(
        @Query('nom') nom?: string,
        @Query('prenom') prenom?: string,
        @Query('mail') mail?: string,
        @Query('telephone') telephone?: string,
        @Query('societe') societe?: string,
    ) {
        return await this.clientService.trouverCorrespondances({ nom, prenom, mail, telephone, societe });
    }

    @Get('doublons')
    @ApiOperation({ summary: 'Fiches clients probablement en double' })
    async getDoublons() {
        return await this.clientService.getDoublons();
    }

    @Post('ajouter')
    @ApiOperation({ summary: 'Créer une fiche client' })
    async ajouterClient(@Body() payload: AjouterClientPayload, @Headers('x-client-id') origin?: string) {
        const client = await this.clientService.ajouterClient(payload);
        this.realtime.publish({ resource: 'client', action: 'created', id: client.id_client, origin });
        return client;
    }

    @Post('fusionner')
    @ApiOperation({ summary: 'Fusionner des fiches clients (les commandes passent sur la fiche cible)' })
    async fusionnerClients(@Body() payload: FusionnerClientsPayload, @Headers('x-client-id') origin?: string) {
        const client = await this.clientService.fusionnerClients(payload.id_client_cible, payload.ids_clients_sources);
        this.realtime.publish({ resource: 'client', action: 'updated', id: payload.id_client_cible, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', origin });
        return client;
    }

    @Get(':id')
    @ApiOperation({ summary: 'Fiche client avec historique des commandes' })
    async getClientById(@Param('id') id: string) {
        return await this.clientService.getClientById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Modifier une fiche client' })
    async modifierClient(
        @Param('id') id: string,
        @Body() payload: ModifierClientPayload,
        @Headers('x-client-id') origin?: string,
    ) {
        const client = await this.clientService.modifierClient(id, payload);
        this.realtime.publish({ resource: 'client', action: 'updated', id, origin });
        this.realtime.publish({ resource: 'commande', action: 'updated', origin });
        return client;
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer une fiche client sans commande' })
    async supprimerClient(@Param('id') id: string, @Headers('x-client-id') origin?: string) {
        await this.clientService.supprimerClient(id);
        this.realtime.publish({ resource: 'client', action: 'deleted', id, origin });
        return { success: true };
    }
}
