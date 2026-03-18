package spring.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Properties;

/**
 * Configuration for AWS Simple Email Service (SES v2).
 * <p>
 * Provides two beans:
 * <ul>
 *   <li>{@code sesV2Client} — a {@link SesV2Client} that uses the AWS SDK's
 *       default credential provider chain. Locally this picks up
 *       {@code ~/.aws/credentials} (populated by {@code aws configure});
 *       on Render, set {@code AWS_ACCESS_KEY_ID}, {@code AWS_SECRET_ACCESS_KEY},
 *       and {@code AWS_REGION} as environment variables.</li>
 *   <li>{@code sesFromEmail} — the verified sender address read from
 *       {@code credentials.properties} (key {@code ses_from_email}) or the
 *       {@code SES_FROM_EMAIL} environment variable.</li>
 * </ul>
 * <p>
 * Add to {@code credentials.properties} for local development:
 * <pre>
 *   ses_from_email=you@yourdomain.com
 * </pre>
 * The AWS region is read from the same default provider chain ({@code AWS_REGION}
 * env var or {@code ~/.aws/config}). If you need to hard-code it, set
 * {@code AWS_REGION=us-east-1} (or whichever region your SES identity is in).
 */
@Configuration
public class SesConfig {

    private static final String CREDENTIALS_FILE = "credentials.properties";

    /**
     * Creates a {@link SesV2Client} using the AWS default credential provider chain.
     * No explicit credentials are set here — the SDK resolves them automatically:
     * <ol>
     *   <li>Environment variables ({@code AWS_ACCESS_KEY_ID} / {@code AWS_SECRET_ACCESS_KEY})</li>
     *   <li>{@code ~/.aws/credentials} file (local development)</li>
     *   <li>EC2/ECS instance metadata (if running on AWS infrastructure)</li>
     * </ol>
     */
    @Bean
    public SesV2Client sesV2Client() {
        return SesV2Client.builder()
                .region(Region.of(resolveRegion()))
                .build();
    }

    /**
     * Returns the verified SES sender email address.
     * Reads from {@code credentials.properties} (key {@code ses_from_email})
     * first, then falls back to the {@code SES_FROM_EMAIL} environment variable.
     *
     * @throws IllegalStateException if the sender address cannot be found in either source
     * @throws IOException           if {@code credentials.properties} exists but cannot be read
     */
    @Bean(name = "sesFromEmail")
    public String sesFromEmail() throws IOException {
        File credentialsFile = new File(CREDENTIALS_FILE);
        if (credentialsFile.exists()) {
            Properties props = new Properties();
            try (FileInputStream fis = new FileInputStream(credentialsFile)) {
                props.load(fis);
            }
            String email = props.getProperty("ses_from_email");
            if (email != null && !email.isBlank()) {
                return email.trim();
            }
        }

        String email = System.getenv("SES_FROM_EMAIL");
        if (email != null && !email.isBlank()) {
            return email.trim();
        }

        throw new IllegalStateException(
                "SES sender address is missing. Add ses_from_email to credentials.properties " +
                        "or set the SES_FROM_EMAIL environment variable."
        );
    }

    /**
     * Resolves the AWS region from the {@code AWS_REGION} environment variable,
     * falling back to {@code us-east-1} if it is not set.
     * This mirrors the behavior of the default SDK region provider chain
     * while giving a concrete default so the bean never fails to construct.
     */
    private String resolveRegion() {
        String region = System.getenv("AWS_REGION");
        return (region != null && !region.isBlank()) ? region.trim() : "us-east-1";
    }
}