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

// --- Name Service + Premium data API ---
const PREMIUM_WALLET = "0x7f2EaA14163Da03de045Bd27e766A16754A63a98";
const ANS = "0x76BFF16FAF56F84118cE7efA37D378Ab5440B885";
const ANS_ABI = ["function register(string,address) payable","function records(string) view returns (address)","function available(string) view returns (bool)","function fee() view returns (uint256)"];
const ZERO = "0x0000000000000000000000000000000000000000";

server.tool("agentscoin_price", "Get a live crypto price (premium data API). Costs 0.1 AGENT per call, paid automatically from your saved wallet.",
  { symbol: z.string().describe("token symbol, e.g. BTC, ETH, SOL"), privateKey: z.string().optional().describe("omit to use your saved wallet") },
  { title: "Premium Price", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ symbol, privateKey }) => {
    const w = new ethers.Wallet(resolveKey(privateKey), provider);
    const tx = await w.sendTransaction({ to: PREMIUM_WALLET, value: ethers.parseEther("0.1") }); await tx.wait();
    const sym = symbol.toUpperCase().replace("USDT", "");
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=" + sym + "USDT"); const d = await r.json();
    return out({ symbol: sym, priceUsd: d.price || null, paid: "0.1 AGENT", tx: tx.hash });
  });

server.tool("agentscoin_register_name", "Register a .agent name pointing to an address (costs 1 AGENT). Name: lowercase a-z 0-9 and -, 3-32 chars.",
  { name: z.string().describe("the name without .agent, e.g. 'myagent'"), target: z.string().optional().describe("address it points to; defaults to your wallet"), privateKey: z.string().optional() },
  { title: "Register .agent Name", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ name, target, privateKey }) => {
    const w = new ethers.Wallet(resolveKey(privateKey), provider);
    const c = new ethers.Contract(ANS, ANS_ABI, w); const fee = await c.fee(); const tgt = target || w.address;
    const tx = await c.register(name.replace(/\.agent$/, ""), tgt, { value: fee, gasLimit: 300000 }); await tx.wait();
    return out({ name: name.replace(/\.agent$/, "") + ".agent", target: tgt, paid: ethers.formatEther(fee) + " AGENT", tx: tx.hash });
  });

server.tool("agentscoin_resolve_name", "Resolve a .agent name to its address (free, read-only).",
  { name: z.string().describe("e.g. 'myagent' or 'myagent.agent'") },
  { title: "Resolve .agent Name", readOnlyHint: true, openWorldHint: true },
  async ({ name }) => {
    const c = new ethers.Contract(ANS, ANS_ABI, provider); const label = name.replace(/\.agent$/, "");
    const addr = await c.records(label);
    return out({ name: label + ".agent", address: addr === ZERO ? null : addr, available: addr === ZERO });
  });

server.tool("agentscoin_pay", "Pay AGENT to another agent by its .agent name (or a 0x address). Resolves the name, then sends. This is how agents pay each other.",
  { to: z.string().describe("recipient: a .agent name like 'satoshi.agent' or a 0x address"), amount: z.string().describe("AGENT amount, e.g. '5'"), privateKey: z.string().optional() },
  { title: "Pay Agent", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ to, amount, privateKey }) => {
    const w = new ethers.Wallet(resolveKey(privateKey), provider);
    let addr = to;
    if (!ethers.isAddress(to)) {
      const label = to.replace(/\.agent$/, "");
      addr = await new ethers.Contract(ANS, ANS_ABI, provider).records(label);
      if (!addr || addr === ZERO) return out({ error: `name "${to}" is not registered` });
    }
    const tx = await w.sendTransaction({ to: addr, value: ethers.parseEther(amount) }); await tx.wait();
    return out({ status: "paid", to, resolved: addr, amount: amount + " AGENT", tx: tx.hash, explorer: `${EXPLORER}/tx/${tx.hash}` });
  });

server.tool("agentscoin_weather", "Get current weather for a city (premium data, Open-Meteo). Costs 0.1 AGENT.",
  { city: z.string(), privateKey: z.string().optional() }, { title: "Weather", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ city, privateKey }) => { const w = new ethers.Wallet(resolveKey(privateKey), provider); const tx = await w.sendTransaction({ to: PREMIUM_WALLET, value: ethers.parseEther("0.1") }); await tx.wait();
    const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city))).json();
    if (!g.results || !g.results[0]) return out({ error: "city not found", paid: "0.1 AGENT", tx: tx.hash });
    const r = g.results[0]; const m = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}&current=temperature_2m,wind_speed_10m,weather_code`)).json();
    return out({ city: r.name + ", " + r.country, current: m.current, paid: "0.1 AGENT", tx: tx.hash }); });

server.tool("agentscoin_news", "Get top tech/startup news (premium data, Hacker News). Costs 0.1 AGENT.",
  { query: z.string().optional(), privateKey: z.string().optional() }, { title: "News", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ query, privateKey }) => { const w = new ethers.Wallet(resolveKey(privateKey), provider); const tx = await w.sendTransaction({ to: PREMIUM_WALLET, value: ethers.parseEther("0.1") }); await tx.wait();
    const url = query ? "https://hn.algolia.com/api/v1/search?tags=story&query=" + encodeURIComponent(query) : "https://hn.algolia.com/api/v1/search?tags=front_page";
    const d = await (await fetch(url)).json(); const items = (d.hits || []).slice(0, 8).map(h => ({ title: h.title, url: h.url || ("https://news.ycombinator.com/item?id=" + h.objectID), points: h.points }));
    return out({ news: items, paid: "0.1 AGENT", tx: tx.hash }); });

server.tool("agentscoin_token_info", "Look up a crypto token price/liquidity (premium data, DexScreener). Costs 0.1 AGENT.",
  { query: z.string().describe("symbol, name, or address"), privateKey: z.string().optional() }, { title: "Token Info", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ query, privateKey }) => { const w = new ethers.Wallet(resolveKey(privateKey), provider); const tx = await w.sendTransaction({ to: PREMIUM_WALLET, value: ethers.parseEther("0.1") }); await tx.wait();
    const d = await (await fetch("https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(query))).json();
    const p = (d.pairs || []).slice(0, 3).map(x => ({ pair: x.baseToken.symbol + "/" + x.quoteToken.symbol, chain: x.chainId, priceUsd: x.priceUsd, liquidityUsd: x.liquidity && x.liquidity.usd }));
    return out({ results: p, paid: "0.1 AGENT", tx: tx.hash }); });

server.tool("agentscoin_gas", "Get current gas price on Ethereum mainnet + AgentsCoin (premium data). Costs 0.1 AGENT.",
  { privateKey: z.string().optional() }, { title: "Gas Price", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  async ({ privateKey }) => { const w = new ethers.Wallet(resolveKey(privateKey), provider); const tx = await w.sendTransaction({ to: PREMIUM_WALLET, value: ethers.parseEther("0.1") }); await tx.wait();
    let ethGas = null; try { const e = new ethers.JsonRpcProvider("https://cloudflare-eth.com"); ethGas = ethers.formatUnits((await e.getFeeData()).gasPrice || 0n, "gwei") + " gwei"; } catch (x) {}
    const ours = ethers.formatUnits((await provider.getFeeData()).gasPrice || 0n, "gwei") + " gwei";
    return out({ ethereum: ethGas, agentscoin: ours, paid: "0.1 AGENT", tx: tx.hash }); });

await server.connect(new StdioServerTransport());
