package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Hash BCrypt. Il nome della colonna dice "hash" apposta: non e' la password. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /**
     * `role` e' un enum Postgres (`"UserRole"`), non una varchar: senza dirlo a
     * Hibernate la scrittura fallisce con un errore di tipo che non nomina la
     * colonna, ed e' una mezz'ora persa a capire dove.
     */
    @Column(nullable = false, columnDefinition = "\"UserRole\"")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private Role role = Role.user;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    @Column(name = "avatar_url")
    private String avatarUrl;

    private String phone;

    /** Colonne che esistono da sempre nello schema ma che nessuna entita' leggeva:
        senza, la tab "Profilo" di /me perdeva in silenzio data di nascita e genere. */
    @Column(name = "birth_date")
    private java.time.LocalDate birthDate;

    private String gender;

    @Column(name = "newsletter_opt_in", nullable = false)
    private Boolean newsletterOptIn = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Role {
        user,
        admin
    }

    public boolean isAdmin() {
        return role == Role.admin;
    }

    /** L'email non verificata blocca il login: stessa regola del backend Node. */
    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }
}
