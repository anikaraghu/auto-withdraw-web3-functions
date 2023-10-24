import { Log } from "@ethersproject/providers";
import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";
import { initDb } from "../utils/db.js";
import { BigNumber } from "ethers";
import { pollEvent } from "../utils/pollEvent";

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

  // Fetch recent logs in range of 100 blocks
  const logs: Log[] = await pollEvent(
    context,
    autoWithdrawer,
    "WithdrawalFunded"
  );

  if (logs.length == 0) {
    return {
      canExec: false,
      message: `No new withdrawal fundings.`
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
    message: `Updated withdrawal fundings`
  };
});
