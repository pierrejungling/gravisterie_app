import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, IsDateString, IsIn, IsNumber, Min } from 'class-validator';

const DUREES_VALIDES = ['1M', '2M', '3M', '6M', '1Y', 'LIFE'];

export class AjouterBonPayload {
    @ApiProperty({ description: 'Numéro du bon (ex: BG001)' })
    @IsNotEmpty()
    @IsString()
    @Length(1, 20)
    numero: string;

    @ApiProperty({ description: 'Intitulé du bon (personne, événement, foire, etc.)' })
    @IsNotEmpty()
    @IsString()
    @Length(1, 200)
    intitule: string;

    @ApiProperty({ description: 'Date de création (ISO yyyy-MM-dd)' })
    @IsNotEmpty()
    @IsDateString()
    date_creation: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 50)
    nom?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 50)
    prenom?: string | null;

    @ApiProperty({ required: false, enum: DUREES_VALIDES })
    @IsOptional()
    @IsString()
    @IsIn(DUREES_VALIDES)
    duree_validite?: string | null;

    @ApiProperty({ required: false, description: 'Date d\'échéance manuelle (ISO yyyy-MM-dd)' })
    @IsOptional()
    @IsDateString()
    date_echeance?: string | null;

    @ApiProperty({ required: false, description: 'Valeur du bon en euros' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    valeur?: number | null;
}
