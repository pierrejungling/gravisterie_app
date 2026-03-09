import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeFichier, Bon } from './model/entity';
import { CommandeService, R2Service, CommandeFichierService, BonService } from './service';
import { CommandeController, BonController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeFichier, Bon])
    ],
    providers: [CommandeService, R2Service, CommandeFichierService, BonService],
    controllers: [CommandeController, BonController],
    exports: [CommandeService, BonService]
})
export class LagModule {}
