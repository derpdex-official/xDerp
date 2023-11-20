const hre = require("hardhat");

const minRedeemRatio = "42"
const maxRedeemRatio = "100"
const minRedeemDuration = "2073600" //24 days
const maxRedeemDuration = "8294400" //96 days
const DerpAddress = ""
const foundationAddress = ""

const gasPrice = 8000000
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    console.log(`deploying xDerp \n`)
    const xDERP = await hre.ethers.getContractFactory("xDERP");
    const xDerp = await hre.upgrades.deployProxy(xDERP, [
        DerpAddress,
        minRedeemRatio,
        maxRedeemRatio,
        minRedeemDuration,
        maxRedeemDuration,
        deployer.address,
        foundationAddress
    ], {
        gasPrice
    });

    const xDerpAddress = await xDerp.getAddress();
    const xDerpImpl = await hre.upgrades.erc1967.getImplementationAddress(xDerpAddress);

    console.log("xDerp deployed to:", xDerpAddress);
    console.log("xDerp implementation deployed to:", xDerpImpl);

    console.log(`\n Verifying \n`)

    await hre.run("verify:verify", {
        address: xDerpImpl,
    })

    await hre.run("verify:verify", {
        address: xDerpAddress,
    })

}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})