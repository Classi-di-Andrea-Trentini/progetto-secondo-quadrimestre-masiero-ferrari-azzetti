package it.commonera.backend.repositories;

import it.commonera.backend.entities.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {

    List<ProductVariant> findByProductId(UUID productId);
    Optional<ProductVariant> findByIdAndProductId(UUID id, UUID productId);
    Optional<ProductVariant> findBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCase(String sku);

    /**
     * Decremento **condizionale** della giacenza.
     *
     * Il controllo fatto prima non basta: due checkout sull'ultimo pezzo leggono
     * entrambi `stockQty = 1` e scalano entrambi, lasciando -1. Qui la riga viene
     * toccata solo se la merce c'e' ancora nel momento della scrittura, e un
     * risultato `0` significa che qualcun altro e' arrivato prima.
     */
    @Modifying
    @Query("update ProductVariant v set v.stockQty = v.stockQty - :qty " +
           "where v.id = :id and v.stockQty >= :qty")
    int decrementStock(@Param("id") UUID id, @Param("qty") int qty);

    /**
     * Restituzione della giacenza, in un solo UPDATE.
     *
     * Il ripristino non parte piu' solo dall'annullamento chiesto dal cliente: lo
     * fanno anche il webhook del pagamento fallito e il raccoglitore degli ordini
     * abbandonati, che girano per conto loro e possono incrociarsi. Un
     * leggi-modifica-scrivi, li', perde un incremento e lascia merce sparita dal
     * magazzino senza che nessuno l'abbia comprata.
     *
     * Nessuna condizione sulla quantita': restituire e' sempre lecito, ed e' il
     * chiamante a sapere quanto aveva riservato.
     */
    @Modifying
    @Query("update ProductVariant v set v.stockQty = v.stockQty + :qty where v.id = :id")
    int incrementStock(@Param("id") UUID id, @Param("qty") int qty);

    /**
     * Colori disponibili a catalogo, con quanti **prodotti distinti** li hanno: lo
     * stesso maglione in cinque taglie nere e' un prodotto nero, non cinque.
     */
    @Query("select v.color, v.colorHex, count(distinct v.product.id) from ProductVariant v " +
           "where v.isActive = true and v.colorHex is not null " +
           "and v.product.isActive = true and v.product.deletedAt is null " +
           "group by v.color, v.colorHex order by count(distinct v.product.id) desc")
    List<Object[]> availableColors();

    @Query("select v.size, count(distinct v.product.id) from ProductVariant v " +
           "where v.isActive = true and v.size is not null " +
           "and v.product.isActive = true and v.product.deletedAt is null " +
           "group by v.size")
    List<Object[]> availableSizes();

    /**
     * Copertina del prodotto per ogni variante, in **una** query. Le righe degli
     * ordini fotografano nome e prezzo ma non l'immagine, che deve seguire il
     * catalogo: se una foto viene sostituita, anche l'ordine di ieri mostra
     * quella nuova. L'ordinamento mette prima la copertina: chi chiama prende la
     * prima riga per variante.
     */
    @Query("""
            select v.id, i.url from ProductVariant v
            join v.product p join p.images i
            where v.id in :ids
            order by i.isCover desc, i.sortOrder asc
            """)
    List<Object[]> coverUrlsByVariantIds(@Param("ids") java.util.Collection<UUID> ids);
}
