package com.medicare.service;

import com.medicare.entity.RevokedToken;
import com.medicare.repository.RevokedTokenRepository;
import com.medicare.security.JwtTokenUtil;
import io.jsonwebtoken.Claims;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Date;

@Service
public class TokenRevocationService {
    private final RevokedTokenRepository revokedTokenRepository;
    private final JwtTokenUtil jwtTokenUtil;

    public TokenRevocationService(RevokedTokenRepository revokedTokenRepository, JwtTokenUtil jwtTokenUtil) {
        this.revokedTokenRepository = revokedTokenRepository;
        this.jwtTokenUtil = jwtTokenUtil;
    }

    @Transactional
    public void revoke(String token) {
        Claims claims = jwtTokenUtil.getAllClaimsFromToken(token);
        String tokenId = claims.getId();
        Date expiration = claims.getExpiration();
        if (tokenId == null || expiration == null) {
            throw new IllegalArgumentException("The access token cannot be revoked.");
        }
        revokedTokenRepository.save(new RevokedToken(tokenId, expiration.toInstant()));
    }

    @Transactional
    public boolean isRevoked(String tokenId) {
        return revokedTokenRepository.findById(tokenId)
                .map(revoked -> {
                    if (!revoked.getExpiresAt().isAfter(Instant.now())) {
                        revokedTokenRepository.delete(revoked);
                        return false;
                    }
                    return true;
                })
                .orElse(false);
    }
}
