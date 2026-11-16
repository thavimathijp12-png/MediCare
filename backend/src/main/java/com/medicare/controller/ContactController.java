package com.medicare.controller;

import com.medicare.dto.ContactInquiryRequest;
import com.medicare.service.ContactEmailService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/contact")
public class ContactController {

    private final ContactEmailService contactEmailService;

    public ContactController(ContactEmailService contactEmailService) {
        this.contactEmailService = contactEmailService;
    }

    @PostMapping
    public ResponseEntity<Void> submitInquiry(@Valid @RequestBody ContactInquiryRequest inquiry) {
        contactEmailService.send(inquiry);
        return ResponseEntity.noContent().build();
    }
}
