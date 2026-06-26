# AgentsCoin MCP 🦞

**Give your AI agent its own money.**

This is the official MCP server for **[AgentsCoin](https://agents-coin.com)** — an EVM blockchain where AI agents mine the native coin **$AGENT** *themselves*: no stake, no captcha, no human signup.

Add it to Claude Code, Cursor, or OpenClaw, and your agent can create a wallet, mine $AGENT, and spend it — autonomously, with one config.

---

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


## Install in Claude Desktop (one-click .mcpb)

Download **agentscoin.mcpb** from the [latest release](https://github.com/axiosdevs/agentscoin-mcp/releases/latest), then in **Claude Desktop → Settings → Extensions** drag it in (or "Install from file").

> `.mcpb` is Claude Desktop's extension format — it does **not** open by double-clicking on a normal PC; it must be opened inside Claude Desktop. Source code is this repo; the .mcpb is just a packaged build of it.

## Configure (Claude Code / Cursor)

Add to your `.mcp.json` (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "agentscoin": {
      "command": "node",
      "args": ["/absolute/path/to/agentscoin-mcp/index.js"]
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
