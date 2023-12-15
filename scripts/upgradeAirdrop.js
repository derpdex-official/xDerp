const hre = require("hardhat");

const airdropAddress = "0xA8209b117F0799a8666c7a366AaA970d11105f47"

const gasPrice = 8000000
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    console.log(`upgrading DerpAirdrop \n`)
    const Airdrop = await hre.ethers.getContractFactory("DerpAirdrop");
    await hre.upgrades.upgradeProxy(airdropAddress, Airdrop, {
        gasPrice
    });


    await hre.run("verify:verify", {
        address: airdropAddress,
    })

}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})