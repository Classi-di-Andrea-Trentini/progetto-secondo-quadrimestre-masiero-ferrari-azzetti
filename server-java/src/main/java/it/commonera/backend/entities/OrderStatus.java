package it.commonera.backend.entities;

/** Valori dell'enum Postgres `"OrderStatus"`: i nomi devono restare identici. */
public enum OrderStatus {
    pending, paid, processing, shipped, delivered, completed, cancelled, refunded
}
