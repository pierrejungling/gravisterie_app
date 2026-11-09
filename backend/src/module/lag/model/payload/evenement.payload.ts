import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ElementMateriel, FormuleEvenement, StatutEvenement, TypeEvenement } from '../entity/evenement.entity';

export const TYPES_EVENEMENT: TypeEvenement[] = ['gravure_direct', 'nocturne', 'salon', 'marche', 'atelier', 'autre'];
export const STATUTS_EVENEMENT: StatutEvenement[] = ['prospect', 'propose', 'confirme', 'termine', 'annule', 'refuse'];
export const FORMULES_EVENEMENT: FormuleEvenement[] = ['a_definir', 'illimite', 'a_la_gravure', 'stand'];

/** Création ou modification d'un événement (champs absents = inchangés). */
export class EvenementPayload {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) nom?: string;
    @ApiProperty({ required: false, enum: TYPES_EVENEMENT }) @IsOptional() @IsIn(TYPES_EVENEMENT) type?: TypeEvenement;
    @ApiProperty({ required: false, enum: STATUTS_EVENEMENT }) @IsOptional() @IsIn(STATUTS_EVENEMENT) statut?: StatutEvenement;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() date_debut?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() date_fin?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() @MaxLength(40) heure_arrivee?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() @MaxLength(200) lieu?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() adresse?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() @MaxLength(150) contact_nom?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() @MaxLength(60) contact_telephone?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() @MaxLength(200) contact_mail?: string | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() id_client?: string | null;
    @ApiProperty({ required: false, enum: FORMULES_EVENEMENT }) @IsOptional() @IsIn(FORMULES_EVENEMENT) formule?: FormuleEvenement;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() prix_forfait?: number | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() prix_gravure?: number | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() nb_gravures?: number | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() heures_sur_place?: number | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() heures_trajet?: number | null;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() forfait_carburant?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() paye?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsArray() materiel?: ElementMateriel[];
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() notes?: string | null;
}

export class LierCommandeEvenementPayload {
    @ApiProperty() @IsNotEmpty() @IsString() id_commande: string;
}
