package com.medicare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicare.dto.ApiErrorResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/contact").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments/stripe/webhook").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/appointments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/doctors/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/departments/**").permitAll()
                        .requestMatchers("/api/auth/**").authenticated()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/dashboard/**", "/api/activity/**").hasRole("ADMIN")
                        .requestMatchers("/api/billing/**").hasAnyRole("ADMIN", "RECEPTIONIST")
                        .requestMatchers("/api/patient-portal/**").hasRole("PATIENT")
                        .requestMatchers("/api/departments/**").hasRole("ADMIN")
                        .requestMatchers("/api/doctors/**").hasRole("ADMIN")
                        .requestMatchers("/api/patients/**")
                        .hasAnyRole("ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "PATIENT")
                        .requestMatchers("/api/appointments/**")
                        .hasAnyRole("ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE")
                        .anyRequest().denyAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, exception) -> {
            response.setStatus(401);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(),
                    new ApiErrorResponse(401, "Unauthorized", "Authentication is required for this resource."));
        };
    }

    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, exception) -> {
            response.setStatus(403);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(),
                    new ApiErrorResponse(403, "Forbidden", "You do not have permission to access this resource."));
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}

