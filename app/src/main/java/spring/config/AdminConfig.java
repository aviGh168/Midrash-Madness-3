package spring.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Properties;

/**
 * Loads the admin password from the same credentials source as DatabaseConfig:
 * credentials.properties (local) or the ADMIN_PASSWORD environment variable
 * (deployed on Render or similar).
 * <p>
 * Add one line to credentials.properties:
 * <pre>
 *   admin_password=yourSecretHere
 * </pre>
 * Or set the environment variable ADMIN_PASSWORD when deploying.
 * <p>
 * The password string is exposed as a bean named "adminPassword" so it can be
 * injected into AdminController without re-reading the file.
 */
@Configuration
public class AdminConfig {

    private static final String CREDENTIALS_FILE = "credentials.properties";

    /**
     * Returns the plaintext admin password read from credentials.properties
     * (key {@code admin_password}) or the {@code ADMIN_PASSWORD} environment variable.
     *
     * @throws IllegalStateException if the admin password is missing from both sources
     * @throws IOException           if credentials.properties exists but cannot be read
     */
    @Bean(name = "adminPassword")
    public String adminPassword() throws IOException {
        File credentialsFile = new File(CREDENTIALS_FILE);
        if (credentialsFile.exists()) {
            Properties props = new Properties();
            try (FileInputStream fis = new FileInputStream(credentialsFile)) {
                props.load(fis);
            }
            String pw = props.getProperty("admin_password");
            if (pw != null && !pw.isBlank()) {
                return pw;
            }
        }

        String pw = System.getenv("ADMIN_PASSWORD");
        if (pw != null && !pw.isBlank()) {
            return pw;
        }

        throw new IllegalStateException(
                "Admin password is missing. Add admin_password to credentials.properties " +
                        "or set the ADMIN_PASSWORD environment variable."
        );
    }
}