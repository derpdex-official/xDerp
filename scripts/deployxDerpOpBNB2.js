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

    const XDERP = await ethers.getContractFactory("xDERP");
    console.log("Deploying xDERP Implementation...");
    const xDERPImpl = await XDERP.deploy({ gasPrice })

    console.log(xDERPImpl.deploymentTransaction().hash);
    await xDERPImpl.waitForDeployment();
    const xDERPImplAddress = await xDERPImpl.getAddress();
    console.log("xDerp Impl deployed to:", xDERPImplAddress);

    console.log("Deploying Proxy Admin...");
    const ProxyAdmin = await ethers.getContractFactory("Admin")
    const proxyAdmin = await ProxyAdmin.deploy({ gasPrice })
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("Proxy Admin deployed to:", proxyAdminAddress);

    console.log("Deploying xDerp Proxy...");
    const Proxy = await ethers.getContractFactory("xDerpProxy")
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
    const proxy = await Proxy.deploy(xDERPImplAddress, proxyAdminAddress, data, { gasPrice })
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("xDerp Proxy deployed to:", proxyAddress);

    console.log(`\n Verifying \n`)
    //verify
    await run("verify:verify", {
        address: xDERPImplAddress
    })

    await run("verify:verify", {
        contract: "contracts/ProxyAdmin.sol:Admin",
        address: proxyAdminAddress
    })

    await run("verify:verify", {
        address: proxyAddress,
        contract: "contracts/xDerpProxy.sol:xDerpProxy",
        constructorArguments: [xDERPImplAddress, proxyAdminAddress, data]
    })
}


main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})