import { Indexer, ZgFile } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import OpenAI from "openai";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ZEROG_EVM_RPC = process.env.ZEROG_EVM_RPC || "https://evmrpc-testnet.0g.ai";
const ZEROG_STORAGE_INDEXER = process.env.ZEROG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";
const ZEROG_CHAIN_ID = process.env.ZEROG_CHAIN_ID || "16602";
const ZEROG_PRIVATE_KEY = process.env.ZEROG_PRIVATE_KEY;
const ZEROG_COMPUTE_ENDPOINT = process.env.ZEROG_COMPUTE_ENDPOINT;
const ZEROG_COMPUTE_API_KEY = process.env.ZEROG_COMPUTE_API_KEY;
const ZEROG_COMPUTE_MODEL = process.env.ZEROG_COMPUTE_MODEL || "deepseek-chat-v3-0324";

export const ZEROG_EXPLORER = process.env.ZEROG_EXPLORER || "https://chainscan-newton.0g.ai";
export const ZEROG_STORAGE_EXPLORER = process.env.ZEROG_STORAGE_EXPLORER || "https://storagescan-newton.0g.ai";

function getProvider() {
  return new ethers.JsonRpcProvider(ZEROG_EVM_RPC);
}

function getSigner() {
  if (!ZEROG_PRIVATE_KEY) return null;
  return new ethers.Wallet(ZEROG_PRIVATE_KEY, getProvider());
}

function getIndexer() {
  return new Indexer(ZEROG_STORAGE_INDEXER);
}

export function isStorageEnabled() {
  return !!ZEROG_PRIVATE_KEY;
}

export function isComputeEnabled() {
  return !!(ZEROG_COMPUTE_ENDPOINT && ZEROG_COMPUTE_API_KEY);
}

async function uploadJsonToStorage(data) {
  const signer = getSigner();
  const indexer = getIndexer();
  const payload = JSON.stringify({
    ...data,
    uploadedAt: new Date().toISOString(),
    platform: "GhostAgent",
    network: "0G-Testnet"
  });

  const tmpDir = await mkdtemp(join(tmpdir(), "ghostagent-"));
  const tmpPath = join(tmpDir, "upload.json");

  try {
    await writeFile(tmpPath, payload, "utf-8");
    const zgFile = await ZgFile.fromFilePath(tmpPath);
    const [tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) throw new Error(treeErr);
    const rootHash = tree.rootHash();
    const [tx, uploadErr] = await indexer.upload(zgFile, ZEROG_EVM_RPC, signer);
    if (uploadErr) throw new Error(typeof uploadErr === "string" ? uploadErr : JSON.stringify(uploadErr));
    const txHash = tx?.txHash || (typeof tx === "string" ? tx : null);
    return { storageRoot: rootHash, storageTx: txHash };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function uploadMemoryToStorage(memoryData) {
  if (!isStorageEnabled()) {
    return { storageRoot: null, storageTx: null, error: "0G_STORAGE_NOT_CONFIGURED" };
  }
  try {
    const result = await uploadJsonToStorage(memoryData);
    return result;
  } catch (err) {
    console.error("[0G Storage] memory upload failed:", err?.message || err);
    return { storageRoot: null, storageTx: null, error: err?.message };
  }
}

export async function uploadActionResultToStorage(actionData) {
  if (!isStorageEnabled()) {
    return { storageRoot: null, error: "0G_STORAGE_NOT_CONFIGURED" };
  }
  try {
    const result = await uploadJsonToStorage(actionData);
    return { storageRoot: result.storageRoot };
  } catch (err) {
    console.error("[0G Storage] action upload failed:", err?.message || err);
    return { storageRoot: null, error: err?.message };
  }
}

export async function registerAgentOnChain(agentData) {
  if (!isStorageEnabled()) {
    return { chainTxHash: null, error: "0G_CHAIN_NOT_CONFIGURED" };
  }
  try {
    const signer = getSigner();
    const registrationData = JSON.stringify({
      event: "agent_registered",
      agentId: agentData.agentId,
      name: agentData.name,
      personality: agentData.personality,
      platform: "GhostAgent",
      timestamp: new Date().toISOString()
    });
    const tx = await signer.sendTransaction({
      to: await signer.getAddress(),
      value: 0n,
      data: ethers.hexlify(ethers.toUtf8Bytes(registrationData))
    });
    await tx.wait(1);
    return { chainTxHash: tx.hash };
  } catch (err) {
    console.error("[0G Chain] agent registration failed:", err?.message || err);
    return { chainTxHash: null, error: err?.message };
  }
}

export async function chatWithAgent(agent, userMessage, memoryContext) {
  if (!isComputeEnabled()) {
    return null;
  }
  try {
    const openai = new OpenAI({
      baseURL: `${ZEROG_COMPUTE_ENDPOINT}/v1/proxy`,
      apiKey: ZEROG_COMPUTE_API_KEY
    });
    const systemPrompt = `You are ${agent.name}, an autonomous AI agent operating on the 0G Network.
Personality: ${agent.personality}
Capabilities: ${(agent.capabilities || []).join(", ")}
${agent.description ? `Description: ${agent.description}` : ""}
${memoryContext?.length ? `Memory context: ${memoryContext.slice(0, 5).map(m => `${m.key}: ${m.value}`).join("; ")}` : ""}

You execute autonomous tasks including trading, social operations, payments, and analysis.
All your executions are TEE-verified and logged on 0G Chain.
Your memory is stored on 0G Storage for persistence across sessions.
Keep responses focused, decisive, and in-character. Mention relevant 0G network operations when appropriate.`;

    const completion = await openai.chat.completions.create({
      model: ZEROG_COMPUTE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    return completion.choices[0]?.message?.content || null;
  } catch (err) {
    console.error("[0G Compute] chat failed:", err?.message || err);
    return null;
  }
}

export async function getNetworkStatus() {
  try {
    const provider = getProvider();
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    return {
      connected: true,
      chainId: network.chainId.toString(),
      blockNumber,
      rpcEndpoint: ZEROG_EVM_RPC,
      storageEnabled: isStorageEnabled(),
      computeEnabled: isComputeEnabled(),
      explorerUrl: ZEROG_EXPLORER,
      storageExplorerUrl: ZEROG_STORAGE_EXPLORER,
      services: {
        storage: {
          enabled: isStorageEnabled(),
          indexer: ZEROG_STORAGE_INDEXER,
          explorerUrl: ZEROG_STORAGE_EXPLORER
        },
        compute: {
          enabled: isComputeEnabled(),
          model: isComputeEnabled() ? ZEROG_COMPUTE_MODEL : null,
          endpoint: isComputeEnabled() ? ZEROG_COMPUTE_ENDPOINT : null
        },
        chain: {
          rpc: ZEROG_EVM_RPC,
          explorerUrl: ZEROG_EXPLORER
        }
      }
    };
  } catch (err) {
    return {
      connected: false,
      error: err?.message,
      storageEnabled: isStorageEnabled(),
      computeEnabled: isComputeEnabled(),
      services: {
        storage: { enabled: isStorageEnabled() },
        compute: { enabled: isComputeEnabled() },
        chain: { rpc: ZEROG_EVM_RPC }
      }
    };
  }
}
