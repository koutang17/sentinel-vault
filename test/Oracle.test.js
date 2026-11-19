const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockOracle", function () {
  it("sets price and emits PriceUpdated", async function () {
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(100n * 10n ** 8n);
    await expect(oracle.setPrice(95n * 10n ** 8n)).to.emit(oracle, "PriceUpdated");
    expect(await oracle.price()).to.equal(95n * 10n ** 8n);
  });

  it("rejects non-owner price updates", async function () {
    const [, other] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(100n * 10n ** 8n);
    await expect(oracle.connect(other).setPrice(50n * 10n ** 8n)).to.be.revertedWithCustomError(oracle, "NotOwner");
  });
});
