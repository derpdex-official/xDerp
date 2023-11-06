const { ethers, upgrades, run } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    const DERP = await ethers.getContractFactory("Derp", deployer);
    const derp = await DERP.deploy({/* gasPrice: 1000000000, nonce: 0 */});
    const derpAddress = await derp.getAddress();

    console.log("DERP deployed to:", derpAddress);

    await derp.deploymentTransaction().wait(1);

    await run("verify:verify", {
        address: derpAddress
    })
}


main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})