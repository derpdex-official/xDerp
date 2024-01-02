const hre = require("hardhat");

const airdropAddress = "0xab886754C9daDeDab8Ed8a0ebbD32db0E3aC3158"

const gasPrice = 8000000
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    console.log(`upgrading DerpAirdrop \n`)
    const Airdrop = await hre.ethers.getContractFactory("DerpAirdrop");
    await hre.upgrades.upgradeProxy(airdropAddress, Airdrop, {
        gasPrice
    });

    // const airdrop = Airdrop.attach(airdropAddress)
    // await airdrop.postUpgrade({ gasPrice })


    await hre.run("verify:verify", {
        address: airdropAddress,
    })

}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})