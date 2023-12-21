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

    // struct AirdropInfo {
    //     uint32 startTime;
    //     // uint32 phase1EndTime;
    //     // uint32 phase2EndTime;
    //     // uint16 phase1FeePerc; //2 decimals // 1000 for 10%
    // }

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

    uint256 public xDerpPerc; //2 decimals //9000 for 90%

    // AirdropInfo public airdropInfo;
    uint256 public airdropStartTime;
    uint256 public phase2StartTime;
    uint256 public phase2EndTime;
    
    IERC20Upgradeable public Derp;
    IxDerp public xDerp;
    address public WETH;
    address public signer;
    address public swapRouter;
    address public admin;

    mapping(bytes32 => bool) isSaltUsed;
    mapping(address => mapping(uint256 => UserInfo)) public userInfo;
    mapping(address => uint256) public totalClaimed;
    mapping(address => uint256) public count;
    mapping(uint256 => uint256) public totalClaimedPerPhase;
    uint256 public ogRemaining;
    uint256 public testnetRemaining;
    uint256 public blockchainRemaining;
    uint256 constant public price = 100000000000; //18 decimals
    uint256 public feePerc; //2 decimals // 100 for 1%

    error NOT_STARTED();
    error PHASE2_STARTED();
    error AIRDROP_ENDED();
    error PHASE_MISMATCH();
    error INVALID_SIGNATURE();
    error SIGNATURE_EXPIRED(); 
    error ONLY_ADMIN();
    error INVALID_SALT();
    error ALREADY_CLAIMED();

    modifier onlyAdmin {
        if(msg.sender != admin) {
            revert ONLY_ADMIN();
        }
        _;
    }

    event AdminChanged(address newAdmin, address oldAdmin);
    event Claim(address user, uint256 phase, uint256 taskId, uint256 reward);

    struct RewardParams {
        uint256 ogRewards;
        uint256 testnetRewards;
        uint256 blockchainRewards;
        uint256 phase1StartTime;
        uint256 phase2StartTime;
        uint256 phase2EndTime;
    }
    function initialize(
        IERC20Upgradeable _Derp,
        IxDerp _xDerp,
        address _WETH,
        address _signer,
        address _swapRouter,
        address _admin,
        uint256 _xDerpPerc,
        uint256 _feePerc,
        RewardParams calldata rewardParams
    ) external initializer {
        airdropStartTime = rewardParams.phase1StartTime;
        phase2StartTime = rewardParams.phase2StartTime;
        phase2EndTime = rewardParams.phase2EndTime;

        xDerp = _xDerp;
        Derp = _Derp;
        WETH = _WETH;
        signer = _signer;
        swapRouter = _swapRouter;
        admin = _admin;
        feePerc = _feePerc;
        ogRemaining = rewardParams.ogRewards;
        testnetRemaining = rewardParams.testnetRewards;
        blockchainRemaining = rewardParams.blockchainRewards;

        xDerpPerc = _xDerpPerc;

        Derp.approve(address(_xDerp), type(uint256).max);
    }

    struct FeeParams {
        uint256 minOut;
        uint256 phase2FeeAmountInETH;
        uint256 ETHPriceUSD;
        uint24 feeTier;
    }

    struct TaskParams {
        uint256 taskId;
        uint256 amount;
    }

    function claim(
        bytes calldata signature,
        uint256 expiry,
        uint256 phase,
        bytes32 salt,
        TaskParams[] calldata taskParams,
        FeeParams calldata feeParams
    ) external payable {
        if(block.timestamp < airdropStartTime) revert NOT_STARTED();
        if(block.timestamp < phase2StartTime && phase != 1) revert PHASE_MISMATCH();
        if(block.timestamp >= phase2StartTime && phase != 2 ) revert PHASE2_STARTED();
        if(block.timestamp >= phase2EndTime) revert AIRDROP_ENDED();
        if(isSaltUsed[salt]) revert INVALID_SALT();
        if(block.timestamp > expiry) revert SIGNATURE_EXPIRED();

        isSaltUsed[salt] = true;

        (uint256 claimableAmount, uint256 totalAmount, uint256 ogRewards, uint256 testnetReward, uint256 blockchainRewards) = getAmount(taskParams);

        ogRemaining -= ogRewards;
        testnetRemaining -= testnetReward;
        blockchainRemaining -= blockchainRewards;

        _verifySignature(signature, totalAmount, expiry, feeParams, salt, taskParams);

        userInfo[msg.sender][phase].lastClaimed = block.timestamp;
        userInfo[msg.sender][phase].claimedAmount += claimableAmount;
        totalClaimed[msg.sender] += claimableAmount;
        count[msg.sender]++;
        totalClaimedPerPhase[phase] += claimableAmount;

        _claim(claimableAmount);

        uint256 feeInETH = phase == 1 ? getETHAmount(claimableAmount, feeParams.ETHPriceUSD): feeParams.phase2FeeAmountInETH;
        if(msg.value > 0) {
            require(msg.value >= feeInETH, "AMOUNT_MISMATCH");
        } else {
            IERC20Upgradeable(WETH).transferFrom(msg.sender, address(this), feeInETH);
        }

        _swap(SwapParams(WETH, feeInETH, feeParams.minOut, feeParams.feeTier));

        uint256 excess = msg.value > feeInETH ? msg.value - feeInETH : 0;
        _refund(IERC20Upgradeable(WETH), excess);

        _logEvents(taskParams, phase, ogRewards, testnetReward, blockchainRewards, msg.sender);
    }

    function _logEvents(
        TaskParams[] calldata taskParams,
        uint256 phase,
        uint256 ogRewards,
        uint256 testnetRewards,
        uint256 blockchainRewards,
        address user
    ) internal {
        for (uint256 i = 0; i < taskParams.length; i++) {
            if (taskParams[i].taskId == 0) {
                emit Claim(user, phase, taskParams[i].taskId, ogRewards);
            }else if (taskParams[i].taskId == 1) {
                emit Claim(user, phase, taskParams[i].taskId, testnetRewards);
            } else if (taskParams[i].taskId == 2) {
                emit Claim(user, phase, taskParams[i].taskId, blockchainRewards);
            } else {
                emit Claim(user, phase, taskParams[i].taskId, taskParams[i].amount);
            }   
        }
    }

    function getAmount(
        TaskParams[] calldata taskParams
    )
        public
        view
        returns (
            uint256 claimableAmount,
            uint256 totalAmount,
            uint256 ogRewards,
            uint256 testnetRewards,
            uint256 blockchainRewards
        )
    {
        for (uint256 i = 0; i < taskParams.length; i++) {
            totalAmount += taskParams[i].amount;

            if (taskParams[i].taskId == 0) {
                ogRewards = checkOGrewards(taskParams[i].amount);
                claimableAmount += ogRewards;
            }else if (taskParams[i].taskId == 1) {
                testnetRewards = checkTestnetRewards(taskParams[i].amount);
                claimableAmount += testnetRewards;
            } else if (taskParams[i].taskId == 2) {
                blockchainRewards = checkBlockchainRewards(
                    taskParams[i].amount
                );
                claimableAmount += blockchainRewards;
            } else {
                claimableAmount += taskParams[i].amount;
            }   
        }
    }

    function checkOGrewards(uint256 amount) internal view returns (uint256 claimableAmount) {
        if(ogRemaining >= amount) claimableAmount = amount;
    }

    function checkTestnetRewards(uint256 amount) internal view returns (uint256 claimableAmount) {
        if(testnetRemaining >= amount) claimableAmount = amount;
    }

    function checkBlockchainRewards(uint256 amount) internal view returns (uint256 claimableAmount) {
        if(blockchainRemaining >= amount) claimableAmount = amount;
    }

    function getETHAmount(
        uint256 airdropAmount,
        uint256 ETHPriceUSD
    ) public view returns (uint256 feeInETH) {
        uint256 feeInDerp = airdropAmount * feePerc / 100_00; //1 percent of airdrop amount
        feeInETH = feeInDerp * price / ETHPriceUSD;
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
        uint256 totalAmount,
        uint256 expiry,
        FeeParams calldata feeParams,
        bytes32 salt,
        TaskParams[] calldata taskParams
    ) internal view {

        bytes32 taskParamsSerialized = serializeTaskParams(taskParams);
        bytes32 message = keccak256(
            abi.encodePacked(
                taskParamsSerialized, msg.sender, block.chainid, totalAmount, feeParams.feeTier, feeParams.ETHPriceUSD, feeParams.phase2FeeAmountInETH, salt, expiry
                )
            );
        bytes32 messageHash = ECDSAUpgradeable.toEthSignedMessageHash(message);

        if (signer != ECDSAUpgradeable.recover(messageHash, signature)) revert INVALID_SIGNATURE();
    }

    function serializeTaskParams(TaskParams[] calldata taskParams) internal pure returns (bytes32) {
        bytes memory result;
        for(uint256 i = 0; i < taskParams.length; i++) {
            result = abi.encodePacked(result, taskParams[i].taskId, taskParams[i].amount);
        }

        return keccak256(result);

    }

    function _swap(SwapParams memory swapParams) internal returns (uint256 amountOut) {
        if(swapParams.feeInCurrency == 0) return 0;
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

    function _refund(IERC20Upgradeable currency, uint256 amount) internal {
        if(amount == 0) return;

        if(amount > 0 && address(currency) == WETH && msg.value > 0) {
            (bool status,) = msg.sender.call{value: amount}("");
            require(status, "ETH_FAIL");
        }

        if(amount > 0 && address(currency) != WETH) {
            currency.transfer(msg.sender, amount);
        }
    }

    receive() external payable {}
}