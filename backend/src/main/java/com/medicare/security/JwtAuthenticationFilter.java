package com.medicare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicare.dto.ApiErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.jsonwebtoken.JwtException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.medicare.service.TokenRevocationService;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenUtil jwtTokenUtil;
    private final CustomUserDetailsService userDetailsService;
    private final TokenRevocationService tokenRevocationService;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtTokenUtil jwtTokenUtil,
                                   CustomUserDetailsService userDetailsService,
                                   TokenRevocationService tokenRevocationService,
                                   ObjectMapper objectMapper) {
        this.jwtTokenUtil = jwtTokenUtil;
        this.userDetailsService = userDetailsService;
        this.tokenRevocationService = tokenRevocationService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!authHeader.startsWith("Bearer ") || authHeader.length() <= 7) {
            writeUnauthorized(response);
            return;
        }

        final String jwtToken = authHeader.substring(7).trim();
        try {
            String username = jwtTokenUtil.getUsernameFromToken(jwtToken);
            String tokenId = jwtTokenUtil.getTokenIdFromToken(jwtToken);
            if (username == null || tokenId == null || tokenRevocationService.isRevoked(tokenId)) {
                writeUnauthorized(response);
                return;
            }

            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (!jwtTokenUtil.validateToken(jwtToken, userDetails) || !userDetails.isEnabled()) {
                writeUnauthorized(response);
                return;
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (JwtException | IllegalArgumentException | AuthenticationException ex) {
            SecurityContextHolder.clearContext();
            writeUnauthorized(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getOutputStream(),
                new ApiErrorResponse(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized",
                        "The access token is invalid, expired, or revoked."));
    }
}

