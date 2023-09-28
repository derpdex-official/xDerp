// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

interface IxDerp is IERC20Upgradeable {
    function stake(uint256 amount) external;
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function refundETH() external payable;
}


contract DerpAirdrop is Initializable {

    struct AirdropInfo {
        uint32 startTime;
        uint32 phase1EndTime;
        uint32 phase2EndTime;
        // uint16 phase1FeePerc; //2 decimals // 1000 for 10%
    }

    struct SwapParams {
        address currency;
        uint256 feeInCurrency;
        uint256 minOut;
        uint24 feeTier;
    }

    struct UserInfo {
        uint256 lastClaimed;
        uint256 claimedAmount;
    }

    struct GenesisPoolInfo {
        uint256 rewardsClaimed;
        uint256 secondsClaimed;
    }

    //pool => tokenId => amountClaimed
    mapping(address => mapping(uint256 => uint256) ) public genesisRewardsByPosition;
    //pool => GenesisPoolInfo
    mapping (address => GenesisPoolInfo) public genesisPoolInfo;

    uint256 public xDerpPerc; //2 decimals

    AirdropInfo public airdropInfo;
    
    IERC20Upgradeable public Derp;
    IxDerp public xDerp;
    address public WETH;
    address public signer;
    address public swapRouter;
    address public admin;

    mapping(bytes32 => bool) isSaltUsed;

    error NOT_STARTED();
    error INVALID_SIGNATURE();
    error ONLY_ADMIN();
    error INVALID_SALT();

    modifier onlyAdmin {
        if(msg.sender != admin) {
            revert ONLY_ADMIN();
        }
        _;
    }

    event AdminChanged(address newAdmin, address oldAdmin);
    event Claim(address user, uint256 reward);


    function initialize(
        AirdropInfo calldata _airdropInfo,
        IERC20Upgradeable _Derp,
        IxDerp _xDerp,
        address _WETH,
        address _signer,
        address _swapRouter,
        address _admin,
        uint256 _xDerpPerc
    ) external initializer {
        airdropInfo = _airdropInfo;

        xDerp = _xDerp;
        Derp = _Derp;
        WETH = _WETH;
        signer = _signer;
        swapRouter = _swapRouter;
        admin = _admin;

        xDerpPerc = _xDerpPerc;

        Derp.approve(address(_xDerp), type(uint256).max);
    }

    function claim(uint256 amount, bytes calldata signature, SwapParams calldata swapParams, bytes32 salt) external payable {
        if(msg.value > 0) {
            require(swapParams.currency == WETH && msg.value == swapParams.feeInCurrency, "AMOUNT_MISMATCH");
        } else {
            IERC20Upgradeable(swapParams.currency).transferFrom(msg.sender, address(this), swapParams.feeInCurrency);
        }

        AirdropInfo memory _airdropInfo = airdropInfo;

        if(block.timestamp < _airdropInfo.startTime) revert NOT_STARTED();

        if(!_verifySignature(signature, amount, swapParams.feeInCurrency, swapParams.currency, salt)) {
            revert INVALID_SIGNATURE();
        }

        _swap(swapParams);

        if(block.timestamp < _airdropInfo.phase2EndTime) return _claim(amount);

        // if(block.timestamp < _airdropInfo.phase1EndTime) return _claimPhaseI(amount);

        // if(block.timestamp < _airdropInfo.phase2EndTime) return _claimPhaseII(amount);

        _refund(IERC20Upgradeable(swapParams.currency));

        emit Claim(msg.sender, amount);
    }

    function setxDerpPerc(uint256 _xDerpPerc) external onlyAdmin {
        xDerpPerc = _xDerpPerc;
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        address oldAdmin = admin;
        admin = newAdmin;

        emit AdminChanged(newAdmin, oldAdmin);
    }

    function changeSigner(address newSigner) external onlyAdmin() {
        signer = newSigner;
    }

    function adminRecover(IERC20Upgradeable token, address to, uint256 amount, bool isNative) external onlyAdmin {
        if(isNative) {
            (bool status,) = to.call{value: amount}("");
            require(status, "ETH_FAIL");
        } else {
            token.transfer(to, amount);
        }
    }

    // function getFeeInDerp(uint256 amount, AirdropInfo memory _airdropInfo) internal view returns (uint256) {
    //     if( block.timestamp > _airdropInfo.startTime &&
    //         block.timestamp < _airdropInfo.phase1EndTime
    //     ) {
    //         return airdropInfo.phase1FeePerc * amount / 100_00;
    //     }

    //     return 0;
    // }

    function _claim(
        uint256 amount
    ) internal {
        uint256 xDerpAmount = amount * xDerpPerc / 100_00;
        xDerp.stake(xDerpAmount);
        xDerp.transfer(msg.sender, xDerpAmount);
        Derp.transfer(msg.sender, amount - xDerpAmount);
    }

    function _verifySignature(
        bytes calldata signature, 
        uint256 amount,
        uint256 feeInCurrency,
        address currency,
        bytes32 salt
    ) internal returns (bool) {
        if(isSaltUsed[salt]) {
            //Salt is used in signature, so using random salt here will not work.
            //Purpose of salt is to prevent reusing the same signature multiple times.
            revert INVALID_SALT();
        }

        isSaltUsed[salt] = true;

        bytes32 message = keccak256(abi.encodePacked(amount, feeInCurrency, currency, salt)); //only currency is dynamic.
        bytes32 messageHash = ECDSAUpgradeable.toEthSignedMessageHash(message);

        return signer == ECDSAUpgradeable.recover(messageHash, signature);
    }

    function _swap(SwapParams memory swapParams) internal returns (uint256 amountOut) {
        if(
            msg.value == 0 && 
            IERC20Upgradeable(swapParams.currency).allowance(address(this), swapRouter) < swapParams.feeInCurrency
        ) {
            IERC20Upgradeable(swapParams.currency).approve(swapRouter, type(uint256).max);
        }
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: swapParams.currency,
            tokenOut: address(Derp),
            fee: swapParams.feeTier,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: swapParams.feeInCurrency,
            amountOutMinimum: swapParams.minOut,
            sqrtPriceLimitX96: 0
        });

        uint256 ETHNativeAmount = msg.value > 0 ? swapParams.feeInCurrency : 0;

        amountOut = ISwapRouter(swapRouter).exactInputSingle{value: ETHNativeAmount}(params);
        ISwapRouter(swapRouter).refundETH();   
    }

    function _refund(IERC20Upgradeable currency) internal {
        uint256 bal = address(this).balance;

        if(bal > 0) {
            (bool status,) = msg.sender.call{value: bal}("");
            require(status, "ETH_FAIL");
        }

        uint256 tokenBalance = currency.balanceOf(address(this));
        if (tokenBalance > 0) currency.transfer(msg.sender, tokenBalance);
    }

    receive() external payable {}
}