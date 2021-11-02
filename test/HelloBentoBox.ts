import { ethers } from "hardhat";
import { Signer, BigNumber } from "ethers";
import { expect } from "chai";
import {
  toShare,
  toAmount,
  getBentoBalance,
  getBigNumber,
  snapshot,
  restore,
  latest,
  increase,
  duration,
  ADDRESS_ZERO,
  getSignedMasterContractApprovalData,
} from "./harness";

describe("Hello BentoBox", function () {
  let accounts: Signer[];

  let snapshotId;

  let bento;
  let helloBentoBox;
  let tokens = [];

  before(async function () {
    accounts = await ethers.getSigners();
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const BentoBoxV1 = await ethers.getContractFactory("BentoBoxV1");
    const HelloBentoBox = await ethers.getContractFactory("HelloBentoBox");

    let promises = [];
    for (let i = 0; i < 1; i++) {
      promises.push(
        ERC20.deploy("Token" + i, "TOK" + i, getBigNumber(1000000))
      );
    }

    tokens = await Promise.all(promises);
    bento = await BentoBoxV1.deploy(tokens[0].address);
    helloBentoBox = await HelloBentoBox.deploy(bento.address);

    await bento.whitelistMasterContract(helloBentoBox.address, true);

    promises = [];
    for (let i = 0; i < tokens.length; i++) {
      promises.push(
        tokens[i].approve(bento.address, getBigNumber(1000000)).then(() => {
          bento.deposit(
            tokens[i].address,
            accounts[0].getAddress(),
            accounts[0].getAddress(),
            getBigNumber(500000),
            0
          );
        })
      );
    }

    await Promise.all(promises);
    await bento.setMasterContractApproval(
      accounts[0].getAddress(),
      helloBentoBox.address,
      true,
      "0",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    await bento
      .connect(accounts[1])
      .setMasterContractApproval(
        accounts[1].getAddress(),
        helloBentoBox.address,
        true,
        "0",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
  });

  beforeEach(async function () {
    snapshotId = await snapshot();
  });

  afterEach(async function () {
    await restore(snapshotId);
  });

  it("should allow to deposit token - wallet", async function () {
    const amount = getBigNumber(1000);

    const balanceOfUserWalletBefore = await tokens[0].balanceOf(
      accounts[0].getAddress()
    );
    const totalDepositsBefore = await helloBentoBox.totalDeposits();
    const shares = await toShare(bento, tokens[0], amount);
    await helloBentoBox.depositToHelloBentoBox(
      tokens[0].address,
      amount,
      false
    );

    const totalDepositsAfter = await helloBentoBox.totalDeposits();

    const depositData = await helloBentoBox.deposits(totalDepositsBefore);

    const balanceOfUserWalletAfter = await tokens[0].balanceOf(
      accounts[0].getAddress()
    );

    expect(totalDepositsBefore.add(1)).to.be.equal(totalDepositsAfter);
    expect(balanceOfUserWalletBefore.sub(amount)).to.be.equal(
      balanceOfUserWalletAfter
    );
    expect(depositData.user).to.be.equal(await accounts[0].getAddress());
    expect(depositData.token).to.be.equal(tokens[0].address);
    expect(depositData.depositedShares).to.be.equal(shares);
  });

  it("should allow to deposit token - bentobox", async function () {
    const amount = getBigNumber(1000);

    const balanceOfUserBentoBefore = await getBentoBalance(
      bento,
      tokens[0],
      await accounts[0].getAddress()
    );
    const totalDepositsBefore = await helloBentoBox.totalDeposits();
    const shares = await toShare(bento, tokens[0], amount);

    await helloBentoBox.depositToHelloBentoBox(tokens[0].address, amount, true);

    const totalDepositsAfter = await helloBentoBox.totalDeposits();

    const depositData = await helloBentoBox.deposits(totalDepositsBefore);

    const balanceOfUserBentoAfter = await getBentoBalance(
      bento,
      tokens[0],
      await accounts[0].getAddress()
    );

    expect(totalDepositsBefore.add(1)).to.be.equal(totalDepositsAfter);
    expect(balanceOfUserBentoBefore.sub(shares)).to.be.equal(
      balanceOfUserBentoAfter
    );
    expect(depositData.user).to.be.equal(await accounts[0].getAddress());
    expect(depositData.token).to.be.equal(tokens[0].address);
    expect(depositData.depositedShares).to.be.equal(shares);
  });

  it("should allow to withdraw token - wallet", async function () {
    const amount = getBigNumber(1000);
    const totalDepositsBefore = await helloBentoBox.totalDeposits();

    await helloBentoBox.depositToHelloBentoBox(
      tokens[0].address,
      amount,
      false
    );

    const balanceOfUserWalletBefore = await tokens[0].balanceOf(
      accounts[0].getAddress()
    );
        
    const shares = await toShare(bento, tokens[0], amount);

    await helloBentoBox.withdrawFromHelloBentoBox(totalDepositsBefore, getBigNumber(500), false)
    const depositData = await helloBentoBox.deposits(totalDepositsBefore);

    const balanceOfUserWalletAfter = await tokens[0].balanceOf(
      accounts[0].getAddress()
    );
    expect(depositData.depositedShares).to.be.equal(amount.sub(getBigNumber(500)));
    expect(balanceOfUserWalletBefore.add(getBigNumber(500))).to.be.equal(
      balanceOfUserWalletAfter
    );
  });

  it("should allow to withdraw token - bento", async function () {
    const amount = getBigNumber(1000);
    const totalDepositsBefore = await helloBentoBox.totalDeposits();

    await helloBentoBox.depositToHelloBentoBox(
      tokens[0].address,
      amount,
      false
    );

    const balanceOfUserBentoBefore = await getBentoBalance(
      bento,
      tokens[0],
      await accounts[0].getAddress()
    );
        
    const shares = await toShare(bento, tokens[0], amount);

    await helloBentoBox.withdrawFromHelloBentoBox(totalDepositsBefore, getBigNumber(500), true)
    const depositData = await helloBentoBox.deposits(totalDepositsBefore);

    const balanceOfUserBentoAfter = await getBentoBalance(
      bento,
      tokens[0],
      await accounts[0].getAddress()
    );
    expect(depositData.depositedShares).to.be.equal(amount.sub(getBigNumber(500)));
    expect(balanceOfUserBentoBefore.add(getBigNumber(500))).to.be.equal(
      balanceOfUserBentoAfter
    );
  });
});

describe("Hello BentoBox - Batch Approval", function() {
  let accounts: Signer[];

  let snapshotId;

  let bento;
  let helloBentoBox;
  let tokens = [];

  before(async function () {
    accounts = await ethers.getSigners();
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const BentoBoxV1 = await ethers.getContractFactory("BentoBoxV1");
    const HelloBentoBox = await ethers.getContractFactory("HelloBentoBox");

    let promises = [];
    for (let i = 0; i < 1; i++) {
      promises.push(
        ERC20.deploy("Token" + i, "TOK" + i, getBigNumber(1000000))
      );
    }

    tokens = await Promise.all(promises);
    bento = await BentoBoxV1.deploy(tokens[0].address);
    helloBentoBox = await HelloBentoBox.deploy(bento.address);

    await bento.whitelistMasterContract(helloBentoBox.address, true);

    promises = [];
    for (let i = 0; i < tokens.length; i++) {
      promises.push(
        tokens[i].approve(bento.address, getBigNumber(1000000)).then(() => {
          bento.deposit(
            tokens[i].address,
            accounts[0].getAddress(),
            accounts[0].getAddress(),
            getBigNumber(500000),
            0
          );
        })
      );
    }

    await Promise.all(promises);
  });

  beforeEach(async function () {
    snapshotId = await snapshot();
  });

  afterEach(async function () {
    await restore(snapshotId);
  });
  
  it("should allow HelloBentoBox and deposit in one transaction", async function () {
    const amount = getBigNumber(1000);
    const nonce = await bento.nonces(await accounts[0].getAddress());
    const { v, r, s } = getSignedMasterContractApprovalData(
      bento,
      accounts[0],
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      helloBentoBox.address,
      true,
      nonce
    );
    let masterContractApprovalData = helloBentoBox.interface.encodeFunctionData(
      "setBentoBoxApproval",
      [await accounts[0].getAddress(), true, v, r, s]
    );
    let depositData = helloBentoBox.interface.encodeFunctionData("depositToHelloBentoBox", [
      tokens[0].address,
      amount,
      true
    ]);
    await helloBentoBox.batch([masterContractApprovalData, depositData], true);
  })
})