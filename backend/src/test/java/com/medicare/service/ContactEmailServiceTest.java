package com.medicare.service;

import com.medicare.dto.ContactInquiryRequest;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.server.ResponseStatusException;

import java.util.Properties;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

class ContactEmailServiceTest {

    private static final String SMTP_PASSWORD = UUID.randomUUID().toString();
    private static final ContactInquiryRequest INQUIRY = new ContactInquiryRequest(
            "Jordan Example",
            "jordan@example.test",
            "+1 555 010 0100",
            "Cardiology",
            "Please contact me about office hours.");

    @Test
    void sendsPlainTextInquiryWithReplyToAndConfiguredRecipient() throws Exception {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);

        service(mailSender, "smtp.example.test", "mailer", SMTP_PASSWORD,
                "noreply@example.test", "support@example.test").send(INQUIRY);

        verify(mailSender).send(message);
        assertEquals("MediCare website inquiry", message.getSubject());
        assertEquals("support@example.test", message.getRecipients(MimeMessage.RecipientType.TO)[0].toString());
        assertEquals("jordan@example.test", message.getReplyTo()[0].toString());
    }

    @Test
    void refusesToReportSuccessWhenSmtpConfigurationIsMissing() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service(mailSender, "", "", "", "", "support@example.test").send(INQUIRY));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void returnsGenericDeliveryFailureWhenRelayRejectsMessage() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        when(mailSender.createMimeMessage())
                .thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        org.mockito.Mockito.doThrow(new MailSendException("relay failure"))
                .when(mailSender).send(any(MimeMessage.class));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service(mailSender, "smtp.example.test", "mailer", SMTP_PASSWORD,
                        "noreply@example.test", "support@example.test").send(INQUIRY));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        org.junit.jupiter.api.Assertions.assertFalse(error.getReason().contains(INQUIRY.email()));
    }

    private ContactEmailService service(
            JavaMailSender mailSender,
            String host,
            String username,
            String password,
            String from,
            String recipient) {
        return new ContactEmailService(mailSender, host, username, password, from, recipient);
    }
}
