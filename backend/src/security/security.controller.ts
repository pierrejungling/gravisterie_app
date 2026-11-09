import {Body, Controller, Get, Post} from '@nestjs/common';
import {ApiBearerAuth, ApiTags} from '@nestjs/swagger';
import {Public} from '@common/config/metadata/public.metadata';
import {User} from '@common/config/metadata/user.metadata';
import {RefreshTokenPayload, SignInPayload, Credential} from './model';
import {SecurityService} from './service';

@ApiBearerAuth('access-token')
@ApiTags('Account')
@Controller('account')
export class SecurityController {

    constructor(private readonly service: SecurityService) {
    }

    @Public()
    @Post('signin') // ACCOUNT_SIGNIN_SUCCESS
    public signIn(@Body() payload: SignInPayload) {
        // Utilise le même endpoint pour tous les utilisateurs (admin ou non)
        return this.service.signIn(payload, false);
    }

    // Pas de création ni de suppression de compte via l'API :
    // l'app n'a qu'un compte admin, géré directement en base.

    @Public()
    @Post('refresh') // ACCOUNT_REFRESH_SUCCESS
    public refresh(@Body() payload: RefreshTokenPayload) {
        return this.service.refresh(payload);
    }

    @Get('me') // ACCOUNT_ME_SUCCESS
    public me(@User() user: Credential) {
        return user;
    }
}