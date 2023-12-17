interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract MockSwapRouter {
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

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        if(msg.value == 0) {
            // WETH9(params.tokenIn).deposit{value: msg.value}();
            IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        }
        return params.amountIn;
    }

    function refundETH() external {
        // payable(msg.sender).transfer(address(this).balance);
    }
}