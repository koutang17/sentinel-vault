const { expect } = require("chai");
const { ethers } = require("hardhat");

const U8 = (n) => BigInt(n) * 10n ** 8n;   // oracle price, 8 decimals
const U6 = (n) => BigInt(n) * 10n ** 6n;   // asset, 6 decimals

async function fixture() {
  const [owner, proxy, reactiveSender, other] = await ethers.getSigners();
  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(U8(100));
  const Token = await ethers.getContractFactory("MockToken");
  const token = await Token.deploy("Sentinel USD", "sUSD");
  const Vault = await ethers.getContractFactory("SentinelVault");
  const vault = await Vault.deploy(proxy.address, reactiveSender.address, await oracle.getAddress(), await token.getAddress());
  await token.mint(owner.address, U6(1000));
  await token.connect(owner).approve(await vault.getAddress(), U6(1000));
  return { owner, proxy, reactiveSender, other, oracle, token, vault };
}

describe("SentinelVault", function () {
  it("releases funds to the owner when the price breaches stop-loss", async function () {
    const { owner, proxy, reactiveSender, oracle, token, vault } = await fixture();
    await vault.deposit(U6(500));
    await vault.arm(U8(95), U8(105));

    await oracle.setPrice(U8(94)); // breach below
    await expect(vault.connect(proxy).execute(reactiveSender.address, U8(94)))
      .to.emit(vault, "VaultClosed")
      .withArgs(owner.address, U8(94), U8(94), "STOP");

    expect(await token.balanceOf(await vault.getAddress())).to.equal(0);
    expect(await token.balanceOf(owner.address)).to.equal(U6(1000));
  });

  it("releases funds on take-profit breach", async function () {
    const { proxy, reactiveSender, oracle, token, vault } = await fixture();
    await vault.deposit(U6(500));
    await vault.arm(U8(95), U8(105));

    await oracle.setPrice(U8(106));
    await expect(vault.connect(proxy).execute(reactiveSender.address, U8(106)))
      .to.emit(vault, "VaultClosed")
      .withArgs(await vault.owner(), U8(106), U8(106), "TAKE_PROFIT");
    expect(await token.balanceOf(await vault.getAddress())).to.equal(0);
  });

  it("reverts when the price is inside the band", async function () {
    const { proxy, reactiveSender, oracle, vault } = await fixture();
    await vault.deposit(U6(500));
    await vault.arm(U8(95), U8(105));
    await oracle.setPrice(U8(100));
    await expect(vault.connect(proxy).execute(reactiveSender.address, U8(100)))
      .to.be.revertedWithCustomError(vault, "ThresholdNotMet");
  });

  it("rejects calls not coming through the callback proxy", async function () {
    const { other, reactiveSender, oracle, vault } = await fixture();
    await vault.deposit(U6(500));
    await vault.arm(U8(95), U8(105));
    await oracle.setPrice(U8(90));
    await expect(vault.connect(other).execute(reactiveSender.address, U8(90)))
      .to.be.revertedWithCustomError(vault, "NotAuthorized");
  });

  it("rejects a callback from the wrong reactive sender", async function () {
    const { proxy, other, oracle, vault } = await fixture();
    await vault.deposit(U6(500));
    await vault.arm(U8(95), U8(105));
    await oracle.setPrice(U8(90));
    await expect(vault.connect(proxy).execute(other.address, U8(90)))
      .to.be.revertedWithCustomError(vault, "CallbackNotAuthorized");
  });

  it("does nothing when not armed", async function () {
    const { proxy, reactiveSender, oracle, vault } = await fixture();
    await oracle.setPrice(U8(90));
    await expect(vault.connect(proxy).execute(reactiveSender.address, U8(90)))
      .to.be.revertedWithCustomError(vault, "NotArmed");
  });

  it("rejects invalid thresholds", async function () {
    const { vault } = await fixture();
    await expect(vault.arm(U8(110), U8(90))).to.be.revertedWithCustomError(vault, "InvalidThresholds");
  });

  it("lets the owner rescue a stray token", async function () {
    const { owner, token, vault } = await fixture();
    await token.mint(await vault.getAddress(), U6(7)); // simulate accidental transfer
    await expect(vault.rescue(await token.getAddress(), owner.address, U6(7)))
      .to.emit(vault, "Rescued");
    expect(await token.balanceOf(owner.address)).to.equal(U6(1007));
  });
});
