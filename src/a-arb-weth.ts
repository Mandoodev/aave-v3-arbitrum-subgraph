import { Upgraded as UpgradedEvent } from "../generated/aArbWETH/aArbWETH"
import { Upgraded } from "../generated/schema"

export function handleUpgraded(event: UpgradedEvent): void {
  let entity = new Upgraded(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.implementation = event.params.implementation

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

import { BalanceTransfer as BalanceTransferWETH } from "../generated/aArbWETH/aArbWETH";
import { User, Token, UserToken, UserTokenList, UserTokenSnapshot, GlobalCounter } from "../generated/schema";
import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";

let tokenMapping = new Map<string, string>();
tokenMapping.set('0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 'WETH');

let aTokenMapping = new Map<string, string>();
aTokenMapping.set('0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8', '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'); // aArbWETH -> WETH

let decimalMapping = new Map<string, i32>();
decimalMapping.set('0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 18); // WETH

export function handleBalanceTransferWETH(event: BalanceTransferWETH): void {
  let aTokenAddress = '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8';
  let underlyingTokenAddress = aTokenMapping.get(aTokenAddress);
  if (underlyingTokenAddress == null) return;

  let underlyingToken = updateToken(Address.fromString(underlyingTokenAddress));
  let fromUser = getUser(event.params.from.toHex());
  let toUser = getUser(event.params.to.toHex());

  let amount = event.params.value;
  // if (underlyingToken.decimals != 0) {  // Updated condition
  //   amount = amount.div(BigInt.fromI32(10).pow(underlyingToken.decimals as u8));
  // }

  let fromUserToken = getUserToken(fromUser, underlyingToken);
  fromUserToken.totalSupplied = fromUserToken.totalSupplied.minus(amount);
  fromUserToken.netSupplied = fromUserToken.netSupplied.minus(amount);
  fromUserToken.lastUpdated = event.block.timestamp;
  createUserTokenSnapshot(fromUserToken, event.block.number, event.block.timestamp, "Transfer-From");
  fromUserToken.save();

  let toUserToken = getUserToken(toUser, underlyingToken);
  toUserToken.totalSupplied = toUserToken.totalSupplied.plus(amount);
  toUserToken.netSupplied = toUserToken.netSupplied.plus(amount);
  toUserToken.lastUpdated = event.block.timestamp;
  createUserTokenSnapshot(toUserToken, event.block.number, event.block.timestamp, "Transfer-To");
  toUserToken.save();
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