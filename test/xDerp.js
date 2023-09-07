const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect, util } = require("chai");
const { ethers, deployments } = require("hardhat");
const { MaxUint256, parseEther } = require("ethers");

const _minRedeemRatio = "42"
const _maxRedeemRatio = "100"
const _minRedeemDuration = time.duration.days(24)
const _maxRedeemDuration = time.duration.days(96)
const _totalRewards = ethers.parseEther("100")
const durationInSeconds = time.duration.days(30)

describe("xDERP", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    // const deployFixture = deployments.createFixture(
    //     async ({ deployments, ethers }, options) => {
    //         const { deploy } = deployments

    //         // Contracts are deployed using the first signer/account by default
    //         const [owner, otherAccount] = await ethers.getSigners();
    //         // const DerpFactory = await ethers.getContractFactory("ERC20")
    //         // const derp = await DerpFactory.deploy()
    //         const derp = await deploy("ERC20", {
    //             from: owner.address,
    //             proxy: {
    //                 proxyContract: 'OptimizedTransparentProxy',
    //                 viaAdminContract: 'DefaultProxyAdmin',
    //             },
    //         })


    //         // const xDerpFactory = await ethers.getContractFactory("xDERP");

    //         // const xDerp = await xDerpFactory.deploy(
    //         //     derp.address,
    //         //     _minRedeemRatio,
    //         //     _maxRedeemRatio,
    //         //     _minRedeemDuration,
    //         //     _maxRedeemDuration,
    //         //     _totalRewards,
    //         //     time.latest()
    //         // );

    //         const xDerp = await deploy("xDERP", {
    //             from: owner.address,
    //             skipIfAlreadyDeployed: false,
    //             proxy: {
    //                 proxyContract: 'OptimizedTransparentProxy',
    //                 viaAdminContract: 'DefaultProxyAdmin',
    //             },
    //             args: [
    //                 derp.address,
    //                 _minRedeemRatio,
    //                 _maxRedeemRatio,
    //                 _minRedeemDuration,
    //                 _maxRedeemDuration,
    //                 _totalRewards,
    //                 time.latest()
    //             ]
    //         })

    //         await derp.mint(ethers.parseEther("100"))
    //         await derp.approve(xDerp.getAddress(), MaxUint256)

    //         return { owner, otherAccount, xDerp, derp };
    //     }
    // )

    const deployFixture = async () => {
        const currentTimestamp = await time.latest()
        // const { deploy } = deployments

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();
        const DerpFactory = await ethers.getContractFactory("ERC20")
        const derp = await DerpFactory.deploy()
        await derp.waitForDeployment()
        await derp.initialize()


        const xDerpFactory = await ethers.getContractFactory("xDERP");

        const xDerp = await xDerpFactory.deploy();
        await xDerp.waitForDeployment()

        await derp.mint(_totalRewards + (ethers.parseEther("100")))
        await derp.approve(xDerp.getAddress(), MaxUint256)


        await xDerp.initialize(
            await derp.getAddress(),
            _minRedeemRatio,
            _maxRedeemRatio,
            _minRedeemDuration,
            _maxRedeemDuration,
            owner.address
        )

        return { owner, otherAccount, xDerp, derp, currentTimestamp };
    }


    describe("Deployment", function () {
        it("Should stake and correctly", async function () {
            const { owner, otherAccount, xDerp, derp } = await loadFixture(deployFixture);
            // const { derp, xDerp, owner, otherAccount } = await deployFixture()
            const amount = parseEther("100")

            await xDerp.connect(owner).stake(amount)

            await expect(xDerp.redeem(amount, time.duration.days(1))).to.be.revertedWithCustomError(xDerp, "DURATION_TOO_LOW")

            await xDerp.redeem(amount, _minRedeemDuration + 1)
            await expect(xDerp.finalizeRedeem(0)).to.be.revertedWithCustomError(xDerp, "DURATION_NOT_ENDED")

            await time.increaseTo(await time.latest() + _minRedeemDuration + 2)
            const balanceBefore = await derp.balanceOf(owner.address)
            await xDerp.finalizeRedeem(0)
            const balanceAfter = await derp.balanceOf(owner.address)

            expect(balanceAfter).to.be.equal(balanceBefore + (balanceBefore * BigInt(42) / BigInt(100)))
        });

        // it('Should collect rewards correctly', async () => {
        //     const { owner, otherAccount, xDerp, derp } = await loadFixture(deployFixture);
        //     const amount = parseEther("100")

        //     await xDerp.connect(owner).stake(amount)

        //     await xDerp.updatePool()

        //     const rewards = await xDerp.pendingRewards(owner.address)
        //     console.log('rewards', rewards.toString())
        //     const balanceBefore = await derp.balanceOf(owner.address)
        //     await xDerp.claimRewards()
        //     const balanceAfter = await derp.balanceOf(owner.address)
        //     console.log('claimed: ', (balanceAfter - balanceBefore).toString())

        //     // await xDerp.redeem(amount, _minRedeemDuration + 1)
        //     // await time.increaseTo(await time.latest() + _minRedeemDuration + 2)
        //     // await xDerp.finalizeRedeem(0)


        // })

        it('Should revert on xDerpTransfer', async () => {
            const { owner, otherAccount, xDerp, derp } = await loadFixture(deployFixture);
            const amount = parseEther("100")
            await xDerp.connect(owner).stake(amount)

            expect(await xDerp.balanceOf(owner.address)).to.be.equal(amount.toString())

            await expect(xDerp.transfer(otherAccount.address, "1")).to.be.revertedWithCustomError(xDerp, "NOT_WHITELISTED")

        })
    });

});
