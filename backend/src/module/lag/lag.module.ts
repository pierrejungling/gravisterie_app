import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeFichier, Bon, FraisCommission } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService } from './service';
import { CommandeController, BonController, FraisCommissionController, WebhookController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeFichier, Bon, FraisCommission])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService, FraisCommissionService],
    controllers: [CommandeController, BonController, FraisCommissionController, WebhookController],
    exports: [CommandeService, BonService, FraisCommissionService]
})
export class LagModule {}
