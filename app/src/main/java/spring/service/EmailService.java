package spring.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.SesV2Exception;

/**
 * Service for sending transactional emails via AWS SES v2.
 * <p>
 * Email failures are logged but never propagated to the caller.
 * A bracket that has already been saved to the database must not
 * appear to fail just because the confirmation email could not be sent.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private static final String APP_URL        = "https://midrash-madness.onrender.com";
    private static final String RESULTS_URL    = APP_URL + "/resultsPage.html";
    private static final String BRACKET_URL    = APP_URL + "/userBracketPage.html?bracketId=";

    private final SesV2Client sesClient;
    private final String      fromEmail;

    public EmailService(SesV2Client sesV2Client,
                        @Qualifier("sesFromEmail") String sesFromEmail) {
        this.sesClient = sesV2Client;
        this.fromEmail = sesFromEmail;
    }

    /**
     * Sends a bracket submission confirmation email to the given recipient.
     * <p>
     * The email includes:
     * <ul>
     *   <li>A thank-you message personalized with the recipient's name</li>
     *   <li>A link to the live results page</li>
     *   <li>A link to their personal bracket page</li>
     * </ul>
     * <p>
     * Any {@link SesV2Exception} or other runtime exception is caught, logged,
     * and silently swallowed so that a delivery failure never rolls back or
     * masks a successful bracket submission.
     *
     * @param toName      the submitter's display name (used in the greeting)
     * @param toEmail     the recipient's email address
     * @param bracketId   the generated bracket_id, used to build the personal bracket link
     */
    public void sendConfirmationEmail(String toName, String toEmail, int bracketId) {
        try {
            String subject  = "Midrash Madness — Bracket Received!";
            String htmlBody = buildHtmlBody(toName, bracketId);
            String textBody = buildTextBody(toName, bracketId);

            SendEmailRequest request = SendEmailRequest.builder()
                    .fromEmailAddress(fromEmail)
                    .destination(Destination.builder()
                            .toAddresses(toEmail)
                            .build())
                    .content(EmailContent.builder()
                            .simple(Message.builder()
                                    .subject(Content.builder()
                                            .data(subject)
                                            .charset("UTF-8")
                                            .build())
                                    .body(Body.builder()
                                            .html(Content.builder()
                                                    .data(htmlBody)
                                                    .charset("UTF-8")
                                                    .build())
                                            .text(Content.builder()
                                                    .data(textBody)
                                                    .charset("UTF-8")
                                                    .build())
                                            .build())
                                    .build())
                            .build())
                    .build();

            sesClient.sendEmail(request);
            log.info("Confirmation email sent to {} (bracketId={})", toEmail, bracketId);

        } catch (SesV2Exception e) {
            log.error("SES error sending confirmation to {} (bracketId={}): {} — {}",
                    toEmail, bracketId, e.awsErrorDetails().errorCode(), e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error sending confirmation to {} (bracketId={}): {}",
                    toEmail, bracketId, e.getMessage(), e);
        }
    }

    // ─── Email body builders ──────────────────────────────────────────────────

    /**
     * Builds the HTML version of the confirmation email.
     * Styled to match the purple-and-blue Midrash Madness palette.
     */
    private String buildHtmlBody(String name, int bracketId) {
        String bracketLink = BRACKET_URL + bracketId;
        // Escape name for safe HTML insertion
        String safeName = name
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");

        return "<!DOCTYPE html>" +
                "<html lang=\"en\">" +
                "<head><meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
                "<title>Midrash Madness — Bracket Received</title></head>" +
                "<body style=\"margin:0;padding:0;background-color:#9a9ae9;font-family:'Times New Roman',Times,serif;\">" +
                "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">" +
                "<tr><td align=\"center\" style=\"padding:40px 20px;\">" +

                "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" " +
                "style=\"max-width:600px;background-color:#ffffff;border-radius:12px;" +
                "overflow:hidden;box-shadow:0 4px 24px rgba(69,69,241,0.18);\">" +

                // Header
                "<tr><td style=\"background-color:rgb(69,69,241);padding:32px 40px;text-align:center;\">" +
                "<h1 style=\"margin:0;font-family:cursive;font-size:36px;color:#ffffff;\">" +
                "Midrash Madness</h1>" +
                "</td></tr>" +

                // Body
                "<tr><td style=\"padding:36px 40px 28px 40px;\">" +
                "<p style=\"font-size:18px;color:#222;margin:0 0 16px 0;\">Dear " + safeName + ",</p>" +
                "<p style=\"font-size:17px;color:#333;line-height:1.7;margin:0 0 24px 0;\">" +
                "Thank you for participating in this year&#8217;s Midrash Madness competition. " +
                "We will notify you when the full results are tallied, but for now use the links " +
                "below to access the current results and to view your bracket." +
                "</p>" +

                // Buttons
                "<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 28px 0;\">" +
                "<tr>" +
                "<td style=\"padding-right:14px;\">" +
                "<a href=\"" + RESULTS_URL + "\" " +
                "style=\"display:inline-block;background-color:#4545f1;color:#fff;" +
                "text-decoration:none;font-family:'Times New Roman',Times,serif;font-size:17px;" +
                "padding:12px 24px;border-radius:6px;\">View Current Results</a>" +
                "</td>" +
                "<td>" +
                "<a href=\"" + bracketLink + "\" " +
                "style=\"display:inline-block;background-color:#4545f1;color:#fff;" +
                "text-decoration:none;font-family:'Times New Roman',Times,serif;font-size:17px;" +
                "padding:12px 24px;border-radius:6px;\">View My Bracket</a>" +
                "</td>" +
                "</tr></table>" +

                "<p style=\"font-size:17px;color:#333;line-height:1.7;margin:0;\">" +
                "Thank you,<br>" +
                "<strong>The Midrash Madness Team</strong>" +
                "</p>" +
                "</td></tr>" +

                // Footer
                "<tr><td style=\"background-color:rgb(154,154,233);padding:18px 40px;text-align:center;\">" +
                "<p style=\"margin:0;font-size:13px;color:#444;\">" +
                "You received this email because you submitted a bracket at " +
                "<a href=\"" + APP_URL + "\" style=\"color:#333;\">" + APP_URL + "</a>." +
                "</p>" +
                "</td></tr>" +

                "</table>" +
                "</td></tr></table>" +
                "</body></html>";
    }

    /**
     * Builds the plain-text fallback version of the confirmation email.
     * Shown by email clients that do not render HTML.
     */
    private String buildTextBody(String name, int bracketId) {
        String bracketLink = BRACKET_URL + bracketId;
        return "Dear " + name + ",\n\n" +
                "Thank you for participating in this year's Midrash Madness competition. " +
                "We will notify you when the full results are tallied, but for now use the " +
                "links below to access the current results and to view your bracket.\n\n" +
                "View Current Results:\n" + RESULTS_URL + "\n\n" +
                "View My Bracket:\n" + bracketLink + "\n\n" +
                "Thank you,\n" +
                "The Midrash Madness Team";
    }
}