package com.medicare.repository;

import com.medicare.entity.ActivityRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityRepository extends JpaRepository<ActivityRecord, Long> {
    List<ActivityRecord> findAllByOrderByTimestampDesc(Pageable pageable);

    default List<ActivityRecord> findTop(int limit) {
        return findAllByOrderByTimestampDesc(Pageable.ofSize(Math.max(limit, 1)));
    }
}
