import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien, Evenement } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService, EvenementService, ReseauxService } from './service';
import { CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController, EvenementController, ReseauxController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien, Evenement])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService, EvenementService, ReseauxService],
    controllers: [CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController, EvenementController, ReseauxController],
    exports: [CommandeService, BonService, FraisCommissionService, ClientService]
})
export class LagModule {}
