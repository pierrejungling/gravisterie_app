import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService } from './service';
import { CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission, ApercuLien])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService, ApercuLienService],
    controllers: [CommandeController, BonController, FraisCommissionController, WebhookController, ClientController, ApercuLienController],
    exports: [CommandeService, BonService, FraisCommissionService, ClientService]
})
export class LagModule {}
