// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test stand-in for a Robinhood Chain Stock Token: plain 18-decimal ERC-20,
/// an ERC-8056-style uiMultiplier that never touches raw balances, and an
/// issuer pause that blocks all transfers.
contract MockStockToken is ERC20 {
    uint256 public uiMultiplier = 1e18;
    bool public paused;

    error IsPaused();

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setUIMultiplier(uint256 m) external {
        uiMultiplier = m;
    }

    function setPaused(bool p) external {
        paused = p;
    }

    function balanceOfUI(address account) external view returns (uint256) {
        return balanceOf(account) * uiMultiplier / 1e18;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused) revert IsPaused();
        super._update(from, to, value);
    }
}
