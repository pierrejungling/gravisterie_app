import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {JwtModule} from '@nestjs/jwt';
import { JwtGuard } from './jwt/jwt.guard';
import {configManager} from '@common/config';
import {ConfigKey} from '@common/config/enum';
import {Credential, Token} from './model';
import {TokenService} from './jwt';
import {SecurityService} from './service';
import {SecurityController} from './security.controller';

@Module({
    imports: [JwtModule.register({
        global: true,
        secret: configManager.getValue(ConfigKey.JWT_TOKEN_SECRET),
        signOptions: {expiresIn: configManager.getValue(ConfigKey.JWT_TOKEN_EXPIRE_IN) as string},
        
        }), TypeOrmModule.forFeature([Credential, Token])],
    exports: [SecurityService, JwtGuard],
    providers: [TokenService, SecurityService, JwtGuard],
    controllers: [SecurityController]
})
export class SecurityModule {}