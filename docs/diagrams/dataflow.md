```mermaid
flowchart TD
  U[Recipient Wallet User] --> P[Set RecipientPolicy on-chain]
  A[Agent/Advertiser] --> R[Submit paid AdNotificationRequest]
  R --> C[Solana Program]
  C --> W[Watcher/Indexer]
  W --> N[Notification Service]
  N --> UI[Companion App Popup]

  subgraph Future (Out of Scope)
    REP[Agent Reputation Ratings]
  end

  W -. roadmap .-> REP
```
