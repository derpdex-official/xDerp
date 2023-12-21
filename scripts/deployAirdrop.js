const hre = require("hardhat");

const startTime = "1701407784"
const DerpAddress = "0xac465de4d7Fbdc2e3c33f303147298200357CbFE"
const xDerpAddress = "0x93B569efC1487a3CA0b4F52d0762b81018E3ab49"
const WETHAddress = "0x4200000000000000000000000000000000000006"
const signer = "0xd20D67FCA86160810733431174608fBC4b33127A"
const swapRouter = "0xD16a32F1A8d2c6C9203A85Bf28AF8F94d84dF346"
const xDerpPerc = "9000" //90%
const feePerc = "100" //1% 
const rewardParams = {
    ogRewards: hre.ethers.parseEther("100"),
    testnetRewards: ethers.parseEther("100"),
    blockchainRewards: ethers.parseEther("100"),
    phase1StartTime: "1703152767",
    phase2StartTime: "1703325567",
    phase2EndTime: "1703498367",
}

const gasPrice = 8000000
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    console.log(`deploying airdrop \n`)
    const Airdrop = await hre.ethers.getContractFactory("DerpAirdrop");
    const airdrop = await hre.upgrades.deployProxy(Airdrop, [
        DerpAddress,
        xDerpAddress,
        WETHAddress,
        signer,
        swapRouter,
        deployer.address,
        xDerpPerc,
        feePerc,
        rewardParams
    ], {
        gasPrice
    });

    const airdropAddress = await airdrop.getAddress();
    const airdropImpl = await hre.upgrades.erc1967.getImplementationAddress(airdropAddress);

    console.log("airdrop deployed to:", airdropAddress);
    console.log("airdrop implementation deployed to:", airdropImpl);

    const xDerpContract = await hre.ethers.getContractAt("xDERP", xDerpAddress);
    await xDerpContract.updateWhitelist(airdropAddress, true, { gasPrice });

    console.log(`\n Verifying \n`)

    await hre.run("verify:verify", {
        address: airdropImpl,
    })

    await hre.run("verify:verify", {
        address: airdropAddress,
    })

}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})