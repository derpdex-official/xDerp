contract MockAllocator {

    struct IncentiveKey {
        address rewardToken;
        address pool;
        uint256 startTime;
        uint256 endTime;
        address refundee;
    }

    function allocate(
        address user,
        uint256 tokenId,
        uint256 xDerpAmount,
        uint256 duration,
        IncentiveKey calldata key
    ) external {}

    function deAllocate(
        address user,
        uint256 tokenId,
        uint256 xDerpAmount,
        IncentiveKey calldata key
    ) external {}
}