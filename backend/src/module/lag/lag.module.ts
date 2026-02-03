import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport } from './model/entity';
import { CommandeService } from './service';
import { CommandeController } from './controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Commande, Client, Gravure, Personnalisation, Support, CommandeSupport])
    ],
    providers: [CommandeService],
    controllers: [CommandeController],
    exports: [CommandeService]
})
export class LagModule {}
