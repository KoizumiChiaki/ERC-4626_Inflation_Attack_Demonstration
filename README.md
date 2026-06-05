# 经典智能合约漏洞复现：ERC-4626 通胀攻击

## 作业对应

| 要求 | 本仓库 |
|------|--------|
| 选取 1 个经典漏洞类型 | **ERC-4626 金库通胀攻击**（2022 起广泛讨论，属首存者/捐赠类会计漏洞） |
| 漏洞靶场合约 | `contracts/VulnerableVault.sol` |
| 攻击演示 | `contracts/InflationAttacker.sol` + `scripts/attack.js` + `test/InflationAttack.test.js` |

## 漏洞原理（简述）

1. 攻击者**首存**极小金额（如 1 wei），获得极少份额（如 1 share）。
2. 攻击者向金库**直接转账**（捐赠），不铸造份额，抬高「每份份额对应的资产」。
3. 受害者 `deposit` 时，份额按 `assets * supply / totalAssets` **向下取整**，可能得到 **0 份**，但资产已被转入金库。
4. 攻击者 `redeem` 全部份额，取走金库内资产（含受害者存款）。

## 环境

- Node.js 18+
- Windows / macOS / Linux

## 运行

```bash
cd c:\Users\Admin\Desktop\pre
npm install
npm run compile
npm test
npm run attack
```

`npm test` 与 `npm run attack` 均会在本地 Hardhat 链上完整演示**资金被攻击者转走、受害者 0 份额**的过程。

## 文件说明

```
contracts/
  MockUSDC.sol           # 实验用 ERC20
  VulnerableVault.sol    # 含漏洞的简化 ERC-4626 风格金库
  InflationAttacker.sol  # 链上攻击合约
scripts/
  attack.js              # 攻击脚本（控制台输出各步余额）
test/
  InflationAttack.test.js
```

## 报告可写要点

- **漏洞根因**：`totalAssets` 使用 `balanceOf`，捐赠可操纵份额单价；整数除法舍入；缺少虚拟份额/死份额/`minSharesOut`。
- **与预言机攻击区别**：不依赖外部价格，而是**内部分额会计**。
- **防护**：OpenZeppelin ERC4626 的 virtual shares/assets offset、首存死份额、deposit 滑点检查等。

## 注意

仅用于课程实验与本地测试，勿部署到主网或真实资产环境。
