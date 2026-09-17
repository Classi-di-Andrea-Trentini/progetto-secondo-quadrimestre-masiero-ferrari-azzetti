package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "return_items")
@Getter
@Setter
public class ReturnItem {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "return_id", nullable = false)
    private OrderReturn orderReturn;

    /**
     * Relazione, non UUID sciolto: a differenza di `Order.promoCodeId` questa riga
     * serve a mostrare nome prodotto/prezzo nel dettaglio del reso, ed e' un
     * riferimento a una riga che non cambia mai dopo la creazione dell'ordine.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    @Column(nullable = false)
    private Integer quantity;
}
