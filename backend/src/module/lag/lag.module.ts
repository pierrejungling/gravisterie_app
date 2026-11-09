import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien, Evenement } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService, EvenementService } from './service';
import { CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController, EvenementController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien, Evenement])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService, EvenementService],
    controllers: [CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController, EvenementController],
    exports: [CommandeService, BonService, FraisCommissionService, ClientService]
})
export class LagModule {}
