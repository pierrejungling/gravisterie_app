import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien, Evenement, SiteItem } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService, EvenementService, ReseauxService, SiteService, SiteR2Service } from './service';
import { CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController, EvenementController, ReseauxController, SiteController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien, Evenement, SiteItem])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService, EvenementService, ReseauxService, SiteService, SiteR2Service],
    controllers: [CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController, EvenementController, ReseauxController, SiteController],
    exports: [CommandeService, BonService, FraisCommissionService, ClientService]
})
export class LagModule {}
