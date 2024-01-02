const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect, util } = require("chai");
const { ethers, deployments } = require("hardhat");
const { MaxUint256, parseEther } = require("ethers");
const { days, minutes } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration");

const _minRedeemRatio = "42"
const _maxRedeemRatio = "100"
const _minRedeemDuration = time.duration.days(24)
const _maxRedeemDuration = time.duration.days(96)
const _totalRewards = ethers.parseEther("10000000000")
const durationInSeconds = time.duration.days(30)
const xDERPPerc = 9000n //90% Xderp // 2 decimals
const derpFeePerc = 100n //1%
const maxCapInUSD = ethers.parseEther("1") //1 usd
const ogRewards = ethers.parseEther("10")
const testnetRewards = ethers.parseEther("10")
const blockchainRewards = ethers.parseEther("10")

describe("Airdrop", function () {
    const deployxDerp = async (owner) => {
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
            owner.address
        )

        return { derp, xDerp }
    }
    const deployFixture = async () => {
        // const { deploy } = deployments

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount, user3] = await ethers.getSigners();
        const { derp, xDerp } = await deployxDerp(owner)

        const currencyFactory = await ethers.getContractFactory("MOCKERC20")
        const currency = await currencyFactory.deploy()
        await currency.waitForDeployment()
        await currency.initialize()


        const DerpAirdropFactory = await ethers.getContractFactory("DerpAirdrop")
        const airdrop = await DerpAirdropFactory.deploy()
        await airdrop.waitForDeployment()

        const mockSwapRouterFactory = await ethers.getContractFactory("MockSwapRouter")
        const mockSwapRouter = await mockSwapRouterFactory.deploy()


        const currentTimestamp = await time.latest()
        await airdrop.initialize(
            await derp.getAddress(),
            await xDerp.getAddress(),
            await currency.getAddress(), //WETH
            owner.address,
            await mockSwapRouter.getAddress(),
            owner.address,
            xDERPPerc,
            derpFeePerc,
            maxCapInUSD,
            {
                ogRewards,
                testnetRewards,
                blockchainRewards,
                phase1StartTime: currentTimestamp,
                phase2StartTime: currentTimestamp + days(2),
                phase2EndTime: currentTimestamp + days(4),
            }
        )


        await derp.transfer(await airdrop.getAddress(), _totalRewards)

        await xDerp.updateWhitelist(await airdrop.getAddress(), true)

        // await currency.connect(otherAccount).mint(parseEther("100"))
        // await currency.connect(otherAccount).approve(await airdrop.getAddress(), MaxUint256)
        return { owner, otherAccount, user3, xDerp, derp, airdrop, currency };
    }


    const generateSignature = async (
        signer, taskParams, userAddress, chainId, airdropAmount, feeTier, ETHPrice, phase2FeeAmountInETH, phase
    ) => {
        const expiry = await time.latest() + minutes(3)

        let taskParamsSerialized = '0x'
        for (let i = 0; i < taskParams.length; i++) {
            taskParamsSerialized = ethers.solidityPacked(
                ["bytes", "uint256", "uint256"],
                [taskParamsSerialized, taskParams[i].taskId, taskParams[i].amount]
            )
        }
        // const TaskParams = [
        //     { name: "taskId", type: "uint256" },
        //     { name: "amount", type: "uint256" },
        //   ];
        // taskParamsSerialized = ethers.AbiCoder.defaultAbiCoder().encode([TaskParams], [taskParams])
        // console.log(taskParamsSerialized)
        // ethers.isHexString(taskParamsSerialized)
        // console.log(ethers.isBytesLike(taskParamsSerialized))
        // console.log(ethers.getBytes(taskParamsSerialized))
        // console.log('here')
        // console.log(ethers.getBytes(taskParamsSerialized))
        taskParamsSerialized = ethers.solidityPackedKeccak256(
            ['bytes'],
            [taskParamsSerialized]
        )
        // console.log("offchainhash", taskParamsSerialized)

        const nonceHash = ethers.solidityPackedKeccak256(["address", "uint256", "uint256"], [userAddress, phase, chainId])
        const message = ethers.solidityPackedKeccak256(
            ['bytes32', 'address', 'uint256', 'uint256', 'uint24', 'uint256', 'uint256', 'bytes32', 'uint256'],
            [taskParamsSerialized, userAddress, chainId, airdropAmount, feeTier, ETHPrice, phase2FeeAmountInETH, nonceHash, expiry]
        );
        // console.log(message)
        // console.log("params", [taskParamsSerialized, userAddress, chainId, airdropAmount, feeTier, nonceHash, expiry])

        const messageBytes = ethers.getBytes(message);
        const signature = await signer.signMessage(messageBytes);

        return {
            signature,
            nonceHash,
            chainId,
            expiry
        }
    }

    describe("Claim", function () {
        it("Should claim phase1 correctly", async function () {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: "0",
                ETHPriceUSD: ethers.parseEther("2000"),
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)

            const derpBalanceBefore = await derp.balanceOf(otherAccount.address)
            const xDerpBalanceBefore = await xDerp.balanceOf(otherAccount.address)
            // const currencyBalanceBefore = await currency.balanceOf(otherAccount.address)
            const currencyBalanceBefore = await ethers.provider.getBalance(otherAccount.address)

            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            const expectedFee = await airdrop.getETHAmount(airdropAmount, feeParams.ETHPriceUSD)
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: expectedFee
                }
            )

            const derpBalanceAfter = await derp.balanceOf(otherAccount.address)
            const xDerpBalanceAfter = await xDerp.balanceOf(otherAccount.address)
            // const currencyBalanceAfter = await currency.balanceOf(otherAccount.address)
            const currencyBalanceAfter = await ethers.provider.getBalance(otherAccount.address)
            const expectedxDerpAmount = airdropAmount * (xDERPPerc) / (10000n)
            const expectedDerpAmount = airdropAmount - expectedxDerpAmount
            console.log("expectedFee", expectedFee.toString())
            expect(xDerpBalanceAfter).to.be.equal(xDerpBalanceBefore + expectedxDerpAmount)
            expect(derpBalanceAfter).to.be.equal(derpBalanceBefore + expectedDerpAmount)
            expect(currencyBalanceAfter).to.be.closeTo(currencyBalanceBefore - expectedFee, parseEther("0.01"))

        });

        it("Fee should not exceed maxCapInUSD", async function () {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: "0",
                ETHPriceUSD: ethers.parseEther("200000"),
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("5000000000"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)
            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            const expectedFee = await airdrop.getETHAmount(airdropAmount, feeParams.ETHPriceUSD)
            expect(expectedFee).to.be.eq(parseEther(maxCapInUSD.toString()) / feeParams.ETHPriceUSD)
            const currencyBalanceBefore = await ethers.provider.getBalance(otherAccount.address)
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: expectedFee
                }
            )

            const currencyBalanceAfter = await ethers.provider.getBalance(otherAccount.address)
            expect(currencyBalanceAfter).to.be.closeTo(currencyBalanceBefore - expectedFee, parseEther("0.01"))
        })

        it("should not claim more", async () => {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: "0",
                ETHPriceUSD: ethers.parseEther("2000"),
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)
            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            const expectedFee = await airdrop.getETHAmount(airdropAmount, feeParams.ETHPriceUSD)
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: expectedFee
                }
            )

            await expect(airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: expectedFee
                }
            )).to.be.revertedWithCustomError(airdrop, "INVALID_SALT")

            const { signature: signature2, nonceHash: nonceHash2, amount: amount2, expiry: expiry2 } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )

            await expect(airdrop.connect(otherAccount).claim(
                signature2,
                expiry2,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: expectedFee
                }
            )).to.be.revertedWithCustomError(airdrop, "INVALID_SALT")
        })

        it("Should work with native currency", async () => {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: "0",
                ETHPriceUSD: ethers.parseEther("2000"),
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)

            const derpBalanceBefore = await derp.balanceOf(otherAccount.address)
            const xDerpBalanceBefore = await xDerp.balanceOf(otherAccount.address)

            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            const currencyBalanceBefore = await ethers.provider.getBalance(otherAccount.address)
            const expectedFee = await airdrop.getETHAmount(airdropAmount, feeParams.ETHPriceUSD)
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams, {
                value: ethers.parseEther("1")
            }
            )
            const currencyBalanceAfter = await ethers.provider.getBalance(otherAccount.address)

            const derpBalanceAfter = await derp.balanceOf(otherAccount.address)
            const xDerpBalanceAfter = await xDerp.balanceOf(otherAccount.address)

            const expectedxDerpAmount = airdropAmount * (xDERPPerc) / (10000n)
            const expectedDerpAmount = airdropAmount - expectedxDerpAmount
            expect(xDerpBalanceAfter).to.be.equal(xDerpBalanceBefore + expectedxDerpAmount)
            expect(derpBalanceAfter).to.be.equal(derpBalanceBefore + expectedDerpAmount)
            expect(currencyBalanceAfter).to.be.closeTo(currencyBalanceBefore - expectedFee, parseEther("0.01"))
        })


        it("should take fee correctly", async () => {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const ETHPriceUSD = ethers.parseEther("2000")
            const FIVE_USD_IN_ETH = ethers.parseEther("5") * ethers.parseEther("1") / ETHPriceUSD
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: FIVE_USD_IN_ETH,
                ETHPriceUSD: ETHPriceUSD,
                feeTier: "10000",
            }


            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)

            const currencyBalanceBefore = await ethers.provider.getBalance(otherAccount.address)

            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            const expectedFee = await airdrop.getETHAmount(airdropAmount, feeParams.ETHPriceUSD)
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams, {
                value: expectedFee
            }
            )
            const currencyBalanceAfter = await ethers.provider.getBalance(otherAccount.address)


            expect(currencyBalanceAfter).to.be.closeTo(currencyBalanceBefore - expectedFee, parseEther("0.01"))


            await time.increaseTo(await airdrop.phase2StartTime())
            //Phase 2 
            const { signature: signature2, nonceHash: nonceHash2, amount: amount2, expiry: expiry2 } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase + 1
            )
            const currencyBalanceBefore2 = await ethers.provider.getBalance(otherAccount.address)
            let tx = await airdrop.connect(otherAccount).claim(
                signature2,
                expiry2,
                phase + 1,
                nonceHash2,
                taskParams,
                feeParams,
                {
                    value: ethers.parseEther("1")
                }
            )
            const currencyBalanceAfter2 = await ethers.provider.getBalance(otherAccount.address)

            console.log("FIVE_USD_IN_ETH", FIVE_USD_IN_ETH)
            expect(currencyBalanceAfter2).to.be.closeTo(currencyBalanceBefore2 - FIVE_USD_IN_ETH, parseEther("0.01"))

        })

        it("Should claim phase2 correctly", async () => {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const ETHPriceUSD = ethers.parseEther("2000")
            const FIVE_USD_IN_ETH = ethers.parseEther("5") * ethers.parseEther("1") / ETHPriceUSD
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: FIVE_USD_IN_ETH,
                ETHPriceUSD: ETHPriceUSD,
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)

            const currencyBalanceBefore = await currency.balanceOf(otherAccount.address)

            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: parseEther("1")
                }
            )

            await time.increaseTo(await airdrop.phase2StartTime())
            const taskParams2 = [{
                taskId: 10, //different task id for phase2
                amount: ethers.parseEther("1"),
            }]
            const airdropAmount2 = taskParams2.reduce((acc, curr) => acc + curr.amount, 0n)

            const { signature: signature2, nonceHash: nonceHash2, amount: amount2, expiry: expiry2 } = await generateSignature(
                owner, taskParams2, otherAccount.address, 31337, airdropAmount2, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase + 1
            )

            const currencyBalanceBefore2 = await ethers.provider.getBalance(otherAccount.address)
            await airdrop.connect(otherAccount).claim(
                signature2,
                expiry2,
                phase + 1,
                nonceHash2,
                taskParams2,
                feeParams,
                {
                    value: parseEther("1")
                }
            )
            const currencyBalanceAfter2 = await ethers.provider.getBalance(otherAccount.address)
            expect(currencyBalanceAfter2).to.be.closeTo(currencyBalanceBefore2 - feeParams.phase2FeeAmountInETH, parseEther("0.01"))

        })
        it("Should claim FCFS correctly", async () => {
            const { owner, otherAccount, user3, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const ETHPriceUSD = ethers.parseEther("2000")
            const FIVE_USD_IN_ETH = ethers.parseEther("5") * ethers.parseEther("1") / ETHPriceUSD
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: FIVE_USD_IN_ETH,
                ETHPriceUSD: ETHPriceUSD,
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ogRewards,
            }, {
                taskId: 2,
                amount: testnetRewards,
            }, {
                taskId: 3,
                amount: ethers.parseEther("0"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)

            const currencyBalanceBefore = await currency.balanceOf(otherAccount.address)
            const derpBalanceBefore = await derp.balanceOf(otherAccount.address)

            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: parseEther("1")
                }
            )

            const derpBalanceAfter = await derp.balanceOf(otherAccount.address)
            const expectedxDerpAmount = airdropAmount * (xDERPPerc) / (10000n)
            const expectedDerpAmount = airdropAmount - expectedxDerpAmount
            expect(derpBalanceAfter).to.be.eq(derpBalanceBefore + expectedDerpAmount)

            const { signature: signature2, nonceHash: nonceHash2, expiry: expiry2 } = await generateSignature(
                owner, taskParams, user3.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )

            await currency.connect(user3).approve(await airdrop.getAddress(), MaxUint256)
            await currency.connect(user3).mint(parseEther("100"))
            const derpBalanceBefore2 = await derp.balanceOf(user3.address)
            await airdrop.connect(user3).claim(
                signature2,
                expiry2,
                phase,
                nonceHash2,
                taskParams,
                feeParams,
                {
                    value: parseEther("1")
                }
            )
            const derpBalanceAfter2 = await derp.balanceOf(user3.address)
            //Should not claim OG + testnet rewards as it is already claimed by otherAccount
            const expectedxDerpAmount2 = (taskParams[2].amount + taskParams[3].amount) * (xDERPPerc) / (10000n)
            const expectedDerpAmount2 = (taskParams[2].amount + taskParams[3].amount) - expectedxDerpAmount2
            await expect(derpBalanceAfter2).to.be.eq(derpBalanceBefore2 + expectedDerpAmount2)


        })

        it("admin should be able to recover all", async () => {
            const { owner, otherAccount, xDerp, derp, airdrop, currency } = await loadFixture(deployFixture);
            const phase = 1
            const feeParams = {
                minOut: "0",
                phase2FeeAmountInETH: "0",
                ETHPriceUSD: ethers.parseEther("2000"),
                feeTier: "10000",
            }

            const taskParams = [{
                taskId: 1,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 2,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: ethers.parseEther("1"),
            }, {
                taskId: 3,
                amount: parseEther("10"),
            }]
            const airdropAmount = taskParams.reduce((acc, curr) => acc + curr.amount, 0n)
            const { signature, nonceHash, amount, chainId, expiry } = await generateSignature(
                owner, taskParams, otherAccount.address, 31337, airdropAmount, 10000, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, phase
            )
            await airdrop.connect(otherAccount).claim(
                signature,
                expiry,
                phase,
                nonceHash,
                taskParams,
                feeParams,
                {
                    value: ethers.parseEther("1")
                }
            )

            // const { signature: signature2, nonceHash: nonceHash2 } = await generateSignature(
            //     owner, swapParams2.currency, otherAccount.address, 31337, airdropAmount * 2n, feeInCurrency, phase + 1, 10000
            // )

            // const derpBalanceBefore = await derp.balanceOf(otherAccount.address)
            // const xDerpBalanceBefore = await xDerp.balanceOf(otherAccount.address)
            // await airdrop.connect(otherAccount).claim(
            //     airdropAmount * 2n,
            //     signature2,
            //     swapParams2,
            //     nonceHash2,
            //     phase
            // )
            // const derpBalanceAfter = await derp.balanceOf(otherAccount.address)
            // const xDerpBalanceAfter = await xDerp.balanceOf(otherAccount.address)
            // const expectedxDerpAmount = airdropAmount * (xDERPPerc) / (10000n)
            // const expectedDerpAmount = airdropAmount - expectedxDerpAmount
            // expect(derpBalanceAfter).to.be.equal(derpBalanceBefore + expectedDerpAmount)
            // expect(xDerpBalanceAfter).to.be.equal(xDerpBalanceBefore + expectedxDerpAmount)


            const derpBalanceInContract = await derp.balanceOf(await airdrop.getAddress())
            const currencyBalanceInContract = await currency.balanceOf(await airdrop.getAddress())
            const nativeBalanceInContract = await ethers.provider.getBalance(await airdrop.getAddress())

            const adminDerpBalanceBefore = await derp.balanceOf(owner.address)
            const otherAccountDerpBalanceBefore = await derp.balanceOf(owner.address)
            const adminCurrencyBalanceBefore = await currency.balanceOf(owner.address)
            const adminNativeBalanceBefore = await ethers.provider.getBalance(owner.address)

            await airdrop.connect(owner).adminRecover(
                await currency.getAddress(),
                [owner.address],
                [currencyBalanceInContract],
                false
            )

            await airdrop.connect(owner).adminRecover(
                await derp.getAddress(),
                [owner.address, otherAccount.address],
                [derpBalanceInContract/2n, derpBalanceInContract/2n],
                false
            )

            await airdrop.connect(owner).adminRecover(
                await currency.getAddress(),
                [owner.address],
                [nativeBalanceInContract],
                true
            )

            const adminDerpBalanceAfter = await derp.balanceOf(owner.address)
            const otherAccountDerpBalanceAfter = await derp.balanceOf(owner.address)
            const adminCurrencyBalanceAfter = await currency.balanceOf(owner.address)
            const adminNativeBalanceAfter = await ethers.provider.getBalance(owner.address)

            expect(adminDerpBalanceAfter).to.be.equal(adminDerpBalanceBefore + (derpBalanceInContract/2n))
            expect(otherAccountDerpBalanceAfter).to.be.equal(otherAccountDerpBalanceBefore + (derpBalanceInContract/2n))
            expect(adminCurrencyBalanceAfter).to.be.equal(adminCurrencyBalanceBefore + (currencyBalanceInContract))
            // expect(adminNativeBalanceAfter).to.be.equal(adminNativeBalanceBefore + nativeBalanceInContract)

            const derpBalanceInContractAfter = await derp.balanceOf(await airdrop.getAddress())
            const currencyBalanceInContractAfter = await currency.balanceOf(await airdrop.getAddress())
            const nativeBalanceInContractAfter = await ethers.provider.getBalance(await airdrop.getAddress())

            expect(derpBalanceInContractAfter).to.be.equal(0n)
            expect(currencyBalanceInContractAfter).to.be.equal(0n)
            expect(nativeBalanceInContractAfter).to.be.equal(0n)
        })

    });

});
