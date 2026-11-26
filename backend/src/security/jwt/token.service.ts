import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {JwtService} from '@nestjs/jwt';
import {configManager} from '@common/config';
import {ConfigKey} from '@common/config/enum';
import {Credential, Token, RefreshTokenPayload} from '../model';
import {TokenGenerationException, TokenExpiredException} from '../security.exception';
import {ulid} from 'ulid';

@Injectable()
export class TokenService {
    private readonly logger = new Logger(TokenService.name);

    constructor(@InjectRepository(Token) private readonly repository: Repository<Token>,
            @InjectRepository(Credential) private readonly credentialRepository: Repository<Credential>,
            private jwtService: JwtService) {
        }

        async getTokens(credential: Credential): Promise<Token> {
            try {
                const payload = {sub: credential.credential_id};
                const tokenOptions: any = {
                    secret: configManager.getValue(ConfigKey.JWT_TOKEN_SECRET),
                    expiresIn: configManager.getValue(ConfigKey.JWT_TOKEN_EXPIRE_IN)
                };
                const refreshTokenOptions: any = {
                    secret: configManager.getValue(ConfigKey.JWT_REFRESH_TOKEN_SECRET),
                    expiresIn: configManager.getValue(ConfigKey.JWT_REFRESH_TOKEN_EXPIRE_IN)
                };
                const token = await this.jwtService.signAsync(payload, tokenOptions);
                const refreshToken = await this.jwtService.signAsync(payload, refreshTokenOptions);
                
                
                const tokenEntity = new Token();
                tokenEntity.token_id = ulid();
                tokenEntity.token = token;
                tokenEntity.refreshToken = refreshToken;
                tokenEntity.credential = credential;
                
                await this.repository.upsert(
                    tokenEntity,
                    ['credential']
                );
                
                // On renvoie directement le token généré : relire en base par valeur échouait
                // quand deux rafraîchissements se croisaient (autre onglet, téléphone), ce qui déconnectait.
                return tokenEntity;
            } catch (e) {
                this.logger.error(e.message);
                throw new TokenGenerationException();
            }
        }

        async refresh(payload: RefreshTokenPayload): Promise<Token> {
            let id: string;
            try {
                id = this.jwtService.verify(payload.refresh, {secret:
                configManager.getValue(ConfigKey.JWT_REFRESH_TOKEN_SECRET)}).sub;
            } catch (e) {
                // Refresh token invalide ou expiré : seul cas où il faut vraiment se reconnecter (401).
                this.logger.error(e.message);
                throw new TokenExpiredException();
            }
            // Toute autre erreur (base indisponible, redéploiement...) ne doit PAS déconnecter : elle remonte en 500.
            const credential = await this.credentialRepository.findOneBy({credential_id: id});
            if (!credential) {
                throw new TokenExpiredException();
            }
            return await this.getTokens(credential);
        }
}
