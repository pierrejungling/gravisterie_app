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
                await this.repository.delete({credential});
                const payload = {sub: credential.credential_id};
                const token = await this.jwtService.signAsync(payload, {
                    secret: configManager.getValue(ConfigKey.JWT_TOKEN_SECRET),
                    expiresIn: configManager.getValue(ConfigKey.JWT_TOKEN_EXPIRE_IN) as string
                });
                const refreshToken = await this.jwtService.signAsync(payload, {
                    secret: configManager.getValue(ConfigKey.JWT_REFRESH_TOKEN_SECRET),
                    expiresIn: configManager.getValue(ConfigKey.JWT_REFRESH_TOKEN_EXPIRE_IN) as string
                });
                
                
                const tokenEntity = new Token();
                tokenEntity.token_id = ulid();
                tokenEntity.token = token;
                tokenEntity.refreshToken = refreshToken;
                tokenEntity.credential = credential;
                
                await this.repository.upsert(
                    tokenEntity,
                    ['credential']
                );
                
                const savedToken = await this.repository.findOneBy({token: token});
                if (!savedToken) {
                    throw new TokenGenerationException();
                }
                return savedToken;
            } catch (e) {
                this.logger.error(e.message);
                throw new TokenGenerationException();
            }
        }

        async deleteForCredential(credential: Credential): Promise<void> {
            await this.repository.delete({credential});
        }

        async refresh(payload: RefreshTokenPayload): Promise<Token> {
            try {
                const id = this.jwtService.verify(payload.refresh, {secret:
                configManager.getValue(ConfigKey.JWT_REFRESH_TOKEN_SECRET)}).sub;
                const credential = await this.credentialRepository.findOneBy({credential_id: id});
                if (!credential) {
                    throw new TokenExpiredException();
                }
                return await this.getTokens(credential);
            } catch (e) {
                this.logger.error(e.message);
                throw new TokenExpiredException();
            }
        }
}
