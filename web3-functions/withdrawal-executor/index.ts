import {
    Web3Function,
    Web3FunctionContext,
  } from "@gelatonetwork/web3-functions-sdk";

import {
    BedrockCrossChainMessageProof,
    hashWithdrawal,
    toRpcHexString,
  } from '@eth-optimism/core-utils';
//   import { Contract } from "ethers";
  
//   import { lotteryAbi } from "../utils/abis/abis";
  
  import { initDb } from "../utils/db.js";
  
  Web3Function.onRun(async (context: Web3FunctionContext) => {
    const { userArgs, secrets, multiChainProvider } = context;
  
    // const provider = multiChainProvider.default();
  
    // User Secrets
    // const PRIVATE_KEY = (await secrets.get("PRIVATE_KEY_POLYBASE")) as string;
    // const PUBLIC_KEY = (await secrets.get("PUBLIC_KEY_POLYBASE")) as string;

    // create proof

    // add withdrawals to the database with a balance
    // iterate through L2 Withdrawals
    // estimate gas
    // check if there's enough gas, if there is execute prove
    // check if there's enough gas, if there is execute finalize
  
    // const lotteryAddress = userArgs.lotteryAddress as string;
    // if (!lotteryAddress) throw new Error("Missing userArgs.lotteryAddress");
  
    // const lottery = new Contract(lotteryAddress as string, lotteryAbi, provider);

    //
    const db = await initDb(PRIVATE_KEY, PUBLIC_KEY);
  
    const coll = db.collection("WithdrawalFunders");
  
    let res = await coll.get();
  
    if (res.data.length == 0) {
      return { canExec: false, message: `There are no participants yet` };
    }
    const winner = res.data[0].data.amount;
  
    console.log(`Winner is ${winner}`);
    return { canExec: false, message: `There!!!!` };
    // return {
    //   canExec: false,
    //   callData: [
    //     {
    //       to: lotteryAddress,
    //       data: lottery.interface.encodeFunctionData("updateWinner", [winner]),
    //     },
    //   ],
    // };
  });
  