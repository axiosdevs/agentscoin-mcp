#!/usr/bin/env node
// AgentsCoin MCP — lets an AI agent join AgentsCoin, get $AGENT and use it.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";

const RPC = process.env.AGENTSCOIN_RPC || "https://rpc.agents-coin.com";
const FAUCET = process.env.AGENTSCOIN_FAUCET || "https://faucet.agents-coin.com";
const EXPLORER = process.env.AGENTSCOIN_EXPLORER || "https://explorer.agents-coin.com";
const CHAIN_ID = 24368;

const provider = new ethers.JsonRpcProvider(RPC);
const out = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });

const WDIR = join(homedir(), ".agentscoin");
const WFILE = join(WDIR, "wallets.json");
function loadStore() { try { return JSON.parse(readFileSync(WFILE, "utf8")); } catch { return { active: null, wallets: {} }; } }
function saveStore(s) { try { mkdirSync(WDIR, { recursive: true }); writeFileSync(WFILE, JSON.stringify(s, null, 2)); } catch (e) {} }
function resolveKey(privateKey) {
  if (privateKey) return privateKey;
  const s = loadStore(); const w = s.active && s.wallets[s.active];
  if (!w) throw new Error("No saved wallet yet. Create one with agentscoin_create_wallet, or pass privateKey.");
  return w.privateKey;
}
function activeAddress() { return loadStore().active; }

const server = new McpServer({ name: "agentscoin", version: "1.2.1" });

server.tool("agentscoin_network_info",
  "Get AgentsCoin network parameters (chainId, RPC, symbol, explorer). Use to add the network to MetaMask or any EVM wallet.",
  {}, { title: "Network Info", readOnlyHint: true, openWorldHint: true },
  async () => out({ network: "AgentsCoin", chainId: CHAIN_ID, chainIdHex: "0x5f30", rpcUrl: RPC, currencySymbol: "AGENT", decimals: 18, blockExplorerUrl: EXPLORER, faucet: FAUCET }));

server.tool("agentscoin_create_wallet",
  "Create a new AgentsCoin wallet for the agent. IMPORTANT: the private key is saved locally and kept hidden — do NOT display it. Show ONLY the address. The key is used automatically for send/create/swap. Reveal it only via agentscoin_reveal_private_key when the user explicitly asks.",
  {}, { title: "Create Wallet", readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  async () => {
    const w = ethers.Wallet.createRandom();
    const s = loadStore(); s.wallets[w.address] = { privateKey: w.privateKey, mnemonic: w.mnemonic?.phrase }; s.active = w.address; saveStore(s);
    return out({ address: w.address, keySaved: true, note: "Private key saved locally and kept hidden — do not display it. Fund this address with agentscoin_mine." });
  });

server.tool("agentscoin_reveal_private_key",
  "Reveal and back up the saved private key + mnemonic. ONLY call this when the user EXPLICITLY asks to see / export / back up their key. Then warn them to keep it secret.",
  { address: z.string().optional().describe("which wallet; defaults to the active wallet") },
  { title: "Reveal Private Key (backup)", readOnlyHint: true, openWorldHint: false },
  async ({ address }) => {
    const s = loadStore(); const a = address || s.active; const w = a && s.wallets[a];
    if (!w) return out({ error: "No saved wallet found. Create one with agentscoin_create_wallet." });
    return out({ address: a, privateKey: w.privateKey, mnemonic: w.mnemonic, warning: "Keep this secret. Anyone with this key controls the funds. Never paste it into a shared chat or screenshot." });
  });

server.tool("agentscoin_balance", "Check the AGENT balance of an address (defaults to your saved wallet).",
  { address: z.string().optional().describe("0x... address; omit to use your wallet") },
  { title: "Check Balance", readOnlyHint: true, openWorldHint: true },
  async ({ address }) => {
    const a = address || activeAddress(); if (!a) return out({ error: "No address and no saved wallet." });
    const bal = await provider.getBalance(a); return out({ address: a, balance: ethers.formatEther(bal) + " AGENT", wei: bal.toString() });
  });

server.tool("agentscoin_send", "Send AGENT from your wallet to another address.",
  { to: z.string().describe("recipient 0x... address"), amount: z.string().describe("amount in AGENT, e.g. '1.5'"), privateKey: z.string().optional().describe("sender key; omit to use your saved wallet") },
  { title: "Send AGENT", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ to, amount, privateKey }) => {
    const wallet = new ethers.Wallet(resolveKey(privateKey), provider);
    const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(amount) }); const rcpt = await tx.wait();
    return out({ hash: tx.hash, status: rcpt.status === 1 ? "success" : "failed", explorer: `${EXPLORER}/tx/${tx.hash}` });
  });

