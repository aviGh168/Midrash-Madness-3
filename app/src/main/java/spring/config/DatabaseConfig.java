package spring.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Objects;
import java.util.Properties;

/**
 * Configuration class for database connection and transaction management.
 * Sets up the MySQL data source using credentials from credentials.properties if it exists,
 * otherwise falls back to environment variables (e.g. when deployed on Render).
 * Configures Spring transaction management.
 */
@Configuration
@EnableTransactionManagement
public class DatabaseConfig {

    private static final String CREDENTIALS_FILE = "credentials.properties";

    /**
     * Creates and configures the MySQL data source bean.
     * First checks for a local credentials.properties file; if not found,
     * falls back to environment variables DB_CONNECTION, DB_DATABASE, DB_USER, DB_PASSWORD.
     *
     * @return the configured DataSource
     * @throws IOException if the properties file exists but cannot be read
     * @throws IllegalStateException if required credentials are missing from both sources
     */
    @Bean
    public DataSource dataSource() throws IOException {
        String endpoint, database, username, password;

        File credentialsFile = new File(CREDENTIALS_FILE);
        if (credentialsFile.exists()) {
            Properties credentials = new Properties();
            credentials.load(new FileInputStream(credentialsFile));

            endpoint = credentials.getProperty("db_connection");
            database = credentials.getProperty("database");
            username = credentials.getProperty("user");
            password = credentials.getProperty("password");
        } else {
            endpoint = System.getenv("DB_CONNECTION");
            database = System.getenv("DB_DATABASE");
            username = System.getenv("DB_USER");
            password = System.getenv("DB_PASSWORD");
        }

        if (endpoint == null || database == null || username == null || password == null) {
            throw new IllegalStateException(
                    "Database credentials are missing. Provide a credentials.properties file or " +
                            "set the DB_CONNECTION, DB_DATABASE, DB_USER, and DB_PASSWORD environment variables."
            );
        }

        String connectionUrl = "jdbc:mysql://" + endpoint + "/" + database
                + "?useSSL=true"
                + "&serverTimezone=UTC";

        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(connectionUrl);
        dataSource.setUsername(username);
        dataSource.setPassword(password);

        return dataSource;
    }

    /**
     * Creates and configures the transaction manager bean.
     *
     * @param dataSource the data source to use for transactions
     * @return the configured PlatformTransactionManager
     * @throws NullPointerException if dataSource is null
     */
    @Bean
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(Objects.requireNonNull(dataSource, "dataSource must not be null"));
    }
}