package com.medicare.service;

import com.medicare.dto.ContactInquiryRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;

@Service
public class ContactEmailService {

    private final JavaMailSender mailSender;
    private final String smtpHost;
    private final String smtpUsername;
    private final String smtpPassword;
    private final String fromAddress;
    private final String recipientAddress;

    public ContactEmailService(
            JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.password:}") String smtpPassword,
            @Value("${medicare.contact.from:}") String fromAddress,
            @Value("${medicare.contact.recipient:}") String recipientAddress) {
        this.mailSender = mailSender;
        this.smtpHost = smtpHost;
        this.smtpUsername = smtpUsername;
        this.smtpPassword = smtpPassword;
        this.fromAddress = fromAddress;
        this.recipientAddress = recipientAddress;
    }

    public void send(ContactInquiryRequest inquiry) {
        if (smtpHost.isBlank() || smtpUsername.isBlank() || smtpPassword.isBlank()
                || fromAddress.isBlank() || recipientAddress.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Contact email delivery is not configured.");
        }

        MimeMessage message = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress);
            helper.setTo(recipientAddress);
            helper.setReplyTo(inquiry.email().trim());
            helper.setSubject("MediCare website inquiry");
            helper.setText("""
                    Name: %s
                    Phone: %s
                    Email: %s
                    Department: %s

                    Message:
                    %s
                    """.formatted(
                    inquiry.name().trim(),
                    inquiry.phone().trim(),
                    inquiry.email().trim(),
                    inquiry.department().trim(),
                    inquiry.message().trim()), false);
        } catch (MessagingException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Contact email could not be prepared. Please try again later.");
        }

        try {
            mailSender.send(message);
        } catch (MailException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Contact email could not be delivered. Please try again later.");
        }
    }
}
