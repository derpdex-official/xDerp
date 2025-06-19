const { ethers, run } = require("hardhat");

const DerpAddress = "0xac465de4d7Fbdc2e3c33f303147298200357CbFE"
const xDerpAddress = "0x9F7999406D579b80b8ddabB8B106F4a22D057788"
const WETHAddress = "0x4200000000000000000000000000000000000006"
const signer = "0xfD848A8bD6C1A583B52bA8630C48172FB3d57b66"
const swapRouter = "0x27E361645A6E40679C4FA087b4f098ABd8073497"
const xDerpPerc = "9000" //90%
const feePerc = "100" //1% 
const maxCapInUSD = hre.ethers.parseEther("10000") // 1 USD
const rewardParams = {
    // ogRewards: hre.ethers.parseEther("1000000000000"),
    ogRewards: hre.ethers.parseEther("0"),
    testnetRewards: ethers.parseEther("0"),
    blockchainRewards: ethers.parseEther("1000"),
    phase1StartTime: "1703842614",
    phase2StartTime: "1703929014",
    phase2EndTime: "1704015414",
}

const gasPrice = 8000000

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deployer address:", deployer.address);

    const DerpAirdrop = await ethers.getContractFactory("DerpAirdrop");
    console.log("Deploying derpAirdrop Implementation...");
    const derpAirdropImpl = await DerpAirdrop.deploy({ gasPrice })

    console.log(derpAirdropImpl.deploymentTransaction().hash);
    await derpAirdropImpl.waitForDeployment();
    const derpAirdropImplAddress = await derpAirdropImpl.getAddress();
    console.log("derpAirdrop Impl deployed to:", derpAirdropImplAddress);

    console.log("Deploying Proxy Admin...");
    const ProxyAdmin = await ethers.getContractFactory("Admin")
    const proxyAdmin = await ProxyAdmin.deploy({ gasPrice })
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("Proxy Admin deployed to:", proxyAdminAddress);

    console.log("Deploying Proxy...");
    const Proxy = await ethers.getContractFactory("AirdropProxy")
    const initializeData = DerpAirdrop.interface.encodeFunctionData("initialize", [
        DerpAddress,
        xDerpAddress,
        WETHAddress,
        signer,
        swapRouter,
        deployer.address,
        xDerpPerc,
        feePerc,
        maxCapInUSD,
        rewardParams
    ])

    const proxy = await Proxy.deploy(derpAirdropImplAddress, proxyAdminAddress, initializeData, { gasPrice })
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("DerpAirdrop Proxy deployed to:", proxyAddress);

    // const xDerpContract = await ethers.getContractAt("xDERP", xDerpAddress);
    // await xDerpContract.updateWhitelist(proxyAddress, true, { gasPrice });

    console.log(`\n Verifying \n`)
    //verify
    await run("verify:verify", {
        address: derpAirdropImplAddress
    })

    await run("verify:verify", {
        contract: "contracts/ProxyAdmin.sol:Admin",
        address: proxyAdminAddress
    })

    await run("verify:verify", {
        address: proxyAddress,
        contract: "contracts/AirdropProxy.sol:AirdropProxy",
        constructorArguments: [derpAirdropImplAddress, proxyAdminAddress, initializeData]
    })
}


main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
})