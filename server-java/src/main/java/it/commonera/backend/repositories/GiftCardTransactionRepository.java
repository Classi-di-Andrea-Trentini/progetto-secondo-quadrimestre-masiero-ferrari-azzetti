package it.commonera.backend.repositories;

import it.commonera.backend.entities.GiftCardTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface GiftCardTransactionRepository extends JpaRepository<GiftCardTransaction, UUID> {}
