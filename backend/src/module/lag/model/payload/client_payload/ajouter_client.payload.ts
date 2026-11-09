import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

/** Création d'une fiche client (au moins un nom, un prénom ou une société). */
export class AjouterClientPayload {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 50)
    nom?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 50)
    prenom?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 50)
    societe?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
    @IsEmail()
    @Length(0, 50)
    mail?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 30)
    telephone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 100)
    adresse?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 20)
    tva?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}
