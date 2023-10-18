pragma solidity 0.8.10;
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract xDerpProxy is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}