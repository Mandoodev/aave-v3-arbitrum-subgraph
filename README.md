### Aave V3 Arbitrum Subgraph


**Overview**

This subgraph aims to track the net supplied amount of users on Aave V3 Arbitrum.

**Key Features**

Subgraph
- Tracks net supplied amount (total supplied - total borrowed) of each User-Token.
- Handles Supply / Withdraw / Borrow / Repay / Liquidation events of the Lending Pool.
- Handles Interest earned/accrued from supplying/borrowing when the ReserveDataUpdated event of the Lending Pool occurs.
- Handles ATokens BalanceTransfer events of the aArbWETH, aArbUSDC and aArbUSDT contracts.
