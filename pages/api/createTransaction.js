import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import products from "./products.json";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";

const usdcAddress = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
const sellerAddress = "HdrZt8aGDwh2dzLafhjPJ9KVK8jxawFGtxpEYP5ziTQ8";
const sellerPublicKey = new PublicKey(sellerAddress);

const createTransaction = async (req, res) => {
  try {
    const { buyer, orderID, itemID } = req.body;

    if (!buyer) {
      return res.status(400).json({
        message: "Missing buyer address",
      });
    }

    if (!orderID) {
      return res.status(400).json({
        message: "Missing order ID",
      });
    }

    const itemPrice = products.find((item) => item.id === itemID).price;

    if (!itemPrice) {
      return res.status(404).json({
        message: "Item not found. please check item ID",
      });
    }

    const bigAmount = BigNumber(itemPrice);
    const buyerPublicKey = new PublicKey(buyer);

    const network = WalletAdapterNetwork.Mainnet;
    const endpoint = clusterApiUrl(network);
    const connection = new Connection(endpoint);

    const buyerUsdcAddress = await getAssociatedTokenAddress(
      usdcAddress,
      buyerPublicKey
    );
    const shopUsdcAddress = await getAssociatedTokenAddress(
      usdcAddress,
      sellerPublicKey
    );
    // A blockhash is sort of like an ID for a block. It lets you identify each block.
    const { blockhash } = await connection.getLatestBlockhash("finalized");

    const usdcMint = await getMint(connection, usdcAddress);

    // The first two things we need - a recent block ID
    // and the public key of the fee payer
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: buyerPublicKey,
    });

    const transferInstruction = createTransferCheckedInstruction(
      buyerUsdcAddress,
      usdcAddress, // This is the address of the token we want to transfer
      shopUsdcAddress,
      buyerPublicKey,
      bigAmount.toNumber() * 10 ** (await usdcMint).decimals,
      usdcMint.decimals // The token could have any number of decimals
    );

    // We're adding more instructions to the transaction
    transferInstruction.keys.push({
      // We'll use our OrderId to find this transaction later
      pubkey: new PublicKey(orderID),
      isSigner: false,
      isWritable: false,
    });

    tx.add(transferInstruction);

    // Formatting our transaction
    const serializedTransaction = tx.serialize({
      requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");
    console.log("transaction created");
    res.status(200).json({
      transaction: base64,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({ error: "error creating tx" });
    return;
  }
};

export default function handler(req, res) {
  if (req.method === "POST") {
    createTransaction(req, res);
  } else {
    res.status(405).end();
  }
}
