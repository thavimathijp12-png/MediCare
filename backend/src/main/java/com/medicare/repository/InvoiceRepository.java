package com.medicare.repository;

import com.medicare.entity.Invoice;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    Optional<Invoice> findByInvoiceNumberIgnoreCase(String invoiceNumber);

    List<Invoice> findByPatient_IdOrderByDateDesc(Long patientId);

    @Query("select i from Invoice i join fetch i.patient p join fetch p.patientAccount "
            + "where lower(i.invoiceNumber) = lower(:invoiceNumber)")
    Optional<Invoice> findForCheckout(@Param("invoiceNumber") String invoiceNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where lower(i.invoiceNumber) = lower(:invoiceNumber)")
    Optional<Invoice> findForUpdate(@Param("invoiceNumber") String invoiceNumber);

    default Optional<Invoice> findByInvoiceNumber(String invoiceNumber) {
        return findByInvoiceNumberIgnoreCase(invoiceNumber);
    }

    @Query("select coalesce(sum(i.amount), 0) from Invoice i where lower(i.status) = 'paid'")
    BigDecimal sumPaid();

    @Query("select coalesce(sum(i.amount), 0) from Invoice i")
    BigDecimal sumTotal();

    @Query("select coalesce(sum(i.amount), 0) from Invoice i where lower(i.status) <> 'paid'")
    BigDecimal sumOutstanding();
}
