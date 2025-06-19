const { ethers, upgrades, run } = require("hardhat");
const { getImplementationAddress } = require('@openzeppelin/upgrades-core')

const minRedeemRatio = "42"
const maxRedeemRatio = "100"
const minRedeemDuration = "30" //"2073600"
const maxRedeemDuration = "120" //8294400"

const DerpAddress = "0xE564Cc37FbAb4B4b71BD76AD8EB0AF6726B6b7D2"

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    // const MockERC20Factory = await ethers.getContractFactory("MOCKERC20");
    // console.log("Deploying MockERC20...");
    // const MockERC20 = await MockERC20Factory.deploy({/* gasPrice: 1000000000, nonce:34 */});
    // await MockERC20.deploymentTransaction().wait(1);
    // const MockERC20 = await ethers.getContractAt("MOCKERC20", "0xac465de4d7Fbdc2e3c33f303147298200357CbFE");
    // console.log("MockERC20 deployed to:", await MockERC20.getAddress());

    const xDERP = await ethers.getContractFactory("xDERP");
    console.log("Deploying xDERP...");
    const xderp = await upgrades.deployProxy(xDERP, [
        DerpAddress,
        minRedeemRatio,
        maxRedeemRatio,
        minRedeemDuration,
        maxRedeemDuration,
        deployer.address,
        deployer.address
    ], {
        gasPrice: 11000000000,
        // nonce: 53
    });
    // const xderp = await upgrades.upgradeProxy("0x93B569efC1487a3CA0b4F52d0762b81018E3ab49", xDERP, {
    //     gasPrice: 12000000000,
    //     nonce: 230
    // })
    await xderp.waitForDeployment();
    const xDERPAddress = await xderp.getAddress();
    console.log("xDERP deployed to:", xDERPAddress);
    const xDERP_Implementation = await upgrades.erc1967.getImplementationAddress(xDERPAddress);
    console.log("xDERP Implementation deployed to:", xDERP_Implementation);

    //verify
    // await run("verify:verify", {
    //     address: await MockERC20.getAddress()
    // })

    await run("verify:verify", {
        address: xDERP_Implementation
    })

    await run("verify:verify", {
        address: xDERPAddress
    })
}


main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})