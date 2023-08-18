import { Log } from "@ethersproject/providers";
import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";

const MAX_RANGE = 100; // limit range of events to comply with rpc providers
const MAX_REQUESTS = 100; // limit number of requests on every execution to avoid hitting timeout
const ORACLE_ABI = ["event WithdrawalFunded(address indexed _depositor, address indexed _withdrawer, uint256 _amount)"];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, storage, multiChainProvider } = context;

  const provider = multiChainProvider.default();

  // Create oracle & counter contract
  const oracleAddress =
    (userArgs.oracle as string) ?? "0x33F61D76986522e538F3829674F0FB6cE4e2eF23";
  const oracle = new Contract(oracleAddress, ORACLE_ABI, provider);
  const topics = [oracle.interface.getEventTopic("WithdrawalFunded")];
  const currentBlock = await provider.getBlockNumber();

  // Retrieve last processed block number & nb events matched from storage
  const lastBlockStr = await storage.get("lastBlockNumber");
  let lastBlock = lastBlockStr ? parseInt(lastBlockStr) : currentBlock - 2000;
  let totalEvents = parseInt((await storage.get("totalEvents")) ?? "0");
  console.log(`Last processed block: ${lastBlock}`); 
  console.log(`Current block: ${currentBlock}`);
  console.log(`Total events matched: ${totalEvents}`);

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
        address: oracleAddress,
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

  // Parse retrieved events
  console.log(`Matched ${logs.length} new events`);
  const nbNewEvents = logs.length;
  totalEvents += logs.length;
  for (const log of logs) {
    const event = oracle.interface.parseLog(log);
    const [depositor, withdrawer, amount] = event.args;
    console.log(
      `Withdrawal funded: ${depositor}$ deposited ${amount} for ${withdrawer}`
    );
    const currentValue = (await storage.get(withdrawer)) ?? "0";
    await storage.set(withdrawer, currentValue + amount);
  }

  // Update storage for next run
  await storage.set("lastBlockNumber", lastBlock.toString());
  await storage.set("totalEvents", totalEvents.toString());

  if (nbNewEvents === 0) {
    return {
      canExec: false,
      message: `Total events matched: ${totalEvents} (at block #${lastBlock.toString()})`,
    };
  }

  return {
    canExec: false,
    message: `Updated block number: ${lastBlock.toString()}`
  };
});