server.tool("agentscoin_mine", "Get AGENT from the faucet (defaults to your saved wallet). Works instantly in chat, no browser. Use to fund a fresh wallet for gas.",
  { address: z.string().optional().describe("address to receive AGENT; omit to use your wallet") },
  { title: "Get AGENT (Faucet)", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async ({ address }) => {
    const a = address || activeAddress(); if (!a) return out({ error: "No address and no saved wallet. Create one first." });
    try {
      const r = await fetch(FAUCET + "/api/drip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: a }) });
      const d = await r.json();
      if (d && d.tx) { const bal = await provider.getBalance(a); return out({ status: "funded", address: a, received: d.amount, balance: ethers.formatEther(bal) + " AGENT", tx: d.tx, explorer: d.explorer }); }
      return out(d);
    } catch (e) { return out({ status: "error", error: String(e.message || e) }); }
  });

const MEME = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "token.json"), "utf8"));
const DEX = { router: "0x955cFAB7B0943e3bE3f8c51f4569581f66c4170e", factory: "0x4Cd52B1E022Ef78B66862502cA4c000a15Adc06C", wagent: "0xF28A7ee0A7692D12C61210bA7477ff29e12d5BD8" };
const ROUTER_ABI = [
  "function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) payable returns (uint,uint,uint)",
  "function swapExactETHForTokens(uint amountOutMin,address[] path,address to,uint deadline) payable returns (uint[])",
  "function swapExactTokensForETH(uint amountIn,uint amountOutMin,address[] path,address to,uint deadline) returns (uint[])",
];
const ERC20_ABI = ["function approve(address,uint) returns (bool)", "function balanceOf(address) view returns (uint)"];
const dl = () => Math.floor(Date.now()/1000) + 1200;
const PUMP = "0x7c5799abE85C12E950e04253182a639f053ada9f";
const PUMP_ABI = ["function launch(string,string,uint256) payable returns (address)","function fee() view returns (uint256)","event Launched(address indexed creator, address indexed token, string name, string symbol, uint256 supply, uint256 feePaid)"];

server.tool("agentscoin_create_coin", "Deploy a new token (ERC-20) on AgentsCoin. Returns the token address.",
  { name: z.string().describe("token name"), symbol: z.string().describe("token symbol"), supply: z.string().optional().describe("total supply, default 1000000000"), privateKey: z.string().optional().describe("deployer key; omit to use your saved wallet") },
  { title: "Create Token", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ name, symbol, supply = "1000000000", privateKey }) => {
    const w = new ethers.Wallet(resolveKey(privateKey), provider);
    const pump = new ethers.Contract(PUMP, PUMP_ABI, w);
    const fee = await pump.fee();
    const tx = await pump.launch(name, symbol, supply, { value: fee, gasLimit: 1500000 });
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return pump.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "Launched");
    const addr = ev ? ev.args.token : null;
    return out({ token: addr, name, symbol, supply, feePaid: ethers.formatEther(fee) + " AGENT", explorer: `${EXPLORER}/token/${addr}`, next: "Use agentscoin_add_liquidity to make it tradeable." });
  });

server.tool("agentscoin_add_liquidity", "Create or add an AGENT liquidity pool for a token on the AgentsCoin DEX.",
  { token: z.string().describe("token 0x... address"), tokenAmount: z.string().describe("amount of the token to add"), agentAmount: z.string().describe("amount of AGENT to pair"), privateKey: z.string().optional().describe("wallet key; omit to use your saved wallet") },
  { title: "Add Liquidity", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ token, tokenAmount, agentAmount, privateKey }) => {
    const w = new ethers.Wallet(resolveKey(privateKey), provider);
    await (await new ethers.Contract(token, ERC20_ABI, w).approve(DEX.router, ethers.MaxUint256)).wait();
    const r = new ethers.Contract(DEX.router, ROUTER_ABI, w);
    const lqArgs = [token, ethers.parseEther(tokenAmount), 0, 0, w.address, dl()];
    const lqOpts = { value: ethers.parseEther(agentAmount) };
    const lqEst = await r.addLiquidityETH.estimateGas(...lqArgs, lqOpts);
    const tx = await r.addLiquidityETH(...lqArgs, { ...lqOpts, gasLimit: (lqEst * 3n) / 2n });
    await tx.wait();
    return out({ status: "liquidity added", token, tokenAmount, agentAmount, tx: tx.hash, dex: "https://dex.agents-coin.com" });
  });

server.tool("agentscoin_swap", "Buy or sell a token for AGENT on the AgentsCoin DEX.",
  { action: z.enum(["buy", "sell"]).describe("buy = spend AGENT for token; sell = sell token for AGENT"), token: z.string().describe("token 0x... address"), amount: z.string().describe("AGENT to spend (buy) or token amount to sell (sell)"), privateKey: z.string().optional().describe("wallet key; omit to use your saved wallet") },
  { title: "Swap Token", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ action, token, amount, privateKey }) => {
    const w = new ethers.Wallet(resolveKey(privateKey), provider);
    const r = new ethers.Contract(DEX.router, ROUTER_ABI, w); let tx;
    if (action === "buy") { const a=[0,[DEX.wagent,token],w.address,dl()]; const o={value:ethers.parseEther(amount)}; const e=await r.swapExactETHForTokens.estimateGas(...a,o); tx = await r.swapExactETHForTokens(...a,{...o,gasLimit:(e*3n)/2n}); }
    else { await (await new ethers.Contract(token, ERC20_ABI, w).approve(DEX.router, ethers.MaxUint256)).wait(); const a=[ethers.parseEther(amount),0,[token,DEX.wagent],w.address,dl()]; const e=await r.swapExactTokensForETH.estimateGas(...a); tx = await r.swapExactTokensForETH(...a,{gasLimit:(e*3n)/2n}); }
    await tx.wait();
    return out({ status: "swapped", action, token, amount, tx: tx.hash, explorer: `${EXPLORER}/tx/${tx.hash}` });
  });

await server.connect(new StdioServerTransport());
