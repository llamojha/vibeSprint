Security-focused review of staged changes.

**Auto-scan:** Git staged changes (`git diff --cached`)

**Review for:**
1. **Secrets** — Hardcoded credentials, API keys, tokens
2. **Auth/Authz** — Authentication and authorization gaps
3. **Input Validation** — Injection vectors, unsanitized input
4. **Least Privilege** — Excessive permissions, broad access
5. **Sensitive Data Logging** — PII/secrets in logs
6. **Dependency Risk** — Known vulnerabilities, supply chain concerns

**Output for each finding:**
- Risk level: Critical / High / Medium / Low
- Location: File and line
- Issue description
- Mitigation recommendation
