import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configManager } from '@common/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { AccountModule } from '../feature/account/account.module';
import { SecurityModule } from '../security/security.module';
import { LagModule } from '../module/lag/lag.module';
import { JwtGuard } from '@security/jwt';
import { APP_GUARD } from '@nestjs/core';

@Module({
        imports: [
            TypeOrmModule.forRoot(configManager.getTypeOrmConfig()),
            SecurityModule,
            LagModule,
        ],
        controllers: [AppController, HealthController],
        providers: [AppService, {
            provide: APP_GUARD,
            useClass: JwtGuard
        }],
    })
export class AppModule {}
