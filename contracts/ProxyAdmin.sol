import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract Admin is ProxyAdmin {
    constructor() ProxyAdmin() {}
}