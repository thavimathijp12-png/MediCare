package com.medicare.config;

import com.medicare.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class BootstrapAdminInitializerTest {

    @Test
    void refusesToStartWhenBootstrapCredentialsAreMissingOrIncomplete() {
        BootstrapAdminInitializer missing = new BootstrapAdminInitializer(
                mock(UserRepository.class), new BCryptPasswordEncoder(), null, null);
        BootstrapAdminInitializer incomplete = new BootstrapAdminInitializer(
                mock(UserRepository.class), new BCryptPasswordEncoder(), "admin@medicare.test", null);
        DefaultApplicationArguments arguments = new DefaultApplicationArguments(new String[0]);

        assertThrows(IllegalStateException.class, () -> missing.run(arguments));
        assertThrows(IllegalStateException.class, () -> incomplete.run(arguments));
    }
}
