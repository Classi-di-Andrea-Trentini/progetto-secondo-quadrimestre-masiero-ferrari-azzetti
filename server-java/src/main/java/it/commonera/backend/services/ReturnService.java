package it.commonera.backend.services;

import it.commonera.backend.dtos.ReturnDtos;
import it.commonera.backend.entities.*;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Resi.
 *
 * Stesso comportamento del backend Node: qui si registra solo lo stato del reso
 * (con nota e importo rimborso) e si avvisa il cliente via email — nessuno storno
 * automatico di buono o punti, perche' il pagamento e' simulato e non c'e' niente
 * di reale da restituire oltre a quello che l'amministratore scrive a mano.
 */
@Service
public class ReturnService {

    private static final EnumSet<OrderStatus> ELIGIBLE = EnumSet.of(OrderStatus.delivered, OrderStatus.completed);

    private final OrderReturnRepository returns;
    private final OrderRepository orders;
    private final UserRepository users;
    private final MailService mail;
    private final OrderCompensationService compensation;
    private final CoverImageService covers;

    public ReturnService(OrderReturnRepository returns, OrderRepository orders, UserRepository users,
                         MailService mail, OrderCompensationService compensation,
                         CoverImageService covers) {
        this.returns = returns;
        this.orders = orders;
        this.users = users;
        this.mail = mail;
        this.compensation = compensation;
        this.covers = covers;
    }

