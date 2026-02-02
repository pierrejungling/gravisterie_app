import {Body, Controller, Delete, Get, Param, Post} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam} from '@nestjs/swagger';
import {Public} from '@common/config/metadata/public.metadata';
import {User} from '@common/config/metadata/user.metadata';
import {RefreshTokenPayload, SignInPayload, SignupPayload, Credential} from './model';
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

    @Public()
    @Post('signup') // ACCOUNT_SIGNUP_SUCCESS
    public signUp(@Body() payload: SignupPayload) {
        return this.service.signup(payload);
    }

    @Public()
    @Post('refresh') // ACCOUNT_REFRESH_SUCCESS
    public refresh(@Body() payload: RefreshTokenPayload) {
        return this.service.refresh(payload);
    }

    @Get('me') // ACCOUNT_ME_SUCCESS
    public me(@User() user: Credential) {
        return user;
    }
    
    @Delete('delete/:id') // ACCOUNT_DELETE_SUCCESS
    public delete(@Param('id') id: string) {
        return this.service.delete(id);
    }
}