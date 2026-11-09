import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Image choisie à la main pour un lien (null = revenir à l'image trouvée automatiquement). */
export class ImageApercuLienPayload {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    url: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(90000) // adresse http(s) ou petite image collée (data:image/..., réduite côté app)
    image?: string | null;
}
