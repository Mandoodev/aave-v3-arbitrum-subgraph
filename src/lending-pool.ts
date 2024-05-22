import { Upgraded as UpgradedEvent } from "../generated/Lending-Pool/Lending_Pool";
import { Upgraded } from "../generated/schema";
import { BigInt, ethereum, Address } from "@graphprotocol/graph-ts";
import { Supply, Withdraw, Borrow, Repay, LiquidationCall, ReserveDataUpdated } from "../generated/Lending-Pool/Lending_Pool";
import { Block, User, Token, UserToken, UserTokenList, UserTokenSnapshot, Reserve, GlobalCounter } from "../generated/schema";

let tokenMapping = new Map<string, string>();
tokenMapping.set('0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', 'USDC');
tokenMapping.set('0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 'WETH');
tokenMapping.set('0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', 'USDT');
tokenMapping.set('0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 'WBTC');
tokenMapping.set('0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 'DAI');
tokenMapping.set('0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 'LINK');

let decimalMapping = new Map<string, i32>();
decimalMapping.set('0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', 6);  // USDC
decimalMapping.set('0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 18); // WETH
decimalMapping.set('0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', 6);  // USDT
decimalMapping.set('0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 8);  // WBTC
decimalMapping.set('0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 18);  // LINK


export function handleUpgraded(event: UpgradedEvent): void {
  let entity = new Upgraded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.implementation = event.params.implementation;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleBlock(block: ethereum.Block): void {
  let entity = new Block(block.hash.toHex());
  entity.number = block.number;
  entity.timestamp = block.timestamp;
  entity.save();
}

export function handleSupply(event: Supply): void {
  let token = updateToken(event.params.reserve);
  let user = getUser(event.params.onBehalfOf.toHex());
  let userToken = getUserToken(user, token);

  let amount = event.params.amount;
  // if (token.decimals != 0) {
  //   amount = amount.div(BigInt.fromI32(10).pow(u8(token.decimals as u8)));
  // }

  userToken.totalSupplied = userToken.totalSupplied.plus(amount);
  userToken.netSupplied = userToken.netSupplied.plus(amount);
  userToken.lastUpdated = event.block.timestamp;
  createUserTokenSnapshot(userToken, event.block.number, event.block.timestamp, "Supply");
  userToken.save();
}

export function handleWithdraw(event: Withdraw): void {
  let token = updateToken(event.params.reserve);
  let user = getUser(event.params.to.toHex());
  let userToken = getUserToken(user, token);

  let amount = event.params.amount;
  // if (token.decimals != 0) {
  //   amount = amount.div(BigInt.fromI32(10).pow(u8(token.decimals as u8)));
  // }

  userToken.totalSupplied = userToken.totalSupplied.minus(amount);
  userToken.netSupplied = userToken.netSupplied.minus(amount);
  userToken.lastUpdated = event.block.timestamp;

  createUserTokenSnapshot(userToken, event.block.number, event.block.timestamp, "Withdraw");
  userToken.save();
}

export function handleBorrow(event: Borrow): void {
  let token = updateToken(event.params.reserve);
  let user = getUser(event.params.onBehalfOf.toHex());
  let userToken = getUserToken(user, token);

  let amount = event.params.amount;
  // if (token.decimals != 0) {
  //   amount = amount.div(BigInt.fromI32(10).pow(u8(token.decimals as u8)));
  // }

  userToken.totalBorrowed = userToken.totalBorrowed.plus(amount);
  userToken.netSupplied = userToken.netSupplied.minus(amount);
  userToken.lastUpdated = event.block.timestamp;
 
  createUserTokenSnapshot(userToken, event.block.number, event.block.timestamp, "Borrow");
  userToken.save();
}

export function handleRepay(event: Repay): void {
  let token = updateToken(event.params.reserve);
  let user = getUser(event.params.user.toHex());
  let userToken = getUserToken(user, token);

  let amount = event.params.amount;
  // if (token.decimals != 0) {
  //   amount = amount.div(BigInt.fromI32(10).pow(u8(token.decimals as u8)));
  // }

  userToken.totalBorrowed = userToken.totalBorrowed.minus(amount);
  userToken.netSupplied = userToken.netSupplied.plus(amount);
  userToken.lastUpdated = event.block.timestamp;

  createUserTokenSnapshot(userToken, event.block.number, event.block.timestamp, "Repay");
  userToken.save();
}

export function handleLiquidationCall(event: LiquidationCall): void {
  let collateralToken = updateToken(event.params.collateralAsset);
  let debtToken = updateToken(event.params.debtAsset);

  let user = getUser(event.params.user.toHex());

  let collateralUserToken = getUserToken(user, collateralToken);
  let debtUserToken = getUserToken(user, debtToken);

  let collateralAmount = event.params.liquidatedCollateralAmount;
  let debtAmount = event.params.debtToCover;

  // if (collateralToken.decimals != 0) {
  //   collateralAmount = collateralAmount.div(BigInt.fromI32(10).pow(u8(collateralToken.decimals as u8)));
  // }

  // if (debtToken.decimals != 0) {
  //   debtAmount = debtAmount.div(BigInt.fromI32(10).pow(u8(debtToken.decimals as u8)));
  // }

  collateralUserToken.totalSupplied = collateralUserToken.totalSupplied.minus(collateralAmount);
  collateralUserToken.netSupplied = collateralUserToken.netSupplied.minus(collateralAmount);
  collateralUserToken.lastUpdated = event.block.timestamp;
  createUserTokenSnapshot(collateralUserToken, event.block.number, event.block.timestamp, "LiquidationCall-collateralUser");
  collateralUserToken.save();

  debtUserToken.totalBorrowed = debtUserToken.totalBorrowed.minus(debtAmount);
  debtUserToken.netSupplied = debtUserToken.netSupplied.plus(debtAmount);
  debtUserToken.lastUpdated = event.block.timestamp;
  createUserTokenSnapshot(debtUserToken, event.block.number, event.block.timestamp, "LiquidationCall-debtUser");
  debtUserToken.save();
}

export function handleReserveDataUpdated(event: ReserveDataUpdated): void {
  let reserve = Reserve.load(event.params.reserve.toHex());
  if (reserve == null) {
    reserve = new Reserve(event.params.reserve.toHex());
    reserve.address = event.params.reserve;
    
    // Check if the key exists in tokenMapping before getting the value
    if (tokenMapping.has(event.params.reserve.toHex())) {
      reserve.symbol = tokenMapping.get(event.params.reserve.toHex());
    } else {
      // Handle the case where the key does not exist
      reserve.symbol = 'UNKNOWN';
    }
    
    // Check if the key exists in decimalMapping before getting the value
    if (decimalMapping.has(event.params.reserve.toHex())) {
      reserve.decimals = decimalMapping.get(event.params.reserve.toHex());
    } else {
      // Handle the case where the key does not exist
      reserve.decimals = 0; // Assuming a default of 0 decimals
    }
  }

  reserve.liquidityRate = event.params.liquidityRate;
  reserve.stableBorrowRate = event.params.stableBorrowRate;
  reserve.variableBorrowRate = event.params.variableBorrowRate;
  reserve.liquidityIndex = event.params.liquidityIndex;
  reserve.variableBorrowIndex = event.params.variableBorrowIndex;
  reserve.lastUpdateTimestamp = event.block.timestamp;

  reserve.save();

  let globalCounter = getGlobalCounter()
  for (let i = 0; i < globalCounter.userTokenIndexCounter; i++) {
    let userTokenList = UserTokenList.load(i.toString());
    if (userTokenList != null) {
      let userToken = UserToken.load(userTokenList.userTokenId);
      if (userToken != null && (userToken.token == reserve.id.toString())) {

      calculateAccruedInterest(userToken, reserve, event.block.number, event.block.timestamp);
      }
    }
  }
}

function calculateAccruedInterest(userToken: UserToken, reserve: Reserve, blockNumber: BigInt, blockTimestamp: BigInt): void {
  let currentLiquidityIndex = reserve.liquidityIndex;
  let currentBorrowIndex = reserve.variableBorrowIndex;

  let interestEarned = userToken.totalSupplied.times(currentLiquidityIndex).div(reserve.liquidityIndex).minus(userToken.totalSupplied);
  let interestAccrued = userToken.totalBorrowed.times(currentBorrowIndex).div(reserve.variableBorrowIndex).minus(userToken.totalBorrowed);

  userToken.totalSupplied = userToken.totalSupplied.plus(interestEarned);
  userToken.totalBorrowed = userToken.totalBorrowed.plus(interestAccrued);

  userToken.netSupplied = userToken.netSupplied.plus(interestEarned).minus(interestAccrued);
  userToken.lastUpdated = blockTimestamp;

  createUserTokenSnapshot(userToken, blockNumber, blockTimestamp, "Interest");
  userToken.save();
}

function getUser(userId: string): User {
  let user = User.load(userId);
  if (user == null) {
    user = new User(userId);
    user.save();
  }
  return user;
}

function getUserToken(user: User, token: Token): UserToken {
  let userTokenId = user.id + "-" + token.id;
  let userToken = UserToken.load(userTokenId);
  if (userToken == null) {
    userToken = new UserToken(userTokenId);
    userToken.user = user.id;
    userToken.token = token.id;
    userToken.totalSupplied = BigInt.fromI32(0);
    userToken.totalBorrowed = BigInt.fromI32(0);
    userToken.netSupplied = BigInt.fromI32(0);
    userToken.lastUpdated = BigInt.fromI32(0);

    let globalCounter = getGlobalCounter();
    userToken.index = globalCounter.userTokenIndexCounter;
    globalCounter.userTokenIndexCounter += 1;
    globalCounter.save();

    userToken.save();

    // Update UserTokenList with new UserToken
    updateUserTokenList(userToken);
  }
  return userToken;
}

function updateUserTokenList(userToken: UserToken): void {
  let userTokenList = UserTokenList.load(userToken.index.toString());
  if (userTokenList == null) {
    userTokenList = new UserTokenList(userToken.index.toString());
    userTokenList.userTokenId = userToken.id;
    userTokenList.save();
  }
}

function updateToken(address: Address): Token {
  let token = Token.load(address.toHex());
  if (token == null) {
    token = new Token(address.toHex());
    token.address = address;
    token.symbol = tokenMapping.has(address.toHex()) ? tokenMapping.get(address.toHex()) : 'UNKNOWN';
    token.decimals = decimalMapping.has(address.toHex()) ? decimalMapping.get(address.toHex()) : 0;
    token.save();
  }
  return token;
}

function getGlobalCounter(): GlobalCounter {
  let globalCounter = GlobalCounter.load("global");
  if (globalCounter == null) {
    globalCounter = new GlobalCounter("global");
    globalCounter.userTokenIndexCounter = 0;
    globalCounter.save();
  }
  return globalCounter;
}

function createUserTokenSnapshot(userToken: UserToken, blockNumber: BigInt, blockTimestamp: BigInt, eventName: string): void {
  let snapshotId = userToken.id + "-" + blockNumber.toString();
  let snapshot = new UserTokenSnapshot(snapshotId);
  snapshot.userToken = userToken.id;
  snapshot.event = eventName;
  snapshot.totalSupplied = userToken.totalSupplied;
  snapshot.totalBorrowed = userToken.totalBorrowed;
  snapshot.netSupplied = userToken.netSupplied;
  snapshot.blockNumber = blockNumber;
  snapshot.blockTimestamp = blockTimestamp;
  snapshot.save();
}