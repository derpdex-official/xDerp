const { ethers, upgrades, run } = require("hardhat");

const proxyAdminAddress = "0xdad88e1030a3f4a124e962a80c9a4003a94c5600"
const airdropProxy = "0x7F481823893ca8B1171eBB99A98B17996660c3Fa"

const gasPrice = 8000000

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deployer address:", deployer.address);

    const DerpAirdrop = await ethers.getContractFactory("DerpAirdrop");
    console.log("Deploying DerpAirdrop Implementation...");
    const DerpAirdropImpl = await DerpAirdrop.deploy({ gasPrice })

    console.log(DerpAirdropImpl.deploymentTransaction().hash);
    await DerpAirdropImpl.waitForDeployment();
    const DerpAirdropImplAddress = await DerpAirdropImpl.getAddress();

    console.log("DerpAirdrop Impl deployed to:", DerpAirdropImplAddress);

    const ProxyAdmin = await ethers.getContractAt("Admin", proxyAdminAddress, deployer);
    await ProxyAdmin.upgrade(airdropProxy, DerpAirdropImplAddress);

    //verify
    await run("verify:verify", {
        address: DerpAirdropImplAddress
    })
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})