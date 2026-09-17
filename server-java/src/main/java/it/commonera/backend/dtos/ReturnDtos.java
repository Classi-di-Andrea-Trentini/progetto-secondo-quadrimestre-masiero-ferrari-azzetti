package it.commonera.backend.dtos;

import it.commonera.backend.entities.OrderReturn;
import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.ReturnItem;
import it.commonera.backend.entities.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class ReturnDtos {

    public record ItemRequest(UUID orderItemId, int quantity) {}

    public record CreateRequest(UUID orderId, String reason, List<ItemRequest> items) {}

    public record UpdateStatusRequest(OrderReturn.ReturnStatus status, String adminNote, BigDecimal refundAmount) {}

    public record OrderItemView(UUID id, String productName, String variantLabel, Integer quantity,
                                BigDecimal unitPrice, String imageUrl) {
        static OrderItemView from(it.commonera.backend.entities.OrderItem i, Map<UUID, String> covers) {
            return new OrderItemView(i.getId(), i.getProductName(), i.getVariantLabel(), i.getQuantity(),
                    i.getUnitPrice(), covers.get(i.getVariantId()));
        }
    }

    public record ItemView(UUID id, Integer quantity, OrderItemView orderItem) {
        static ItemView from(ReturnItem i, Map<UUID, String> covers) {
            return new ItemView(i.getId(), i.getQuantity(), OrderItemView.from(i.getOrderItem(), covers));
        }
    }

    public record OrderView(UUID id, BigDecimal total, LocalDateTime createdAt) {}

    public record UserView(String fullName, String email) {}

    public record View(
            UUID id, OrderReturn.ReturnStatus status, String reason, String adminNote, BigDecimal refundAmount,
            LocalDateTime createdAt, LocalDateTime resolvedAt, OrderView order, UserView user, List<ItemView> items) {

        /** @param covers copertina per variante, da {@code CoverImageService}: l'immagine non e' fotografata nella riga */
        public static View from(OrderReturn r, Order order, User user, Map<UUID, String> covers) {
            return new View(r.getId(), r.getStatus(), r.getReason(), r.getAdminNote(), r.getRefundAmount(),
                    r.getCreatedAt(), r.getResolvedAt(),
                    order == null ? null : new OrderView(order.getId(), order.getTotal(), order.getCreatedAt()),
                    user == null ? null : new UserView(user.getFullName(), user.getEmail()),
                    r.getItems().stream().map(i -> ItemView.from(i, covers)).toList());
        }
    }
}
