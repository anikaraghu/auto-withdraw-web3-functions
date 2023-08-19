import { Log } from "@ethersproject/providers";
import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";
import { initDb } from "../utils/db.js";
import { BigNumber } from "ethers";

const MAX_RANGE = 100; // limit range of events to comply with rpc providers
const MAX_REQUESTS = 1; // limit number of requests on every execution to avoid hitting timeout
const AUTO_WITHDRAWER_ABI = [
  "event WithdrawalFunded(address indexed _depositor, address indexed _withdrawer, uint256 _amount)",
];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { secrets, storage, multiChainProvider } = context;

  // User Secrets
  const PRIVATE_KEY = (await secrets.get("PRIVATE_KEY_POLYBASE")) as string;
  const PUBLIC_KEY = (await secrets.get("PUBLIC_KEY_POLYBASE")) as string;

  const provider = multiChainProvider.default();

  const autoWithdrawerAddress = "0x33F61D76986522e538F3829674F0FB6cE4e2eF23";
  const autoWithdrawer = new Contract(autoWithdrawerAddress, AUTO_WITHDRAWER_ABI, provider);
  const topics = [autoWithdrawer.interface.getEventTopic("WithdrawalFunded")];
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
        address: autoWithdrawerAddress,
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
      message: `No new withdrawal fundings. Updated block number: ${lastBlock.toString()}`,
    };
  }

  const db = await initDb(PRIVATE_KEY, PUBLIC_KEY);
  const coll = db.collection("WithdrawalFunders");

  async function updateWithdrawerAmount(withdrawer: string, amount: string) {
    const record = await coll.record(withdrawer).get();
    // there's a race condition here between when the current amount is fetched and when it's updated
    if (record.exists()) {
      const newAmount = BigNumber.from(record.data.amount).add(amount);
      await record.call("updateAmount", [newAmount.toString()]);
    } else {
      await coll.create([withdrawer, amount]);
    }
  }

  // Parse retrieved events
  console.log(`Matched ${logs.length} new events`);
  for (const log of logs) {
    const event = autoWithdrawer.interface.parseLog(log);
    const [depositor, withdrawer, amount] = event.args;
    console.log(
      `Withdrawal funded: ${depositor}$ deposited ${amount} for ${withdrawer}`
    );
    updateWithdrawerAmount(withdrawer, amount);
  }

  return {
    canExec: false,
    message: `Updated block number: ${lastBlock.toString()}`
  };
});
