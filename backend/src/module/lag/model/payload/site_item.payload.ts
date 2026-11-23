import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SiteItemPayload {
    @ApiProperty({ enum: ['produit', 'projet'], required: false })
    @IsOptional()
    @IsIn(['produit', 'projet'])
    type?: 'produit' | 'projet';

    @ApiProperty({ required: false, description: 'Identifiant dans les URLs. Généré depuis le nom si absent.' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    slug?: string;

    @ApiProperty({ required: false, description: 'Id de la collection (pour créer un modèle dans une collection)' })
    @IsOptional()
    @IsString()
    parent_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    nom?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    ordre?: number;

    @ApiProperty({ required: false, description: "Version (date_maj) de la fiche que l'utilisateur a modifiée : refusé si elle a changé depuis" })
    @IsOptional()
    @IsString()
    base?: string;

    @ApiProperty({ required: false, description: 'Champs libres (price, description, keywords, features, material...)' })
    @IsOptional()
    @IsObject()
    donnees?: Record<string, any>;
}

export class SiteOrdrePayload {
    @ApiProperty({ type: [String], description: 'Ids dans le nouvel ordre' })
    @IsArray()
    @IsString({ each: true })
    ids: string[];
}

export class SiteImagesPayload {
    @ApiProperty({ type: [String], description: 'Clés des images dans le nouvel ordre (retirer une clé la supprime)' })
    @IsArray()
    @IsString({ each: true })
    images: string[];
}
