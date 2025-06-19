const { ethers } = require("hardhat");

async function main() {
    const contract = await ethers.getContractAt("Derp", '0x0bf4CB727b3f8092534D793893B2cC3348963dbf');
    // const tx = await contract.updateWhitelist('0xa5Cbf19baADd342789E94ACd030862791a00a8f3', true);
    // const tx = await contract.burn('0xa5Cbf19baADd342789E94ACd030862791a00a8f3', ethers.parseEther('100000000000000'));
    const tx = await contract.mint('0xa5Cbf19baADd342789E94ACd030862791a00a8f3', ethers.parseEther('3000000000'));
    // const tx = await contract.enableTrading();
    // const tx = await contract.transfer('0x5e731ce5eF76d495e4848422cE7F910AC65ffECA', ethers.parseEther('50000000'));
    await tx.wait();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });