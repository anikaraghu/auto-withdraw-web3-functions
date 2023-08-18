import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";

const WITHDRAWAL_ABI = ["function fundWithdrawal(address)"];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { multiChainProvider } = context;
  const provider = multiChainProvider.default();

  const testAddress = "0x33F61D76986522e538F3829674F0FB6cE4e2eF23"; // Call the fundWithdrawal
  const fundWithdrawalContract = new Contract(testAddress, WITHDRAWAL_ABI, provider);
  
  const withdrawer = "0x817601a01c333894cd07b6f85f1711fe1ff3efa1";
  
  return {
    canExec: true,
    callData: [
      {
        to: testAddress,
        data: fundWithdrawalContract.interface.encodeFunctionData("fundWithdrawal", [
          withdrawer,
        ])
      },
    ],
  };
});
