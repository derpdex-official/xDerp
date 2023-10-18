contract MockDerpStaking {
    struct IncentiveKey {
        address rewardToken;
        address pool;
        uint256 startTime;
        uint256 endTime;
        address refundee;
    }

    function boost(
        address user,
        uint256 tokenId,
        uint256 xDerpAmount,
        IncentiveKey calldata key
    ) external {}

    function unBoost(
        address user,
        uint256 tokenId,
        uint256 xDerpAmount,
        IncentiveKey calldata key
    ) external {}
}
