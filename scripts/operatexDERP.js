const { ethers } = require("hardhat");

async function main() {
    const contract = await ethers.getContractAt("xDERP", '0x85Fb47a24aFEC3CBA80D439B8Cb108121De333d9');
    const tx = await contract.updateWhitelist('0xab886754C9daDeDab8Ed8a0ebbD32db0E3aC3158', true);
    // const tx = await contract.burn('0xa5Cbf19baADd342789E94ACd030862791a00a8f3', ethers.parseEther('100000000000000'));
    // const tx = await contract.mint('0xa5Cbf19baADd342789E94ACd030862791a00a8f3', ethers.parseEther('3000000000'));
    // const tx = await contract.enableTrading();
    // const tx = await contract.transfer('0x5e731ce5eF76d495e4848422cE7F910AC65ffECA', ethers.parseEther('50000000'));
    await tx.wait();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });