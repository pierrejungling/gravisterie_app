import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService } from './service';
import { CommandeController, BonController, FraisCommissionController, WebhookController, ClientController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix, CommandeFichier, Bon, FraisCommission])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService, ClientService],
    controllers: [CommandeController, BonController, FraisCommissionController, WebhookController, ClientController],
    exports: [CommandeService, BonService, FraisCommissionService, ClientService]
})
export class LagModule {}
