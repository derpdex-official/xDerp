const { ethers, run } = require("hardhat");

const DerpAddress = "0xEbb78043e29F4af24E6266A7D142f5A08443969E"
const xDerpAddress = "0x983BA88d66291D5a62684F1fE01FF186f97aB455"
const WETHAddress = "0x4200000000000000000000000000000000000006"
const signer = "0x44FF96c404b90Be7aa273fF9486A15F603f7f9A0"
const swapRouter = "0xe36ABD2f6512fE90b7c9Ed920565bCCE7E86eE0d"
const xDerpPerc = "9000" //90%
const feePerc = "100" //1% 
const maxCapInUSD = hre.ethers.parseEther("10000") // 1 USD
const rewardParams = {
    // ogRewards: hre.ethers.parseEther("1000000000000"),
    ogRewards: hre.ethers.parseEther("0"),
    testnetRewards: ethers.parseEther("0"),
    blockchainRewards: ethers.parseEther("1000000000000"),
    phase1StartTime: "1703653200",
    phase2StartTime: "1704024000",
    phase2EndTime: "1704628800",
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