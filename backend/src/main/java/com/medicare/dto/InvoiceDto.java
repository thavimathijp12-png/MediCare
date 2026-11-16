package com.medicare.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public class InvoiceDto {
    private String id; // "INV-8901"
    private String patientId;

    @NotBlank
    @Size(max = 120)
    private String patientName;

    @NotBlank
    @Size(max = 100)
    private String department;

    @Size(max = 10)
    private String date;

    @DecimalMin(value = "0.00")
    private BigDecimal amount;
    private String status; // "Paid", "Pending", "Overdue"

    @Size(max = 40)
    private String method;

    @Valid
    private List<InvoiceItemDto> items;

    public InvoiceDto() {
    }

    public static class InvoiceItemDto {
        @NotBlank
        @Size(max = 240)
        private String desc;

        @NotNull
        @DecimalMin(value = "0.00")
        private BigDecimal cost;

        public InvoiceItemDto() {
        }

        public InvoiceItemDto(String desc, BigDecimal cost) {
            this.desc = desc;
            this.cost = cost;
        }

        public String getDesc() {
            return desc;
        }

        public void setDesc(String desc) {
            this.desc = desc;
        }

        public BigDecimal getCost() {
            return cost;
        }

        public void setCost(BigDecimal cost) {
            this.cost = cost;
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public List<InvoiceItemDto> getItems() {
        return items;
    }

    public void setItems(List<InvoiceItemDto> items) {
        this.items = items;
    }
}