    @Transactional(readOnly = true)
    public List<ReturnDtos.View> findAll(UUID userId) {
        return returns.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(r -> view(r, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public ReturnDtos.View findOne(UUID userId, UUID id) {
        var ret = returns.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("Return not found"));
        return view(ret, false);
    }

    @Transactional
    public ReturnDtos.View create(UUID userId, ReturnDtos.CreateRequest dto) {
        if (dto.reason() == null || dto.reason().trim().length() < 10) {
            throw ApiException.badRequest("Reason must be at least 10 characters");
        }
        if (dto.items() == null || dto.items().isEmpty()) {
            throw ApiException.badRequest("At least one item is required");
        }

        var order = orders.findById(dto.orderId()).orElseThrow(() -> ApiException.notFound("Order not found"));
        if (!order.getUserId().equals(userId)) throw ApiException.forbidden();
        if (!ELIGIBLE.contains(order.getStatus())) {
            throw ApiException.badRequest("Returns can only be requested for delivered or completed orders");
        }
        if (returns.existsByOrderIdAndStatusNot(dto.orderId(), OrderReturn.ReturnStatus.rejected)) {
            throw ApiException.badRequest("A return request already exists for this order");
        }

        var orderItemsById = new HashMap<UUID, OrderItem>();
        for (var item : order.getItems()) orderItemsById.put(item.getId(), item);

        var ret = new OrderReturn();
        ret.setOrderId(order.getId());
        ret.setUserId(userId);
        ret.setReason(dto.reason().trim());

        // Le quantita' si sommano per riga d'ordine PRIMA di controllarle: validare
        // riga per riga lascia passare lo stesso orderItemId ripetuto N volte, e ogni
        // ripetizione supera il controllo da sola. Chi ha comprato 1 pezzo aprirebbe
        // un reso da 5. Non c'e' rete sotto: return_items non ha un vincolo di
        // unicita' su (return_id, order_item_id).
        var requested = new LinkedHashMap<UUID, Integer>();
        for (var line : dto.items()) {
            if (line.quantity() <= 0) throw ApiException.badRequest("Quantity must be positive");
            requested.merge(line.orderItemId(), line.quantity(), Integer::sum);
        }

        for (var entry : requested.entrySet()) {
            var orderItem = orderItemsById.get(entry.getKey());
            if (orderItem == null) {
                throw ApiException.badRequest("Order item " + entry.getKey() + " not found in this order");
            }
            if (entry.getValue() > orderItem.getQuantity()) {
                throw ApiException.badRequest("Cannot return more than " + orderItem.getQuantity()
                        + " units of " + orderItem.getProductName());
            }

            var returnItem = new ReturnItem();
            returnItem.setOrderReturn(ret);
            returnItem.setOrderItem(orderItem);
            returnItem.setQuantity(entry.getValue());
            ret.getItems().add(returnItem);
        }

        var saved = returns.save(ret);
        return view(saved, false);
    }

    // ─── Amministrazione ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> adminList(OrderReturn.ReturnStatus status, String search, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);

        List<UUID> matchingUserIds = List.of();
        UUID searchOrderId = null;
        if (search != null && !search.isBlank()) {
            matchingUserIds = users.findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(search, search)
                    .stream().map(User::getId).toList();
            searchOrderId = tryParseUuid(search);
        }

        var result = returns.findAll(specification(status, search, matchingUserIds, searchOrderId),
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        var orderIds = result.getContent().stream().map(OrderReturn::getOrderId).distinct().toList();
        var userIds = result.getContent().stream().map(OrderReturn::getUserId).distinct().toList();
        var ordersById = new HashMap<UUID, Order>();
        orders.findAllById(orderIds).forEach(o -> ordersById.put(o.getId(), o));
        var usersById = new HashMap<UUID, User>();
        users.findAllById(userIds).forEach(u -> usersById.put(u.getId(), u));

        // Una query sola per tutta la pagina (fino a 100 resi): prima ne partiva
        // una per reso dentro la `map`.
        var coverByVariant = covers.coverByVariant(
                result.getContent().stream().flatMap(r -> orderItemsOf(r).stream()).toList());
        var views = result.getContent().stream()
                .map(r -> ReturnDtos.View.from(r, ordersById.get(r.getOrderId()), usersById.get(r.getUserId()),
                        coverByVariant))
                .toList();

        return Map.of(
                "data", views,
                "meta", Map.of(
                        "total", result.getTotalElements(),
                        "page", result.getNumber() + 1,
                        "limit", capped,
                        "totalPages", result.getTotalPages()));
    }

    @Transactional
    public ReturnDtos.View updateStatus(UUID id, ReturnDtos.UpdateStatusRequest dto) {
        var ret = returns.findById(id).orElseThrow(() -> ApiException.notFound("Return not found"));

        var wasAlreadyRefunded = ret.getStatus() == OrderReturn.ReturnStatus.refunded;

        ret.setStatus(dto.status());
        if (dto.adminNote() != null) ret.setAdminNote(dto.adminNote());
        if (dto.refundAmount() != null) ret.setRefundAmount(dto.refundAmount());
        if (dto.status() == OrderReturn.ReturnStatus.refunded) ret.setResolvedAt(java.time.LocalDateTime.now());

        // Il rimborso si registra **prima** di salvare: se l'importo supera
        // l'incasso, `refundCharge` lancia e il reso non deve risultare
        // rimborsato. E solo alla prima volta: ripassare due volte da `refunded`
        // restituirebbe l'importo due volte.
        if (dto.status() == OrderReturn.ReturnStatus.refunded && !wasAlreadyRefunded) {
            var order = orders.findById(ret.getOrderId())
                    .orElseThrow(() -> ApiException.notFound("Order not found"));
            compensation.refundCharge(order, ret.getRefundAmount(), "Return " + ret.getId());
        }

        var saved = returns.save(ret);

        var user = users.findById(saved.getUserId()).orElse(null);
        if (user != null) {
            mail.sendReturnStatusUpdate(user.getEmail(), user.getFullName(), saved.getId().toString(),
                    saved.getStatus().name(), saved.getAdminNote());
        }

        return view(saved, true);
    }

    private ReturnDtos.View view(OrderReturn ret, boolean includeUser) {
        var order = orders.findById(ret.getOrderId()).orElse(null);
        var user = includeUser ? users.findById(ret.getUserId()).orElse(null) : null;
        return ReturnDtos.View.from(ret, order, user, covers.coverByVariant(orderItemsOf(ret)));
    }

    private static List<it.commonera.backend.entities.OrderItem> orderItemsOf(OrderReturn ret) {
        return ret.getItems().stream().map(i -> i.getOrderItem()).toList();
    }

    private Specification<OrderReturn> specification(OrderReturn.ReturnStatus status, String search,
                                                       List<UUID> matchingUserIds, UUID searchOrderId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (search != null && !search.isBlank()) {
                List<Predicate> or = new ArrayList<>();
                if (!matchingUserIds.isEmpty()) or.add(root.get("userId").in(matchingUserIds));
                if (searchOrderId != null) or.add(cb.equal(root.get("orderId"), searchOrderId));
                // Nessun match possibile: una ricerca senza risultati deve restituire
                // zero righe, non tutte (un OR vuoto in JPA Criteria equivarrebbe a "vero").
                predicates.add(or.isEmpty() ? cb.disjunction() : cb.or(or.toArray(new Predicate[0])));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
