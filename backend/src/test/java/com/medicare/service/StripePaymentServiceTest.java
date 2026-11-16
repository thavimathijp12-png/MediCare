package com.medicare.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicare.entity.Invoice;
import com.medicare.entity.Patient;
import com.medicare.entity.Role;
import com.medicare.entity.StripeProcessedEvent;
import com.medicare.entity.User;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.InvoiceRepository;
import com.medicare.repository.StripeProcessedEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StripePaymentServiceTest {

    private static final String WEBHOOK_SECRET = "whsec_unit_test_key";
    private InvoiceRepository invoiceRepository;
    private StripeProcessedEventRepository processedEventRepository;
    private StripePaymentService service;

    @BeforeEach
    void setUp() {
        invoiceRepository = mock(InvoiceRepository.class);
        processedEventRepository = mock(StripeProcessedEventRepository.class);
        service = new StripePaymentService(invoiceRepository, processedEventRepository, new ObjectMapper(),
                "sk_test_unit_test_key", WEBHOOK_SECRET,
                "http://localhost:5502/?payment=success", "http://localhost:5502/?payment=cancelled");
    }

    @Test
    void rejectsWebhookWithoutAValidStripeSignature() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.processWebhook("t=" + Instant.now().getEpochSecond() + ",v1=invalid", "{}"));
        assertEquals(400, exception.getStatusCode().value());
        verify(invoiceRepository, never()).findForUpdate(any());
    }

    @Test
    void ignoresSignedUnpaidCheckoutEventsWithoutChangingInvoiceStatus() {
        String payload = """
                {"id":"evt_unpaid","type":"checkout.session.completed",
                 "data":{"object":{"livemode":false,"payment_status":"unpaid",
                 "metadata":{"invoice_number":"INV-1"}}}}
                """;

        assertFalse(service.processWebhook(signature(payload), payload));
        verify(invoiceRepository, never()).findForUpdate(any());
        verify(processedEventRepository, never()).save(any(StripeProcessedEvent.class));
    }

    @Test
    void marksInvoicePaidOnlyForSignedPaidSandboxEventWithMatchingAmount() {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber("INV-1");
        invoice.setAmount(new BigDecimal("125.00"));
        invoice.setStatus("Pending");
        when(invoiceRepository.findForUpdate("INV-1")).thenReturn(Optional.of(invoice));
        when(processedEventRepository.existsById("evt_paid")).thenReturn(false);
        String payload = """
                {"id":"evt_paid","type":"checkout.session.completed",
                 "data":{"object":{"livemode":false,"payment_status":"paid",
                 "amount_total":12500,"currency":"usd",
                 "metadata":{"invoice_number":"INV-1"}}}}
                """;

        assertTrue(service.processWebhook(signature(payload), payload));
        assertEquals("Paid", invoice.getStatus());
        assertEquals("Stripe Test Mode", invoice.getMethod());
        verify(invoiceRepository).save(invoice);
        verify(processedEventRepository).save(any(StripeProcessedEvent.class));
    }

    @Test
    void refusesToCreateCheckoutWhenOnlyLiveKeysAreConfigured() {
        StripePaymentService liveKeyService = new StripePaymentService(invoiceRepository,
                processedEventRepository, new ObjectMapper(), "sk_live_never_use", WEBHOOK_SECRET,
                "https://example.test/success", "https://example.test/cancel");
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> liveKeyService.createCheckoutSession("INV-1", "patient@example.test"));
        assertEquals(503, exception.getStatusCode().value());
        verify(invoiceRepository, never()).findForCheckout(any());
    }

    @Test
    void doesNotAllowAnotherAccountToCreateCheckoutForAnInvoice() {
        User owner = new User(1L, "owner@example.test", "hash", "Invoice Owner", Role.PATIENT);
        Patient patient = new Patient();
        patient.setPatientAccount(owner);
        Invoice invoice = new Invoice();
        invoice.setPatient(patient);
        invoice.setInvoiceNumber("INV-OWNED");
        invoice.setStatus("Pending");
        invoice.setAmount(new BigDecimal("25.00"));
        when(invoiceRepository.findForCheckout("INV-OWNED")).thenReturn(Optional.of(invoice));

        assertThrows(ResourceNotFoundException.class,
                () -> service.createCheckoutSession("INV-OWNED", "another@example.test"));
    }

    private String signature(String payload) {
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(WEBHOOK_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String digest = HexFormat.of().formatHex(
                    mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
            return "t=" + timestamp + ",v1=" + digest;
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
