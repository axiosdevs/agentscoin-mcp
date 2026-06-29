# AgentsCoin MCP 🦞

**Give your AI agent its own money.**

This is the official MCP server for **[AgentsCoin](https://agents-coin.com)** — an EVM blockchain where AI agents mine the native coin **$AGENT** *themselves*: no stake, no captcha, no human signup.

Add it to Claude Code, Cursor, or OpenClaw, and your agent can create a wallet, mine $AGENT, and spend it — autonomously, with one config.

---

## Configuration

Add to your MCP client (Claude, Cursor, ModelScope, etc.):

```json
{
  "mcpServers": {
    "agentscoin": {
      "command": "npx",
      "args": ["-y", "agentscoin-mcp@latest"]
    }
  }
}
```

Or connect the hosted server (Streamable HTTP):

```json
{
  "mcpServers": {
    "agentscoin": {
      "type": "streamable_http",
      "url": "https://agents-coin.com/mcp"
    }
  }
}
```

## How to use (in Claude Desktop)

Once installed (the extension shows **Enabled · All requirements met**), just chat with Claude — it calls the tools for you. No code needed.

**First run**
1. *"Show AgentsCoin network info"* — confirms the connection works.
2. *"Create an AgentsCoin wallet"* — returns an `address`, a `privateKey` (save it!), and a faucet link.
3. **Fund it (gas):** open the faucet link (or https://faucet.agents-coin.com) and claim AGENT. A fresh wallet is empty, and send / create / swap all need AGENT for gas.
4. *"Check the balance of 0x…"*

**Create & trade a token** (a pump.fun for agents)
- *"Create a token DogeAI (DOGE) on AgentsCoin using key 0x…"* → returns the token address + an explorer link.
- *"Add liquidity: 1000 DOGE + 5 AGENT, key 0x…"*
- *"Buy token 0x… for 5 AGENT on the AgentsCoin DEX, key 0x…"* · *"Sell 100 of token 0x…"*

**Send** — *"Send 1 AGENT to 0x… from key 0x…"*

**Mine** — *"Mine AGENT to 0x…"* runs the browser-PoW faucet headlessly. It needs Playwright + Chromium locally (`npm i playwright && npx playwright install chromium`). Easiest alternative: just claim from the web faucet.

### The 8 tools
`agentscoin_network_info` · `agentscoin_create_wallet` · `agentscoin_balance` · `agentscoin_send` · `agentscoin_mine` · `agentscoin_create_coin` · `agentscoin_add_liquidity` · `agentscoin_swap`

### Notes
- **Gas first:** claim AGENT from the faucet before send / create / swap.
- **Keys:** `create_wallet` returns the private key in plain text; you pass it back to Claude for actions that sign transactions.
- Network: **AgentsCoin** · chainId **24368** · explorer https://explorer.agents-coin.com · DEX https://dex.agents-coin.com

## What is AgentsCoin?

AgentsCoin is a public, **EVM-compatible Layer-1 blockchain** built for AI agents.

- ⛏️ **Agents mine the coin themselves** — in the browser via Proof-of-Work. No stake, no captcha, no human.
- ⛽ **Gas is paid in $AGENT** — near-free, forever. No ETH required.
- 🎁 **80% of total supply** is distributed to agents through the faucet.
- 🦊 **It's a normal EVM chain** — works with MetaMask and every EVM tool.

| | |
|---|---|
| **Network** | AgentsCoin |
| **Chain ID** | `24368` |
| **RPC** | https://rpc.agents-coin.com |
| **Symbol** | `AGENT` (18 decimals) |
| **Explorer** | https://explorer.agents-coin.com |
| **Faucet** | https://faucet.agents-coin.com |

---

## What is this MCP?

[**MCP (Model Context Protocol)**](https://modelcontextprotocol.io) is the open standard that lets AI agents use external tools. This server gives your agent **5 tools** to use AgentsCoin.

| Tool | What it does |
|------|--------------|
| `agentscoin_network_info` | Returns chain params (to add the network to a wallet) |
| `agentscoin_create_wallet` | Creates a new wallet (address + private key) |
| `agentscoin_balance` | Checks an address' $AGENT balance |
| `agentscoin_mine` | Mines $AGENT via the browser PoW faucet (headless) |
| `agentscoin_send` | Sends $AGENT to another address |
| `agentscoin_create_coin` | Deploys a new token (ERC-20) on AgentsCoin |
| `agentscoin_add_liquidity` | Creates/adds an AGENT liquidity pool on the DEX |
| `agentscoin_swap` | Buys/sells a token for AGENT on the DEX |

---

## What happens when you give this to your agent

1. **Your agent gets a wallet.** It calls `agentscoin_create_wallet` → a fresh address + private key. No signup, no human needed.
2. **It mines $AGENT.** It calls `agentscoin_mine` → a headless browser runs the proof-of-work faucet (~1–2 min) and claims the reward to the wallet.
3. **It uses the coin.** `agentscoin_balance` to check, `agentscoin_send` to pay anyone. Gas is paid in $AGENT — near-free.

In short: **you paste one config, and your agent earns and spends its own on-chain money — autonomously. It costs you nothing.**

---

## Install

```bash
git clone https://github.com/axiosdevs/agentscoin-mcp
cd agentscoin-mcp
npm install
npx playwright install chromium   # only needed for the mine tool
```



## Connect as a remote server (no install, no warnings)

The easiest, safest way — nothing runs on your machine, so there is **no "access to everything" warning**:

**Claude Desktop → Settings → Connectors → Add custom connector** → URL:
```
https://agents-coin.com/mcp
```
Works in any MCP client that supports remote / Streamable-HTTP servers. (Use the local install below only if you specifically want it bundled offline.)

## Install in Claude Desktop (one-click .mcpb)

Download **agentscoin.mcpb** from the [latest release](https://github.com/axiosdevs/agentscoin-mcp/releases/latest), then in **Claude Desktop → Settings → Extensions** drag it in (or "Install from file").

> `.mcpb` is Claude Desktop's extension format — it does **not** open by double-clicking on a normal PC; it must be opened inside Claude Desktop. Source code is this repo; the .mcpb is just a packaged build of it.

## Configure (Claude Code / Cursor)

Add to your `.mcp.json` (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "agentscoin": {
      "command": "npx",
      "args": ["-y", "agentscoin-mcp@latest"]
    }
  }
}
```

Restart your agent — the 5 tools appear.

## Typical flow

```
create_wallet  →  mine  →  balance  →  send
```

---

## Is it safe?

- The wallet your agent creates is **its own**. The private key is generated **locally** and handed to your agent; it's never sent anywhere except as signed transactions to the public RPC.
- Mining runs in a **local headless browser** on your machine.
- Gas is paid in **$AGENT** (which your agent mines), so it never costs you real money.
- The code is one small, readable file (`index.js`) — open-source, MIT licensed.

## Configuration (optional env vars)

| Env | Default |
|-----|---------|
| `AGENTSCOIN_RPC` | `https://rpc.agents-coin.com` |
| `AGENTSCOIN_FAUCET` | `https://faucet.agents-coin.com` |
| `AGENTSCOIN_EXPLORER` | `https://explorer.agents-coin.com` |

---

## Links

- 🌐 Website: https://agents-coin.com
- ⛏️ Faucet: https://faucet.agents-coin.com
- 🔍 Explorer: https://explorer.agents-coin.com

MIT licensed. Built for the machine economy. 🦞

## Privacy Policy

Full policy: https://agents-coin.com/privacy.html

- **Data collection:** This extension does **not** collect, transmit, or store any personal data on our servers.
- **Wallet keys:** Wallets are generated and stored **only locally** on your device (`~/.agentscoin/wallets.json`). We never receive your private keys. The key is shown only when you explicitly call `agentscoin_reveal_private_key`.
- **Network use:** The extension talks to the public AgentsCoin RPC, faucet, and block explorer to read balances and broadcast transactions you initiate. Requests include your public wallet address and transaction data (public by nature of a blockchain).
- **Sharing / retention:** We do not sell or share data. We retain no personal data. Local data stays on your device until you delete it.
- **Contact:** contact@agents-coin.com
