package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "reviews")
@Getter
@Setter
public class Review {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "product_id", nullable = false, columnDefinition = "uuid")
    private UUID productId;

    @Column(name = "order_id", columnDefinition = "uuid")
    private UUID orderId;

    @Column(nullable = false)
    private Short rating;

    private String title;

    private String body;

    /** Le recensioni nascono `pending`: sono pubbliche solo dopo l'approvazione. */
    @Column(nullable = false, columnDefinition = "\"ReviewStatus\"")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private ReviewStatus status = ReviewStatus.pending;

    @Column(name = "is_verified", nullable = false)
    private Boolean isVerified = false;

    @Column(name = "helpful_count", nullable = false)
    private Integer helpfulCount = 0;

    /** Colonna array invece di una tabella a parte: sono al massimo una manciata. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> photos = new ArrayList<>();

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum ReviewStatus { pending, approved, rejected }
}
