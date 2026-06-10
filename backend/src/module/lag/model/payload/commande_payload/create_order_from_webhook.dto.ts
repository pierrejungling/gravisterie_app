import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WebhookAttachmentDto {
    @ApiProperty({ description: 'Nom original du fichier' })
    @IsNotEmpty()
    @IsString()
    filename: string;

    @ApiProperty({ required: false, description: 'Type MIME (ex: image/png)' })
    @IsOptional()
    @IsString()
    mime_type?: string;

    @ApiProperty({ description: 'Contenu du fichier encodé en base64' })
    @IsNotEmpty()
    @IsString()
    content_base64: string;
}

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    newsletter?: boolean;

    @ApiProperty({ required: false, description: 'CGV acceptées' })
    @IsOptional()
    @IsBoolean()
    terms?: boolean;

    @ApiProperty({ required: false, type: [WebhookAttachmentDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => WebhookAttachmentDto)
    attachments?: WebhookAttachmentDto[];
}
