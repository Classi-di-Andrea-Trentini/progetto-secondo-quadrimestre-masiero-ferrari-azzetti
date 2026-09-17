# Stage di build: Gradle Wrapper compila l'app e produce lo jar eseguibile
# (bootJar). Questo stage non finisce nell'immagine finale.
FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

# Timeout di rete generosi e qualche tentativo in piu': con una linea lenta il
# download di un singolo jar da Maven Central puo' superare i trenta secondi, e
# coi valori predefiniti la build si interrompeva a meta' con "Could not download
# ...jar" — un guasto della connessione travestito da errore di compilazione.
ENV GRADLE_OPTS="-Dorg.gradle.internal.http.connectionTimeout=180000 \
    -Dorg.gradle.internal.http.socketTimeout=180000 \
    -Dorg.gradle.internal.repository.max.retries=5 \
    -Dorg.gradle.internal.repository.initial.backoff=1000"

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle

# Dipendenze copiate e scaricate prima del codice sorgente, cosi' la cache Docker
# le riusa finche' build.gradle non cambia, anche se cambiano solo i .java. La
# cache di Gradle e' anche un mount persistente: un tentativo interrotto non
# riparte da zero.
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon dependencies

COPY src ./src

RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar

# Stage di runtime: solo la JRE e lo jar. Niente Gradle, niente sorgenti, niente
# cache di build nell'immagine che gira in produzione.
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 3000

CMD ["java", "-jar", "app.jar"]
