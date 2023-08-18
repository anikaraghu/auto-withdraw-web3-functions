import { Polybase } from "@polybase/client";
import { ethPersonalSign } from "@polybase/eth";

const BASE_URL = `https://testnet.polybase.xyz`;

export const initDb = async (PRIVATE_KEY: string, PUBLIC_KEY: string) => {
  const db = new Polybase({
    signer: (data) => {
      return {
        h: "eth-personal-sign",
        sig: ethPersonalSign(PRIVATE_KEY, data),
      };
    },
    defaultNamespace: `pk/${PUBLIC_KEY}`,
    baseURL: `${BASE_URL}/v0`,
  });

  await db.applySchema(`
  @public
  collection WithdrawalFunders {
    id: string;
    amount: string;
    constructor (withdrawer: string, amount: string) {
      this.id = withdrawer;
      this.amount = amount;
    }

    updateAmount(amount: string) {
        this.amount = amount;
      }

    del () {
      selfdestruct();
    }
  }
`);

  return db;
};
