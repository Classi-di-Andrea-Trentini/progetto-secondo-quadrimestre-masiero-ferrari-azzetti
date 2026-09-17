package it.commonera.backend.services;

import com.lowagie.text.*;
import java.awt.Color;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import it.commonera.backend.entities.Order;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.UserAddressRepository;
import it.commonera.backend.repositories.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;

/**
 * Fattura in PDF.
 *
 * Il numero viene assegnato **alla prima richiesta** e poi non cambia piu': e' il
 * riferimento che il cliente cita, e non puo' ballare. Numerazione progressiva per
 * anno; l'unicita' la garantisce il vincolo sulla colonna, quindi una corsa fra due
 * richieste fa fallire una delle due invece di produrre due fatture con lo stesso
 * numero.
 */
@Service
public class InvoiceService {

    // "d MMM y" (es. "5 Sep 2026"): stesso pattern usato dal frontend, non ambiguo
    // in nessuna delle due convenzioni giorno/mese, a differenza di un formato numerico.
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM y", Locale.ENGLISH);

    private final OrderRepository orders;
    private final UserRepository users;
    private final UserAddressRepository addresses;

    public InvoiceService(OrderRepository orders, UserRepository users, UserAddressRepository addresses) {
        this.orders = orders;
        this.users = users;
        this.addresses = addresses;
    }

    @Transactional
    public Invoice build(UUID userId, UUID orderId) {
        var order = orders.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Order not found"));
        // Il controllo di proprieta' sta qui e non solo nel controller: la fattura
        // contiene nome e indirizzo, non e' un documento da servire per id indovinato.
        if (!order.getUserId().equals(userId)) throw ApiException.forbidden();

        if (order.getInvoiceNumber() == null) {
            String year = String.valueOf(order.getCreatedAt().getYear());
            long used = orders.countByInvoiceNumberStartingWith(year + "-");
            order.setInvoiceNumber(year + "-" + String.format("%04d", used + 1));
            orders.save(order);
        }

        return new Invoice("fattura-" + order.getInvoiceNumber() + ".pdf", render(order));
    }

    private byte[] render(Order order) {
        var out = new ByteArrayOutputStream();
        var document = new Document(PageSize.A4, 50, 50, 50, 50);
        PdfWriter.getInstance(document, out);
        document.open();

        var title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20);
        var small = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY);
        var normal = FontFactory.getFont(FontFactory.HELVETICA, 11);
        var bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);

        document.add(new Paragraph("CommonEra", title));
        document.add(new Paragraph("Invoice", small));
        document.add(Chunk.NEWLINE);

        document.add(new Paragraph("Number: " + order.getInvoiceNumber(), normal));
        document.add(new Paragraph("Date: " + order.getCreatedAt().format(DATE), normal));
        document.add(new Paragraph("Order: " + order.getId(), normal));
        document.add(new Paragraph("Status: " + order.getStatus().name(), normal));
        document.add(Chunk.NEWLINE);

        users.findById(order.getUserId()).ifPresent(user -> {
            document.add(new Paragraph("Ship to", small));
            document.add(new Paragraph(user.getFullName(), normal));
            document.add(new Paragraph(user.getEmail(), normal));
        });
        if (order.getAddressId() != null) {
            addresses.findById(order.getAddressId()).ifPresent(address -> {
                document.add(new Paragraph(address.getStreet(), normal));
                document.add(new Paragraph(
                        address.getPostalCode() + " " + address.getCity()
                                + (address.getProvince() == null ? "" : " (" + address.getProvince() + ")"), normal));
                document.add(new Paragraph(address.getCountry(), normal));
            });
        }
        document.add(Chunk.NEWLINE);

        var table = new PdfPTable(new float[]{5, 1, 2, 2});
        table.setWidthPercentage(100);
        header(table, "Item");
        header(table, "Qty");
        header(table, "Price");
        header(table, "Total");

        for (var item : order.getItems()) {
            String label = item.getVariantLabel() == null
                    ? item.getProductName()
                    : item.getProductName() + " — " + item.getVariantLabel();
            cell(table, label, Element.ALIGN_LEFT);
            cell(table, String.valueOf(item.getQuantity()), Element.ALIGN_RIGHT);
            cell(table, euro(item.getUnitPrice()), Element.ALIGN_RIGHT);
            cell(table, euro(item.getLineTotal()), Element.ALIGN_RIGHT);
        }
        document.add(table);
        document.add(Chunk.NEWLINE);

        totals(document, "Subtotal", euro(order.getSubtotal()), normal);
        if (order.getDiscountTotal().signum() > 0) {
            totals(document, "Discount", "- " + euro(order.getDiscountTotal()), normal);
        }
        if (order.getGiftCardAmount() != null && order.getGiftCardAmount().signum() > 0) {
            totals(document, "Gift card", "- " + euro(order.getGiftCardAmount()), normal);
        }
        totals(document, "Shipping", euro(order.getShippingCost()), normal);
        totals(document, "Total", euro(order.getTotal()), bold);

        document.add(Chunk.NEWLINE);
        document.add(new Paragraph("This document is generated automatically and is not valid for tax purposes.", small));
        document.close();

        return out.toByteArray();
    }

    private void header(PdfPTable table, String text) {
        var cell = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY)));
        cell.setBorder(Rectangle.BOTTOM);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void cell(PdfPTable table, String text, int align) {
        var cell = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA, 10)));
        cell.setBorder(Rectangle.BOTTOM);
        cell.setHorizontalAlignment(align);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void totals(Document document, String label, String value, Font font) {
        var paragraph = new Paragraph(label + "    " + value, font);
        paragraph.setAlignment(Element.ALIGN_RIGHT);
        document.add(paragraph);
    }

    private String euro(BigDecimal value) {
        return "EUR " + (value == null ? "0.00" : value.toPlainString());
    }

    public record Invoice(String filename, byte[] pdf) {}
}
