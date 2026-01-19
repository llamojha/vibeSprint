# Phase 4: Event-Driven Mode (REJECTED)

## Status: Considered but rejected in favor of polling approach

**Decision**: After architectural review, webhooks were intentionally excluded to maintain the "zero-config local CLI" user experience. Polling provides the optimal balance of simplicity and functionality for the target use case.

**Rationale**: 
- Webhooks require public endpoints or tunneling (ngrok, cloudflare)
- Conflicts with "just npm install and run" goal
- Polling delay (30-60s) is acceptable for the automation use case
- Eliminates infrastructure complexity and setup friction

## Original Scope (For Reference)
Replace polling with real-time webhook-based triggering for instant response.

### Why This Was Considered
- Instant response vs polling delay
- Reduced API calls and rate limit pressure
- More "reactive" architecture

### Why This Was Rejected
- **User Experience**: Requires additional setup (tunnels, public endpoints)
- **Complexity**: HTTP server, signature verification, hybrid modes
- **Target Audience**: Solo developers want simplicity over millisecond response times
- **Value vs Cost**: 30-60s polling delay acceptable for issue-to-PR automation

## Alternative Considered
GitHub Actions self-hosted runner approach was also evaluated but rejected for similar complexity reasons.

**Final Architecture**: Polling-only for maximum simplicity and zero-config experience.
