import { Log } from "@ethersproject/providers";
import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { initDb } from "../utils/db.js";
import { pollEvent } from "../utils/pollEvent";
import { Contract } from "@ethersproject/contracts";

const WITHDRAWAL_ABI = [
  "event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData);"
];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { secrets, multiChainProvider } = context;

  const provider = multiChainProvider.default();

  // User Secrets
  const PRIVATE_KEY = (await secrets.get("PRIVATE_KEY_POLYBASE")) as string;
  const PUBLIC_KEY = (await secrets.get("PUBLIC_KEY_POLYBASE")) as string;

  const bridgeAddress = "0x4200000000000000000000000000000000000010";
  const l2StandardBridge = new Contract(bridgeAddress, WITHDRAWAL_ABI, provider);

  // Fetch recent logs in range of 100 blocks
  const logs: Log[] = await pollEvent(
    context,
    l2StandardBridge,
    "ETHBridgeInitiated"
  );

  if (logs.length == 0) {
    return {
      canExec: false,
      message: `No new withdrawals initiated.`
    };
  }

  const db = await initDb(PRIVATE_KEY, PUBLIC_KEY);
  const collFunders = db.collection("WithdrawalFunders");
  const collWithdrawals = db.collection("Withdrawal");

  // Parse retrieved events
  console.log(`Matched ${logs.length} new events`);
  for (const log of logs) {
    const event = l2StandardBridge.interface.parseLog(log);
    const [from, to, amount, extraData] = event.args;
    console.log(
      `Withdrawal initiated from ${from}$ of amount: ${amount}`
    );

    const txDetails = await provider.getTransaction(log.transactionHash);

    const withdrawerFunded = await collFunders.record(from).get();
    // Only pay attention to this withdrawal if it's been prefunded
    if (withdrawerFunded.exists()) {
      await collWithdrawals.create([
        log.transactionHash,
        from,
        txDetails.nonce,
        to,
        amount,
        txDetails.gasLimit,
        extraData,
        txDetails.timestamp
      ]);
    }
  }

  return {
    canExec: false,
    message: `Updated withdrawals`
  };
});
