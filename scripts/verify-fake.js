const { ethers, run } = require("hardhat");

const minRedeemRatio = "42"
const maxRedeemRatio = "100"
const minRedeemDuration = "2073600"
const maxRedeemDuration = "8294400"
const DerpAddress = "0x9ad275b3c362d250c9252f8a86d0f66d94bd2c51"
const foundationAddress = "0xfD848A8bD6C1A583B52bA8630C48172FB3d57b66"

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
        address: '0xfFc5bC809bbE71FCb47E9b30ab700eE7394B0838',
        contract: "contracts/xDerpProxy.sol:xDerpProxy",
        constructorArguments: ['0xcFA8eCbe385e14A2B894d813254ABFea38428071', '0xC79eEd5B19EC01E9411867118057c8e487cA58F5', data]
    })
}


main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})