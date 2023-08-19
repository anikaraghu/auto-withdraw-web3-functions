import { Log } from "@ethersproject/providers";
import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { initDb } from "../utils/db.js";
import { Contract } from "@ethersproject/contracts";

const MAX_RANGE = 100; // limit range of events to comply with rpc providers
const MAX_REQUESTS = 100; // limit number of requests on every execution to avoid hitting timeout
const WITHDRAWAL_ABI = ["event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData);"];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { secrets, storage, multiChainProvider } = context;

  const provider = multiChainProvider.default();

  // User Secrets
  const PRIVATE_KEY = (await secrets.get("PRIVATE_KEY_POLYBASE")) as string;
  const PUBLIC_KEY = (await secrets.get("PUBLIC_KEY_POLYBASE")) as string;

  const bridgeAddress = "0x4200000000000000000000000000000000000010";
  const l2StandardBridge = new Contract(bridgeAddress, WITHDRAWAL_ABI, provider);
  const topics = [l2StandardBridge.interface.getEventTopic("ETHBridgeInitiated")];
  const currentBlock = await provider.getBlockNumber();

  // Retrieve last processed block number & nb events matched from storage
  const lastBlockStr = await storage.get("lastBlockNumber");
  let lastBlock = lastBlockStr ? parseInt(lastBlockStr) : currentBlock - 2000;
  console.log(`Last processed block: ${lastBlock}`); 
  console.log(`Current block: ${currentBlock}`);

  // Fetch recent logs in range of 100 blocks
  const logs: Log[] = [];
  let nbRequests = 0;
  
  while (lastBlock < currentBlock && nbRequests < MAX_REQUESTS) {
    nbRequests++;
    const fromBlock = lastBlock + 1;
    const toBlock = Math.min(fromBlock + MAX_RANGE, currentBlock);
    console.log(`Fetching log events from blocks ${fromBlock} to ${toBlock}`);
    try {
      const eventFilter = {
        address: bridgeAddress,
        topics,
        fromBlock,
        toBlock,
      };
      const result = await provider.getLogs(eventFilter);
      logs.push(...result);
      lastBlock = toBlock;
    } catch (err) {
      return {
        canExec: false,
        message: `Rpc call failed: ${(err as Error).message}`,
      };
    }
  }

  // Update storage for next run
  await storage.set("lastBlockNumber", lastBlock.toString());

  if (logs.length == 0) {
    return {
      canExec: false,
      message: `No new withdrawals. Updated block number: ${lastBlock.toString()}`
    };
  }

  const db = await initDb(PRIVATE_KEY, PUBLIC_KEY);
  const collFunders = db.collection("WithdrawalFunders");
  const collWithdrawals = db.collection("Withdrawal");

  async function updateWithdrawals(withdrawer: string, txHash: string) {
    const withdrawerFunded = await collFunders.record(withdrawer).get();
    // Only pay attention to this withdrawal if it's been prefunded
    if (withdrawerFunded.exists()) {
      await collWithdrawals.create([withdrawer, txHash, "initated"]);
    }
  }

  // Parse retrieved events
  console.log(`Matched ${logs.length} new events`);
  for (const log of logs) {
    const event = l2StandardBridge.interface.parseLog(log);
    const [from, to, amount, extraData] = event.args;
    console.log(
      `Withdrawal initiated from ${from}$ of amount: ${amount}`
    );

    // TODO: get txHash
    updateWithdrawals(from, txHash);
  }

  return {
    canExec: false,
    message: `Updated block number: ${lastBlock.toString()}`
  };
});
