import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsEmail, IsArray, IsDateString, IsString, Length, IsInt, Min, IsBoolean } from 'class-validator';
import { Couleur } from '../../entity/enum';

export class CoordonneesContactPayload {
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
    @Length(0, 30)
    telephone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    mail?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(0, 50)
    societe?: string;

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
}

export class AjouterCommandePayload {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    @Length(1, 100)
    nom_commande: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    deadline?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    date_commande?: string;

    @ApiProperty({ type: () => CoordonneesContactPayload, required: false })
    @IsOptional()
    coordonnees_contact?: CoordonneesContactPayload;

    @ApiProperty()
    @IsOptional()
    @IsString()
    description_projet?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    dimensions_souhaitees?: string;

    @ApiProperty({ type: [String], enum: Couleur })
    @IsOptional()
    @IsArray()
    couleur?: Couleur[];

    @ApiProperty()
    @IsOptional()
    @IsString()
    support?: string; // Par défaut: "CP 3,6mm Méranti"

    @ApiProperty()
    @IsOptional()
    @IsString()
    police_ecriture?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    texte_personnalisation?: string;

    @ApiProperty({ type: [String] })
    @IsOptional()
    @IsArray()
    fichiers_joints?: string[]; // URLs ou chemins des fichiers

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    quantité?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    payé?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    commentaire_paye?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    statut_initial?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    attente_reponse?: boolean; // false = client attend réponse, true = moi qui attends réponse

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    mode_contact?: string; // 'mail', 'tel', ou 'meta'

    @ApiProperty({ required: false })
    @IsOptional()
    prix_final?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    prix_unitaire_final?: number;

    @ApiProperty({ required: false, type: [Object] })
    @IsOptional()
    @IsArray()
    supports?: Array<{
        nom_support?: string;
        prix_support?: number;
        url_support?: string;
        prix_unitaire?: boolean;
        nombre_unites?: number;
        prix_support_unitaire?: number;
    }>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    forcer_nouveau_client?: boolean;
}
