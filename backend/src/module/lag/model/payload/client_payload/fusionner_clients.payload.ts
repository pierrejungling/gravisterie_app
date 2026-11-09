import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

/** Fusion de fiches clients : les commandes des fiches sources passent sur la fiche cible. */
export class FusionnerClientsPayload {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    id_client_cible: string;

    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    ids_clients_sources: string[];
}
