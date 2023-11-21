const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect, util } = require("chai");
const { ethers, deployments } = require("hardhat");
const { MaxUint256, parseEther, formatEther } = require("ethers");

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
        const [owner, foundation, otherAccount] = await ethers.getSigners();
        const DerpFactory = await ethers.getContractFactory("MOCKERC20")
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
            owner.address,
            foundation.address,
        )

        const YieldBoosterFactory = await ethers.getContractFactory("MockAllocator");
        const yieldBooster = await YieldBoosterFactory.deploy();

        return { owner, otherAccount, xDerp, derp, yieldBooster, currentTimestamp };
    }


    describe("Deployment", function () {
        it("Should stake and correctly", async function () {
            const { owner, otherAccount, xDerp, derp } = await loadFixture(deployFixture);
            // const { derp, xDerp, owner, otherAccount } = await deployFixture()
            const amount = parseEther("100")

            await xDerp.connect(owner).stake(amount)

            await expect(xDerp.redeem(amount, time.duration.days(1))).to.be.revertedWithCustomError(xDerp, "DURATION_TOO_LOW")

            await xDerp.redeem(amount, _minRedeemDuration)
            await expect(xDerp.finalizeRedeem(0)).to.be.revertedWithCustomError(xDerp, "DURATION_NOT_ENDED")

            await time.increaseTo(await time.latest() + _minRedeemDuration + 2)
            const balanceBefore = await derp.balanceOf(owner.address)
            await xDerp.finalizeRedeem(0)
            const balanceAfter = await derp.balanceOf(owner.address)

            expect(balanceAfter).to.be.equal(balanceBefore + (amount * BigInt(42) / BigInt(100)))
        });

        it("Should revert if duration is more or less", async function () {
            const { owner, otherAccount, xDerp, derp } = await loadFixture(deployFixture);
            // const { derp, xDerp, owner, otherAccount } = await deployFixture()
            const amount = parseEther("100")

            await xDerp.connect(owner).stake(amount)
            await expect(xDerp.redeem(amount, time.duration.days(1))).to.be.revertedWithCustomError(xDerp, "DURATION_TOO_LOW")
            await expect(xDerp.redeem(amount, _minRedeemDuration -1)).to.be.revertedWithCustomError(xDerp, "DURATION_TOO_LOW")
            await expect(xDerp.redeem(amount, _minRedeemDuration +1)).to.be.revertedWithCustomError(xDerp, "INVALID_DURATION")
            
            //should revert if duration is less than max
            await expect(xDerp.redeem(amount, _maxRedeemDuration -1)).to.be.revertedWithCustomError(xDerp, "INVALID_DURATION")

            //redeem after duration should work
            await xDerp.redeem(amount, _maxRedeemDuration +1)


        })

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

        it('Should allocate and deAllocate correctly', async() => {
            const { owner, otherAccount, xDerp, derp, yieldBooster } = await loadFixture(deployFixture);
            const amount = parseEther("100")
            const allocateAmount = amount / 2n
            const tokenId = 1
            const startTime = await time.latest()
            const duration = time.duration.days(30)
            const key = {
                rewardToken: derp.getAddress(),
                pool: ethers.ZeroAddress,
                startTime: startTime,
                endTime: startTime + time.duration.days(30),
                refundee: otherAccount.address,
            }

            await xDerp.connect(owner).stake(amount)
            let balanceBefore = await derp.balanceOf(owner.address)
            let xderpBalanceBefore = await xDerp.balanceOf(owner.address)
            await xDerp.connect(owner).allocate(yieldBooster.getAddress(), tokenId, allocateAmount, duration, key)
            await expect(xDerp.connect(owner).balanceOf(owner.address)).to.eventually.equal(xderpBalanceBefore-allocateAmount)

            //Should not be able to redeem allocated funds without deallocating first
            await expect(xDerp.connect(owner).redeem(amount, _minRedeemDuration )).to.be.revertedWith("ERC20: transfer amount exceeds balance")
            await expect(xDerp.connect(owner).redeem((amount/2n) +1n, _minRedeemDuration)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
            
            await xDerp.connect(owner).redeem(amount/2n, _minRedeemDuration)
            await time.increase(_minRedeemDuration + 2)
            await xDerp.connect(owner).finalizeRedeem(0)
            await expect(await derp.balanceOf(owner.address)).to.be.equal(balanceBefore + ((amount/2n) * BigInt(42) / BigInt(100)))
            const redeemInfo = await xDerp.redeems(owner.address, 0)
            expect(redeemInfo[0]).to.be.equal(0)
            expect(redeemInfo[1]).to.be.equal(0)
            expect(redeemInfo[2]).to.be.equal(0)
            expect(redeemInfo[3]).to.be.equal(0)
            await xDerp.connect(owner).deAllocate(yieldBooster.getAddress(), tokenId, allocateAmount, key)
            await expect(xDerp.connect(owner).balanceOf(owner.address)).to.eventually.equal(allocateAmount)
        })
    });

});
