# Stage 1: Build
FROM eclipse-temurin:24-jdk AS build
WORKDIR /app

# Copy Gradle wrapper and build files first (for layer caching)
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .

# Give execute permission to gradlew
RUN chmod +x gradlew

# Copy source code
COPY src src

# Build the JAR, skipping tests
RUN ./gradlew bootJar -x test

# Stage 2: Runtime (leaner image, no JDK or Gradle included)
FROM eclipse-temurin:24-jre
WORKDIR /app

# Copy the built JAR from the build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Expose port (informational; Render uses the PORT env var)
EXPOSE 8080

# Run the app
ENTRYPOINT ["java", "-jar", "app.jar"]