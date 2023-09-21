// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./lib/AntiSnipe.sol";

contract Derp is ERC20, AntiSnipe {
    constructor() ERC20("Derp", "DERP") {
        _mint(msg.sender, 100_000_000_000_000 ether);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal view override {
        super._beforeTokenTransfer(from, to, amount, balanceOf(to));
    }
}