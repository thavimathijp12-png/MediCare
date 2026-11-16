package com.medicare.config;

import com.medicare.entity.Role;
import com.medicare.entity.User;
import com.medicare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Component
@Profile("!test")
public class BootstrapAdminInitializer implements ApplicationRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public BootstrapAdminInitializer(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${MEDICARE_BOOTSTRAP_ADMIN_EMAIL:}") String email,
            @Value("${MEDICARE_BOOTSTRAP_ADMIN_PASSWORD:}") String password) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new IllegalStateException(
                    "Bootstrap administrator credentials must be provided via MEDICARE_BOOTSTRAP_ADMIN_EMAIL and MEDICARE_BOOTSTRAP_ADMIN_PASSWORD.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("The bootstrap administrator password must contain 12 to 72 UTF-8 bytes.");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            return;
        }
        userRepository.save(new User(null, normalizedEmail, passwordEncoder.encode(password),
                "System Administrator", Role.ADMIN));
    }
}
