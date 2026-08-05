import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

/** Tetto per riga: oltre non è un acquisto, è un errore di battitura o un abuso. */
export const MAX_QUANTITY_PER_ITEM = 99;

export class AddCartItemDto {
  /**
   * `'loose'` e non il default.
   *
   * Gli id del seed (`e0000001-eeee-eeee-eeee-…`) hanno il nibble di versione
   * fuori dalle versioni RFC: sono valori legittimi per una colonna `uuid` di
   * Postgres, ma `@IsUUID()` li rifiuta. Con il default **anche il checkout
   * rispondeva 400 su tutto il catalogo di prova**, non solo il carrello.
   *
   * Da validator 13.15 l'opzione permissiva e' `'loose'`: `'all'` non accetta
   * piu' le versioni fuori standard, quindi non basta e va lasciata stare.
   */
  @IsUUID('loose')
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}

export class UpdateCartItemDto {
  /** Zero è ammesso e significa "togli la riga". */
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}

/**
 * Carrello riempito da sloggato e portato dentro al login.
 *
 * Senza questa fusione l'utente che aggiunge prodotti e poi accede si ritrova il
 * carrello svuotato — il modo più diretto per perdere una vendita.
 */
export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}
