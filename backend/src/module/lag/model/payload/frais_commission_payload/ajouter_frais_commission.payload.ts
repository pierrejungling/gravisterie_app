import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Length, Max, Min } from 'class-validator';

export class AjouterFraisCommissionPayload {
    @ApiProperty({ description: 'Libellé du frais / commission (ex: Etsy)' })
    @IsNotEmpty()
    @IsString()
    @Length(1, 100)
    libelle: string;

    @ApiProperty({ description: 'Pourcentage de frais / commission (ex: 6.5 pour 6,5 %)' })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(100)
    pourcentage: number;
}
