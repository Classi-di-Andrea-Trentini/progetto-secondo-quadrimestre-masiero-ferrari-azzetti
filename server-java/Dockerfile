# Stage di build: Gradle Wrapper compila l'app e produce lo jar eseguibile
# (bootJar). Questo stage non finisce nell'immagine finale.
FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle

# Dipendenze copiate e scaricate prima del codice sorgente, cosi' la cache Docker
# le riusa finche' build.gradle non cambia, anche se cambiano solo i .java.
RUN ./gradlew --no-daemon dependencies

COPY src ./src

RUN ./gradlew --no-daemon bootJar

# Stage di runtime: solo la JRE e lo jar. Niente Gradle, niente sorgenti, niente
# cache di build nell'immagine che gira in produzione.
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 3000

CMD ["java", "-jar", "app.jar"]
