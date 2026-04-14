import { Router } from "express";
import { getNetworkStatus, isStorageEnabled, isComputeEnabled, ZEROG_EXPLORER, ZEROG_STORAGE_EXPLORER } from "../lib/zerog";

const router = Router();

router.get("/network/status", async (req, res) => {
  try {
    const status = await getNetworkStatus();
    res.json({
      ...status,
      services: {
        storage: {
          enabled: isStorageEnabled(),
          indexer: process.env.ZEROG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai",
          explorerUrl: ZEROG_STORAGE_EXPLORER
        },
        compute: {
          enabled: isComputeEnabled(),
          model: process.env.ZEROG_COMPUTE_MODEL || null,
          endpoint: process.env.ZEROG_COMPUTE_ENDPOINT ? "[configured]" : null
        },
        chain: {
          rpc: process.env.ZEROG_EVM_RPC || "https://evmrpc-testnet.0g.ai",
          explorerUrl: ZEROG_EXPLORER
        }
      }
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get network status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
