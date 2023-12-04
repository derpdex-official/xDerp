import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
contract MOCKERC20 is ERC20BurnableUpgradeable {
    function initialize() external initializer{
        __ERC20_init("MockDerp","MOCKDERP");
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}