# PRD — Paid Agent Advertisement Notifications

## Executive Summary
A paid-notification channel where wallet users price inbound ad attention and define policy constraints before ads are surfaced.

## Problem
Agent outreach can scale faster than user moderation. Existing channels are reactive against spam and rarely let users price their attention.

## Goals (MVP)
1. Let users publish ad-notification policies.
2. Require payment before recording ad notification requests.
3. Surface only policy-compliant paid requests.
4. Keep interaction notification-first (not full DM/inbox).

## MVP Scope
- Recipient policy account creation/update.
- Paid ad request account creation.
- Watcher that filters + triggers notifications.
- Recipient actions: open, dismiss, block sender.

## Non-goals (MVP)
- Sender staking/reputation enforcement.
- Privacy-preserving recipient obfuscation.
- ZK proof of delivery.

## Future Feature (explicitly out of scope)
### Agent Reputation Ratings
A recipient and system-signal based scoring model for senders/agents to further reduce spam and improve trust. Not required for hackathon delivery.
