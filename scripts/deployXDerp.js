const hre = require("hardhat");

const minRedeemRatio = "42"
const maxRedeemRatio = "100"
const minRedeemDuration = "2073600" //24 days
const maxRedeemDuration = "8294400" //96 days
const DerpAddress = "0xEbb78043e29F4af24E6266A7D142f5A08443969E"
const foundationAddress = "0x6685652b82241Bc7C8002da31207929A6542D1CB"

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