package it.commonera.backend.services;

import it.commonera.backend.entities.OrderItem;
import it.commonera.backend.entities.Product;
import it.commonera.backend.repositories.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * L'immagine di copertina, dove serve mostrare un prodotto fuori dal catalogo:
 * righe d'ordine, resi, cruscotto.
 *
 * Un posto solo perche' la regola "prima la copertina, poi per ordinamento" e'
 * gia' scritta nella mappatura di {@link Product#getImages()}: riscriverla in
 * quattro servizi vuol dire quattro modi diversi di scegliere la foto.
 */
@Service
public class CoverImageService {

    private final ProductVariantRepository variants;

    public CoverImageService(ProductVariantRepository variants) {
        this.variants = variants;
    }

    /** Da un elenco di righe d'ordine alla copertina di ciascuna variante, in una query. */
    @Transactional(readOnly = true)
    public Map<UUID, String> coverByVariant(Collection<OrderItem> items) {
        var ids = items.stream().map(OrderItem::getVariantId).filter(id -> id != null).distinct().toList();
        var covers = new HashMap<UUID, String>();
        if (ids.isEmpty()) return covers;
        for (Object[] row : variants.coverUrlsByVariantIds(ids)) {
            // Le righe arrivano con la copertina per prima: la prima vista vince.
            covers.putIfAbsent((UUID) row[0], (String) row[1]);
        }
        return covers;
    }

    /** La copertina di un prodotto gia' caricato, o null se non ha immagini. */
    public static String coverOf(Product product) {
        return product.getImages().isEmpty() ? null : product.getImages().get(0).getUrl();
    }
}
