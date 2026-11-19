const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { setCode, setBalance, impersonateAccount, stopImpersonatingAccount } = require("@nomicfoundation/hardhat-network-helpers");

const SYSTEM = "0x8888888888888888888888888888888888888888";
const ORIGIN = 84532n;
const DEST = 84532n;
const U8 = (n) => BigInt(n) * 10n ** 8n;

const LOG_TYPES = [
  "uint256", "address", "uint256", "uint256", "uint256", "uint256",
  "bytes", "uint256", "uint256", "uint256", "uint256", "uint256",
];

function record(price, topic0, oracleAddr) {
  return [ORIGIN, oracleAddr, topic0, BigInt(price), 0n, 0n, "0x", 0n, 3n, 0n, 0n, 0n];
}

async function deployWithMockSystem(oracleAddr) {
  const artifact = await hre.artifacts.readArtifact("MockSystem");
  await setCode(SYSTEM, artifact.deployedBytecode);
  const Reactive = await ethers.getContractFactory("SentinelReactive");
  const topic0 = ethers.id("PriceUpdated(uint256,uint256)");
  const reactive = await Reactive.deploy(ORIGIN, oracleAddr, topic0, DEST, U8(95), U8(105));
  return { reactive, reactiveAddr: await reactive.getAddress(), topic0 };
}

async function deliver(reactiveAddr, rec) {
  const abi = ["function react(tuple(" + LOG_TYPES.join(",") + ") log) external"];
  const call = new ethers.Interface(abi).encodeFunctionData("react", [rec]);
  await setBalance(SYSTEM, 10n ** 18n);
  await impersonateAccount(SYSTEM);
  const systemSigner = await ethers.getSigner(SYSTEM);
  await (await systemSigner.sendTransaction({ to: reactiveAddr, data: call, gasLimit: 3_000_000n })).wait();
  await stopImpersonatingAccount(SYSTEM);
}

async function callbackEvents() {
  const sys = new ethers.Contract(SYSTEM, ["event CallbackReq(uint8 version, bytes config)"], ethers.provider);
  return sys.queryFilter("CallbackReq");
}

describe("SentinelReactive", function () {
  it("subscribes to the oracle event at construction", async function () {
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(U8(100));
    const { topic0 } = await deployWithMockSystem(await oracle.getAddress());

    const sys = new ethers.Contract(
      SYSTEM,
      ["event SubscribeCall(uint256 chainId, address contract_, uint256 t0, uint256 t1, uint256 t2, uint256 t3)"],
      ethers.provider
    );
    const evs = await sys.queryFilter("SubscribeCall");
    expect(evs.length).to.equal(1);
    expect(evs[0].args.chainId).to.equal(ORIGIN);
    expect(evs[0].args.contract_).to.equal(await oracle.getAddress());
    expect(evs[0].args.t0).to.equal(topic0);
  });

  it("requests a callback when the price crosses below stop-loss", async function () {
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(U8(100));
    const { reactive, reactiveAddr, topic0 } = await deployWithMockSystem(await oracle.getAddress());
    await reactive.setVault("0x" + "11".repeat(20));

    const before = (await callbackEvents()).length;
    await deliver(reactiveAddr, record(U8(94), topic0, await oracle.getAddress()));

    expect(await reactive.triggered()).to.equal(true);
    const evs = (await callbackEvents()).slice(before);
    expect(evs.length).to.equal(1);

    const cfg = new ethers.AbiCoder().decode(
      ["tuple(uint256 chainId, address recipient, uint64 gasLimit, bytes payload)"],
      evs[0].args.config
    )[0];
    expect(cfg.chainId).to.equal(DEST);
    expect(cfg.recipient).to.equal("0x" + "11".repeat(20));
    const decoded = new ethers.Interface(["function execute(address, uint256)"]).decodeFunctionData("execute", cfg.payload);
    expect(decoded[1]).to.equal(U8(94));
  });

  it("does nothing inside the band", async function () {
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(U8(100));
    const { reactiveAddr, topic0 } = await deployWithMockSystem(await oracle.getAddress());

    const before = (await callbackEvents()).length;
    await deliver(reactiveAddr, record(U8(100), topic0, await oracle.getAddress()));

    expect((await callbackEvents()).length).to.equal(before);
  });

  it("fires only once until thresholds are updated", async function () {
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(U8(100));
    const { reactive, reactiveAddr, topic0 } = await deployWithMockSystem(await oracle.getAddress());
    await reactive.setVault("0x" + "11".repeat(20));

    const before = (await callbackEvents()).length;
    await deliver(reactiveAddr, record(U8(106), topic0, await oracle.getAddress()));
    await deliver(reactiveAddr, record(U8(107), topic0, await oracle.getAddress()));
    expect((await callbackEvents()).length).to.equal(before + 1);

    await reactive.updateThresholds(U8(90), U8(104)); // re-arm with a tighter band
    await deliver(reactiveAddr, record(U8(105), topic0, await oracle.getAddress()));
    expect((await callbackEvents()).length).to.equal(before + 2);
  });

  it("ignores events from other contracts", async function () {
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(U8(100));
    const { reactiveAddr, topic0 } = await deployWithMockSystem(await oracle.getAddress());

    const before = (await callbackEvents()).length;
    await deliver(reactiveAddr, record(U8(1), topic0, "0x" + "22".repeat(20)));
    expect((await callbackEvents()).length).to.equal(before);
  });
});
