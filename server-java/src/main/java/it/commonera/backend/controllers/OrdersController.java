package it.commonera.backend.controllers;

import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.InvoiceService;
import it.commonera.backend.services.OrderService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
public class OrdersController {

    private final OrderService orders;
    private final InvoiceService invoices;

    public OrdersController(OrderService orders, InvoiceService invoices) {
        this.orders = orders;
        this.invoices = invoices;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal CurrentUser user,
                                    @RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "10") int limit) {
        return orders.findAll(user.id(), page, limit);
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return orders.findOne(user.id(), id);
    }

    @PatchMapping("/{id}/cancel")
    public Map<String, Object> cancel(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return orders.cancel(user.id(), id);
    }

    /** Fattura in PDF: il numero viene assegnato alla prima richiesta e poi non cambia. */
    @GetMapping("/{id}/invoice")
    public void invoice(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                        HttpServletResponse response) throws IOException {
        var invoice = invoices.build(user.id(), id);
        response.setContentType("application/pdf");
        // `attachment` perche' il browser lo salvi col nome giusto invece di aprirlo
        // in una scheda intitolata come l'id dell'ordine.
        response.setHeader("Content-Disposition", "attachment; filename=\"" + invoice.filename() + "\"");
        response.getOutputStream().write(invoice.pdf());
    }
}
