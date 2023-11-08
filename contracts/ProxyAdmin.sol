// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract Admin is ProxyAdmin {
    constructor() ProxyAdmin() {}
}