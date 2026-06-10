import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Payload du webhook site vitrine (send-mail.php / send-order.php).
 * Envoyé en multipart/form-data : tous les champs arrivent en string,
 * les fichiers sont transmis via le champ "attachments" (multer).
 */
export class CreateOrderFromWebhookDto {
    @ApiProperty({ required: false, description: 'Produit demandé (présent uniquement depuis send-order.php)' })
    @IsOptional()
    @IsString()
    product_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    firstname?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    lastname?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    street?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    postal?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({ required: false, description: 'Remarques supplémentaires / message du client' })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiProperty({ required: false, description: 'Deadline saisie par le client (texte libre, ex: 2026-07-01 ou "Non spécifiée")' })
    @IsOptional()
    @IsString()
    deadline?: string;

    @ApiProperty({ required: false, description: "Newsletter acceptée ('1' ou '0')" })
    @IsOptional()
    @IsString()
    newsletter?: string;

    @ApiProperty({ required: false, description: "CGV acceptées ('1' ou '0')" })
    @IsOptional()
    @IsString()
    terms?: string;
}
