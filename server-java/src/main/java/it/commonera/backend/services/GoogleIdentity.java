package it.commonera.backend.services;

/**
 * Quello che dell'utente arriva da Google, ridotto ai quattro campi che contano.
 *
 * Sta fra il filtro OAuth e {@link GoogleAccountService} apposta: la logica di
 * fusione degli account e' la parte delicata e non deve dipendere da
 * {@code OidcUser}, da un {@code Map<String,Object>} di attributi o da qualunque
 * altra cosa Spring Security decida di cambiare. Cosi' si prova con un record
 * costruito a mano, senza un solo giro OAuth vero.
 *
 * @param sub           identificativo stabile dell'account Google. E' l'unica cosa
 *                      che non cambia mai: l'email si', e un indirizzo liberato puo'
 *                      essere riassegnato a un'altra persona.
 * @param email         indirizzo dichiarato da Google
 * @param emailVerified `email_verified` dell'id_token. Se e' falso, nemmeno Google
 *                      sa se quell'indirizzo e' di chi sta entrando.
 * @param fullName      nome e cognome, `null` se l'utente non li ha condivisi
 */
public record GoogleIdentity(String sub, String email, boolean emailVerified, String fullName) {}
