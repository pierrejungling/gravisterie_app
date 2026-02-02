import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Credential, Token, SignInPayload, SignupPayload, RefreshTokenPayload } from '../model';
import { TokenService } from '../jwt';
import { UserNotFoundException, UserAlreadyExistException, SignupException, CredentialDeleteException } from '../security.exception';
import { encryptPassword, comparePassword } from '../utils';

@Injectable()
export class SecurityService {
    
    constructor(@InjectRepository(Credential) private readonly repository: Repository<Credential>,
        private readonly tokenService: TokenService) {
    }
    
    async detail(id: string): Promise<Credential> {
        const result = await this.repository.findOneBy({credential_id: id});
        if (result !== null && result !== undefined) {
            return result;
        }
        throw new UserNotFoundException();
    }
    
    async signIn(payload: SignInPayload, isAdmin: boolean): Promise<Token | null> {
        let result: Credential | null = null;
        if (payload.socialLogin) {
            if (payload.facebookHash !== null && payload.facebookHash !== undefined && payload.facebookHash.length > 0) {
                result = await this.repository.findOneBy({facebookHash: payload.facebookHash});
            } else if (payload.googleHash !== null && payload.googleHash !== undefined && payload.googleHash.length > 0) {
                result = await this.repository.findOneBy({googleHash: payload.googleHash});
            }
        } else {
            // Recherche par username uniquement (pas de filtre isAdmin pour simplifier)
            result = await this.repository.findOneBy({username: payload.username});
        }
        if (result !== null && result !== undefined && (payload.socialLogin || await comparePassword(payload.password, result.password))) {
            return this.tokenService.getTokens(result);
        }
        throw new UserNotFoundException();
    }
    
    async signup(payload: SignupPayload): Promise<Credential | null> {
        // Vérifier si le username existe déjà
        const existingUsername: Credential | null = await this.repository.findOneBy({username: payload.username});
        if (existingUsername !== null && existingUsername !== undefined) {
            throw new UserAlreadyExistException();
        }
        
        // Vérifier si l'email existe déjà
        const existingEmail: Credential | null = await this.repository.findOneBy({mail: payload.mail});
        if (existingEmail !== null && existingEmail !== undefined) {
            throw new UserAlreadyExistException();
        }
        
        try {
            const encryptedPassword = (payload.facebookHash.length === 0 && payload.googleHash.length === 0)
                ? await encryptPassword(payload.password)
                : "";
            
            const credential = new Credential();
            credential.username = payload.username;
            credential.password = encryptedPassword;
            credential.facebookHash = payload.facebookHash || '';
            credential.googleHash = payload.googleHash || '';
            credential.mail = payload.mail;
            
            return await this.repository.save(credential);
        } catch (e) {
            console.error('Erreur lors de l\'inscription:', e);
            // Si c'est une erreur de contrainte unique, c'est que l'utilisateur existe déjà
            if (e && typeof e === 'object' && 'code' in e) {
                const errorCode = (e as any).code;
                if (errorCode === '23505') { // PostgreSQL unique constraint violation
                    throw new UserAlreadyExistException();
                }
            }
            throw new SignupException();
        }
    }
    
    async refresh(payload: RefreshTokenPayload): Promise<Token> {
        return this.tokenService.refresh(payload);
    }
    
    async delete(id: string): Promise<void> {
        try {
            const detail = await this.detail(id);
            await this.tokenService.deleteForCredential(detail);
            await this.repository.remove(detail);
        } catch (e) {
            throw new CredentialDeleteException();
        }
    }
}
