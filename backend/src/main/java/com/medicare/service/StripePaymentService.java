package com.medicare.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicare.dto.CheckoutSessionResponse;
import com.medicare.entity.Invoice;
import com.medicare.entity.StripeProcessedEvent;
import com.medicare.exception.ResourceNotFoundException;
import com.medicare.repository.InvoiceRepository;
import com.medicare.repository.StripeProcessedEventRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.http.HttpClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;

@Service
public class StripePaymentService {

    private static final long SIGNATURE_TOLERANCE_SECONDS = 300;
    private static final String STRIPE_CHECKOUT_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";
    private static final Logger LOGGER = LoggerFactory.getLogger(StripePaymentService.class);

    private final InvoiceRepository invoiceRepository;
    private final StripeProcessedEventRepository processedEventRepository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String secretKey;
    private final String webhookSecret;
    private final String successUrl;
    private final String cancelUrl;

    public StripePaymentService(
            InvoiceRepository invoiceRepository,
            StripeProcessedEventRepository processedEventRepository,
            ObjectMapper objectMapper,
            @Value("${medicare.payments.stripe-secret-key:}") String secretKey,
            @Value("${medicare.payments.stripe-webhook-secret:}") String webhookSecret,
            @Value("${medicare.payments.success-url}") String successUrl,
            @Value("${medicare.payments.cancel-url}") String cancelUrl) {
        this.invoiceRepository = invoiceRepository;
        this.processedEventRepository = processedEventRepository;
        this.objectMapper = objectMapper;
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
        this.secretKey = secretKey;
        this.webhookSecret = webhookSecret;
        this.successUrl = successUrl;
        this.cancelUrl = cancelUrl;
    }

    @Transactional(readOnly = true)
    public CheckoutSessionResponse createCheckoutSession(String invoiceNumber, String patientEmail) {
        requireTestSecret();
        Invoice invoice = invoiceRepository.findForCheckout(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("The invoice is not available for this account."));
        String invoiceStatus = invoice.getStatus();
        if (!invoice.getPatient().getPatientAccount().getEmail().equalsIgnoreCase(patientEmail)
                || !("Pending".equalsIgnoreCase(invoiceStatus) || "Overdue".equalsIgnoreCase(invoiceStatus))) {
            throw new ResourceNotFoundException("The invoice is not available for this account.");
        }

        long amountInCents;
        try {
            amountInCents = invoice.getAmount().setScale(2, RoundingMode.UNNECESSARY)
                    .movePointRight(2).longValueExact();
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The invoice amount cannot be represented as a supported payment amount.");
        }
        if (amountInCents < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The invoice amount must be greater than zero.");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("mode", "payment");
        form.add("success_url", successUrl);
        form.add("cancel_url", cancelUrl);
        form.add("client_reference_id", invoice.getInvoiceNumber());
        form.add("metadata[invoice_number]", invoice.getInvoiceNumber());
        form.add("metadata[invoice_id]", invoice.getId().toString());
        form.add("line_items[0][price_data][currency]", "usd");
        form.add("line_items[0][price_data][product_data][name]", "MediCare invoice " + invoice.getInvoiceNumber());
        form.add("line_items[0][price_data][unit_amount]", Long.toString(amountInCents));
        form.add("line_items[0][quantity]", "1");

        try {
            JsonNode response = restClient.post()
                    .uri(STRIPE_CHECKOUT_SESSIONS_URL)
                    .header("Authorization", "Bearer " + secretKey)
                    .header("Idempotency-Key", "medicare-invoice-" + invoice.getId() + "-" + amountInCents)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null || !response.path("id").isTextual() || !response.path("url").isTextual()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "The payment provider returned an invalid checkout response.");
            }
            return new CheckoutSessionResponse(response.path("id").asText(), response.path("url").asText());
        } catch (RestClientException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "The payment provider could not create a checkout session.");
        }
    }

    @Transactional
    public boolean processWebhook(String signatureHeader, String payload) {
        verifyTestWebhook(signatureHeader, payload);
        JsonNode event;
        try {
            event = objectMapper.readTree(payload);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment event is invalid.");
        }
        if (!"checkout.session.completed".equals(event.path("type").asText())) {
            return false;
        }

        JsonNode session = event.path("data").path("object");
        if (session.path("livemode").asBoolean(true)
                || !"paid".equals(session.path("payment_status").asText())) {
            return false;
        }
        String eventId = event.path("id").asText("");
        String invoiceNumber = session.path("metadata").path("invoice_number").asText("");
        if (eventId.isBlank() || invoiceNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment event is incomplete.");
        }

        Invoice invoice = invoiceRepository.findForUpdate(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("The invoice was not found."));
        if (processedEventRepository.existsById(eventId)) {
            return false;
        }

        long expectedAmount;
        try {
            expectedAmount = invoice.getAmount().setScale(2, RoundingMode.UNNECESSARY)
                    .movePointRight(2).longValueExact();
        } catch (ArithmeticException exception) {
            return false;
        }
        if (session.path("amount_total").asLong(-1) != expectedAmount
                || !"usd".equalsIgnoreCase(session.path("currency").asText())) {
            LOGGER.warn("Ignoring signed Stripe event {} because its amount or currency does not match the invoice.",
                    eventId);
            return false;
        }
        if ("Paid".equalsIgnoreCase(invoice.getStatus())) {
            processedEventRepository.save(new StripeProcessedEvent(eventId));
            return false;
        }

        invoice.setStatus("Paid");
        invoice.setMethod("Stripe Test Mode");
        invoiceRepository.save(invoice);
        processedEventRepository.save(new StripeProcessedEvent(eventId));
        return true;
    }

    private void requireTestSecret() {
        if (secretKey == null || !secretKey.startsWith("sk_test_")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Stripe test-mode payments are not configured.");
        }
    }

    private void verifyTestWebhook(String signatureHeader, String payload) {
        requireTestSecret();
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Stripe webhook verification is not configured.");
        }
        if (signatureHeader == null || signatureHeader.isBlank() || payload == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment signature is required.");
        }

        String timestamp = null;
        List<String> signatures = new java.util.ArrayList<>();
        for (String part : signatureHeader.split(",")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length != 2) {
                continue;
            }
            if ("t".equals(pair[0])) {
                timestamp = pair[1];
            } else if ("v1".equals(pair[0])) {
                signatures.add(pair[1]);
            }
        }
        long eventTimestamp;
        try {
            eventTimestamp = Long.parseLong(timestamp);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment signature is invalid.");
        }
        long now = Instant.now().getEpochSecond();
        if (eventTimestamp < now - SIGNATURE_TOLERANCE_SECONDS
                || eventTimestamp > now + SIGNATURE_TOLERANCE_SECONDS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment signature has expired.");
        }

        String expectedSignature = hmacSha256(webhookSecret, timestamp + "." + payload);
        boolean valid = false;
        for (String signature : signatures) {
            valid |= MessageDigest.isEqual(expectedSignature.getBytes(StandardCharsets.US_ASCII),
                    signature.getBytes(StandardCharsets.US_ASCII));
        }
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment signature is invalid.");
        }
    }

    private String hmacSha256(String secret, String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable.", exception);
        }
    }
}
