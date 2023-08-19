import { Web3FunctionContext } from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";
import { Log } from "@ethersproject/providers";

const MAX_RANGE = 100; // limit range of events to comply with rpc providers
const MAX_REQUESTS = 1; // limit number of requests on every execution to avoid hitting timeout

export async function pollEvent(
  context: Web3FunctionContext,
  contract: Contract,
  eventName: string
): Promise<Log[]> {
  const { storage, multiChainProvider } = context;
    const provider = multiChainProvider.default();
    const topics = [contract.interface.getEventTopic(eventName)];
    const currentBlock = await provider.getBlockNumber();
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
                address: contract.address,
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

    return 1;
}
