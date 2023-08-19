import { secp256k1, encodeToString } from "@polybase/util";
import { Polybase } from "@polybase/client";
import { ethPersonalSign } from "@polybase/eth";

import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/.env" });

const PRIVATE_KEY_POLYBASE = process.env.PRIVATE_KEY_POLYBASE as string;
const PUBLIC_KEY_POLYBASE = process.env.PUBLIC_KEY_POLYBASE as string;

async function createWithdrawalsDb() {
  const BASE_URL = `https://testnet.polybase.xyz`;

  const db = new Polybase({
    signer: (data) => {
      return {
        h: "eth-personal-sign",
        sig: ethPersonalSign(PRIVATE_KEY_POLYBASE, data),
      };
    },
    defaultNamespace: `pk/${PUBLIC_KEY_POLYBASE}`,
    baseURL: `${BASE_URL}/v0`,
  });

  await db.applySchema(`
  @public
  collection Withdrawals {
    id: string;
    sender: string;
    nonce: string;
    target: string;
    value: string;
    gasLimit: string;
    data: string;
    createdAt: number;

    constructor (
      withdrawalHash: string,
      withdrawer: string,
      nonce: string,
      target: string,
      value: string,
      gasLimit: string,
      data: string,
      createdAt: number
    ) {
      this.id = withdrawalHash;
      this.sender = withdrawer;
      this.nonce = nonce;
      this.target = target;
      this.value = value;
      this.gasLimit = gasLimit;
      this.data = data;
      this.createdAt = createdAt;
    }

    del () {
      selfdestruct();
    }
  }
`);
}

createWithdrawalsDb();
