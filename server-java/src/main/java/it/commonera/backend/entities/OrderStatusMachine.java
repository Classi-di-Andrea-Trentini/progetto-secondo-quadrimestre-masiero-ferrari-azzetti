package it.commonera.backend.entities;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Le transizioni ammesse fra gli stati di un ordine, scritte una volta sola.
 *
 * Prima non esistevano: {@code AdminService.updateOrderStatus} accettava
 * qualunque valore dell'enum da qualunque stato, quindi un ordine `cancelled`
 * poteva diventare `delivered`. Non e' un dettaglio formale — l'annullamento ha
 * gia' rimesso la merce a magazzino, ricaricato il buono e restituito i punti.
 * Dire che quell'ordine e' stato consegnato lascia il negozio in uno stato che
 * nessuna compensazione sa piu' disfare, perche' nessun passaggio lo ha mai
 * costruito: merce contemporaneamente resa e spedita, soldi restituiti su roba
 * uscita dal magazzino.
 *
 * Due grafi, non uno. {@link #ALLOWED} e' cio' che il dominio ammette in
 * assoluto, e comprende passaggi che **nessun amministratore** deve poter
 * guidare a mano perche' spostano denaro: l'incasso lo dichiara il fornitore col
 * webhook, il rimborso lo registra il percorso dei resi. {@link #ADMIN_DRIVEN}
 * e' il sottoinsieme che si comanda dall'area amministrativa. Tenerli separati
 * evita il travestimento piu' comodo per chi vuole barare: cambiare la scritta
 * sull'ordine al posto di far muovere i soldi.
 */
public final class OrderStatusMachine {

    private OrderStatusMachine() {
    }

    /**
     * Il grafo completo del dominio.
     *
     * `cancelled` e `refunded` sono terminali di proposito: da li' non si esce
     * piu'. Un ordine chiuso che torna in lavorazione e' esattamente il caso che
     * lascia giacenza e denaro scollegati dalla realta'.
     */
    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED = new EnumMap<>(OrderStatus.class);

    /** Il sottoinsieme che un amministratore puo' comandare da {@code PATCH /admin/orders/{id}/status}. */
    private static final Map<OrderStatus, Set<OrderStatus>> ADMIN_DRIVEN = new EnumMap<>(OrderStatus.class);

    static {
        // `pending` -> `paid` la fa **solo** il webhook del fornitore: e' la riga
        // che separa "merce riservata" da "merce pagata".
        ALLOWED.put(OrderStatus.pending, EnumSet.of(OrderStatus.paid, OrderStatus.cancelled));
        ALLOWED.put(OrderStatus.paid, EnumSet.of(OrderStatus.processing, OrderStatus.shipped,
                OrderStatus.cancelled, OrderStatus.refunded));
        ALLOWED.put(OrderStatus.processing, EnumSet.of(OrderStatus.shipped,
                OrderStatus.cancelled, OrderStatus.refunded));
        // Da `shipped` in poi la merce e' fuori dal magazzino: si annulla piu'
        // niente, si rimborsa soltanto — ed e' il percorso dei resi a farlo,
        // perche' e' l'unico che sa quanti pezzi tornano indietro.
        ALLOWED.put(OrderStatus.shipped, EnumSet.of(OrderStatus.delivered, OrderStatus.refunded));
        ALLOWED.put(OrderStatus.delivered, EnumSet.of(OrderStatus.completed, OrderStatus.refunded));
        ALLOWED.put(OrderStatus.completed, EnumSet.of(OrderStatus.refunded));
        ALLOWED.put(OrderStatus.cancelled, EnumSet.noneOf(OrderStatus.class));
        ALLOWED.put(OrderStatus.refunded, EnumSet.noneOf(OrderStatus.class));

        // Fuori da qui restano `-> paid` (la dichiara chi incassa) e
        // `-> refunded` (la registra il percorso dei resi, che muove il denaro
        // con `OrderCompensationService.refundCharge`). Un amministratore che
        // potesse scriverli a mano scavalcherebbe in entrambi i casi il
        // movimento di denaro corrispondente.
        ADMIN_DRIVEN.put(OrderStatus.pending, EnumSet.of(OrderStatus.cancelled));
        ADMIN_DRIVEN.put(OrderStatus.paid, EnumSet.of(OrderStatus.processing, OrderStatus.shipped,
                OrderStatus.cancelled));
        ADMIN_DRIVEN.put(OrderStatus.processing, EnumSet.of(OrderStatus.shipped, OrderStatus.cancelled));
        ADMIN_DRIVEN.put(OrderStatus.shipped, EnumSet.of(OrderStatus.delivered));
        ADMIN_DRIVEN.put(OrderStatus.delivered, EnumSet.of(OrderStatus.completed));
        ADMIN_DRIVEN.put(OrderStatus.completed, EnumSet.noneOf(OrderStatus.class));
        ADMIN_DRIVEN.put(OrderStatus.cancelled, EnumSet.noneOf(OrderStatus.class));
        ADMIN_DRIVEN.put(OrderStatus.refunded, EnumSet.noneOf(OrderStatus.class));
    }

    public static boolean allows(OrderStatus from, OrderStatus to) {
        return ALLOWED.getOrDefault(from, Set.of()).contains(to);
    }

    public static boolean allowsAdminDriven(OrderStatus from, OrderStatus to) {
        return ADMIN_DRIVEN.getOrDefault(from, Set.of()).contains(to);
    }

    public static Set<OrderStatus> adminTargetsFrom(OrderStatus from) {
        return ADMIN_DRIVEN.getOrDefault(from, Set.of());
    }

    /**
     * Gli stati dai quali un ordine si puo' ancora annullare, derivati dal grafo
     * invece che riscritti a mano: una seconda lista finirebbe per divergere, e
     * divergerebbe proprio sul passaggio che restituisce i soldi.
     */
    public static Set<OrderStatus> cancellableFrom() {
        var result = EnumSet.noneOf(OrderStatus.class);
        ALLOWED.forEach((from, targets) -> {
            if (targets.contains(OrderStatus.cancelled)) result.add(from);
        });
        return result;
    }
}
