# Stage 1: Build
FROM eclipse-temurin:24-jdk AS build
WORKDIR /project

# Copy root-level Gradle files
COPY gradlew .
COPY gradle gradle
COPY settings.gradle .

# Copy app module
COPY app/build.gradle app/build.gradle
COPY app/src app/src

# Give execute permission to gradlew
RUN chmod +x gradlew

# Build the JAR, skipping tests
RUN ./gradlew :app:bootJar -x test

# Stage 2: Runtime
FROM eclipse-temurin:24-jre
WORKDIR /app

COPY --from=build /project/app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]