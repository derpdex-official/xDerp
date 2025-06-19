const { ethers, run } = require("hardhat");

const minRedeemRatio = "42"
const maxRedeemRatio = "100"
const minRedeemDuration = "2073600"
const maxRedeemDuration = "8294400"
const DerpAddress = "0xEbb78043e29F4af24E6266A7D142f5A08443969E"
const foundationAddress = "0x67eFD53CF44a97aBb378A3DCee233c0ADd93D400"

const gasPrice = 8000000

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deployer address:", deployer.address);
    const interface = new ethers.Interface(["function initialize(address,uint256,uint256,uint256,uint256,address,address)"])
    const data = interface.encodeFunctionData("initialize", [
        DerpAddress,
        minRedeemRatio,
        maxRedeemRatio,
        minRedeemDuration,
        maxRedeemDuration,
        deployer.address,
        foundationAddress
    ])

    await run("verify:verify", {
        address: '0x983BA88d66291D5a62684F1fE01FF186f97aB455',
        contract: "contracts/xDerpProxy.sol:xDerpProxy",
        constructorArguments: ['0xFFc0A847103f7422c9bc5685b8360d1395464ca8', '0x89043B5A9108f25f3Aa85354BeaB80D84ABc3926', data]
    })
}


main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})