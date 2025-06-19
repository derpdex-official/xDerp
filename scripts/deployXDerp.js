const hre = require("hardhat");

const minRedeemRatio = "42"
const maxRedeemRatio = "100"
const minRedeemDuration = "2073600" //24 days
const maxRedeemDuration = "8294400" //96 days
const DerpAddress = "0x5DfC78C4D073fD343BC6661668948178522A0DE5"
const foundationAddress = "0x5346252c7c04dFa32B28511ED8F4A2a07689c2A4"

const gasPrice = 8000000
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    // console.log("Deploying contracts with the account:", deployer.address);

    // console.log(`deploying xDerp \n`)
    // const xDERP = await hre.ethers.getContractFactory("xDERP");
    // const xDerp = await hre.upgrades.deployProxy(xDERP, [
    //     DerpAddress,
    //     minRedeemRatio,
    //     maxRedeemRatio,
    //     minRedeemDuration,
    //     maxRedeemDuration,
    //     deployer.address,
    //     foundationAddress
    // ], {
    //     gasPrice
    // });

    // const xDerpAddress = await xDerp.getAddress();
    // const xDerpImpl = await hre.upgrades.erc1967.getImplementationAddress(xDerpAddress);

    // console.log("xDerp deployed to:", xDerpAddress);
    // console.log("xDerp implementation deployed to:", xDerpImpl);

    console.log(`\n Verifying \n`)

    await hre.run("verify:verify", {
        address: '0x9abeB04f7C9eA77CD14fcA8a39edaa58F26962Db',
    })

    await hre.run("verify:verify", {
        address: '0xfb13dcf64e14ac4403ed52cd690ea4641d90c4c6',
    })

}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})