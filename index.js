#!/usr/bin/env node
// AgentsCoin MCP — lets an AI agent join AgentsCoin, mine $AGENT and use it.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";

const RPC = process.env.AGENTSCOIN_RPC || "https://rpc.agents-coin.com";
const FAUCET = process.env.AGENTSCOIN_FAUCET || "https://faucet.agents-coin.com";
const EXPLORER = process.env.AGENTSCOIN_EXPLORER || "https://explorer.agents-coin.com";
const CHAIN_ID = 24368;

const provider = new ethers.JsonRpcProvider(RPC);
const out = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });

const server = new McpServer({ name: "agentscoin", version: "1.0.0" });

// 1) network info (for adding to a wallet)
server.tool(
  "agentscoin_network_info",
  "Get AgentsCoin network parameters (chainId, RPC, symbol, explorer). Use to add the network to MetaMask or any EVM wallet.",
  {},
  async () => out({
    network: "AgentsCoin", chainId: CHAIN_ID, chainIdHex: "0x5f30",
    rpcUrl: RPC, currencySymbol: "AGENT", decimals: 18,
    blockExplorerUrl: EXPLORER, faucet: FAUCET,
  })
);

// 2) create a wallet
server.tool(
  "agentscoin_create_wallet",
  "Create a new AgentsCoin (EVM) wallet for this agent. Returns address, private key and mnemonic. Store the private key securely.",
  {},
  async () => {
    const w = ethers.Wallet.createRandom();
    return out({
      address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic?.phrase,
      next: "Use agentscoin_mine with this address to earn AGENT.",
    });
  }
);

// 3) check balance
server.tool(
  "agentscoin_balance",
  "Check the AGENT balance of an address.",
  { address: z.string().describe("0x... address") },
  async ({ address }) => {
    const bal = await provider.getBalance(address);
    return out({ address, balance: ethers.formatEther(bal) + " AGENT", wei: bal.toString() });
  }
);

// 4) send AGENT
server.tool(
  "agentscoin_send",
  "Send AGENT from your wallet to another address.",
  { privateKey: z.string().describe("sender wallet private key (0x...)"), to: z.string().describe("recipient 0x... address"), amount: z.string().describe("amount in AGENT, e.g. '1.5'") },
  async ({ privateKey, to, amount }) => {
    const wallet = new ethers.Wallet(privateKey, provider);
    const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(amount) });
    const rcpt = await tx.wait();
    return out({ hash: tx.hash, status: rcpt.status === 1 ? "success" : "failed", explorer: `${EXPLORER}/tx/${tx.hash}` });
  }
);

// 5) mine $AGENT via the browser PoW faucet (headless)
server.tool(
  "agentscoin_mine",
  "Mine AGENT into an address by running the browser PoW faucet headlessly. Requires Playwright + Chromium (npm i playwright && npx playwright install chromium).",
  {
    address: z.string().describe("address that receives the mined AGENT"),
    seconds: z.number().optional().describe("how long to mine before claiming (default 90)"),
  },
  async ({ address, seconds = 90 }) => {
    let chromium;
    try { ({ chromium } = await import("playwright")); }
    catch { return out("Playwright not installed. Run: npm i playwright && npx playwright install chromium"); }
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(FAUCET, { waitUntil: "networkidle", timeout: 60000 });
      await page.fill('input[type="text"]', address);
      await page.click('button.start-action, button:has-text("Start Mining"), button:has-text("Request Funds")');
      await page.waitForTimeout(seconds * 1000);
      // stop mining & claim
      await page.click('button.stop-action, button:has-text("Stop Mining & Claim Rewards"), button:has-text("Stop Mining")', { timeout: 30000 });
      await page.click('button:has-text("Claim Rewards")', { timeout: 30000 }).catch(() => {});
      await page.waitForSelector('a[href*="/tx/0x"]', { timeout: 120000 });
      const txLink = await page.getAttribute('a[href*="/tx/0x"]', "href");
      const bal = await provider.getBalance(address);
      return out({ status: "claimed", address, balance: ethers.formatEther(bal) + " AGENT", tx: txLink });
    } catch (e) {
      return out({ status: "error", error: String(e), hint: "Faucet may be out of funds, or UI selectors changed." });
    } finally { await browser.close(); }
  }
);

await server.connect(new StdioServerTransport());
