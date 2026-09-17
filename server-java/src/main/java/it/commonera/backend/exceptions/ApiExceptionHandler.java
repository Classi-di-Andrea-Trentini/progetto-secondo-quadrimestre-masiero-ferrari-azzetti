package it.commonera.backend.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handle(ApiException ex) {
        return body(ex.getStatus(), List.of(ex.getMessage()));
    }

    /**
     * Errori di validazione come lista di messaggi, esattamente come li produce
     * `class-validator` nel backend Node: il frontend mostra `message` cosi' com'e'.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handle(MethodArgumentNotValidException ex) {
        List<String> messages = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .toList();
        return body(HttpStatus.BAD_REQUEST, messages);
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, List<String> messages) {
        return ResponseEntity.status(status).body(Map.of(
                "message", messages.size() == 1 ? messages.get(0) : messages,
                "error", status.getReasonPhrase(),
                "statusCode", status.value()));
    }
}
