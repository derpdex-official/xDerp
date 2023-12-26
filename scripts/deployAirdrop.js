const hre = require("hardhat");

const DerpAddress = "0xEbb78043e29F4af24E6266A7D142f5A08443969E"
const xDerpAddress = "0x85Fb47a24aFEC3CBA80D439B8Cb108121De333d9"
const WETHAddress = "0x4200000000000000000000000000000000000006"
const signer = ""
const swapRouter = "0xC9fdf5CE4C657ed8289A7D9D1107Ea7D55dbd53F"
const xDerpPerc = "9000" //90%
const feePerc = "100" //1% 
const maxCapInUSD = hre.ethers.parseEther("") // 1 USD //max fee to be charged
const rewardParams = {
    ogRewards: hre.ethers.parseEther(""),
    testnetRewards: ethers.parseEther(""),
    blockchainRewards: ethers.parseEther(""),
    phase1StartTime: "",
    phase2StartTime: "",
    phase2EndTime: "",
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
        maxCapInUSD,
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