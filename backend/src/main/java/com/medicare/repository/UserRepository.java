package com.medicare.repository;

import com.medicare.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);

    default Optional<User> findByEmail(String email) {
        return findByEmailIgnoreCase(email);
    }
}
