package it.commonera.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Riscrittura in Java del backend di Common Era.
 *
 * Parla lo **stesso database** e la **stessa API** del backend Node: il frontend
 * Angular non deve cambiare una riga per passare dall'uno all'altro. Da qui due
 * conseguenze che si ritrovano in tutto il codice:
 *
 * 1. lo schema non lo genera Hibernate — nasce da `database/init/*.sql`, quindi
 *    `ddl-auto=validate` e le entita' devono combaciare con le tabelle esistenti;
 * 2. i nomi delle colonne sono `snake_case` e vanno dichiarati a mano, perche' la
 *    convenzione di Spring non li indovina tutti.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class CommonEraApplication {
    public static void main(String[] args) {
        SpringApplication.run(CommonEraApplication.class, args);
    }
}
