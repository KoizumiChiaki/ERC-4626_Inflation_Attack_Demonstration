// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title 存在 ERC-4626 通胀攻击风险的简化金库
/// @notice 故意缺少：虚拟份额、死份额、最低首存、deposit 最小份额校验
/// @dev 总资产 = 合约内代币余额（含攻击者直接 transfer 的“捐赠”）
contract VulnerableVault is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Redeem(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);

    constructor(IERC20 asset_) ERC20("Vulnerable Vault Share", "vSHARE") {
        asset = asset_;
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice 份额 = assets * supply / totalAssets()，向下取整
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 assets_ = totalAssets();
        if (supply == 0 || assets_ == 0) {
            return assets;
        }
        return (assets * supply) / assets_;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return shares;
        }
        return (shares * totalAssets()) / supply;
    }

    /// @notice 若舍入为 0 份，仍会收走资产但不铸份额 —— 漏洞核心
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = convertToShares(assets);
        asset.safeTransferFrom(msg.sender, address(this), assets);
        if (shares > 0) {
            _mint(receiver, shares);
        }
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assetsOut) {
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        assetsOut = convertToAssets(shares);
        _burn(owner, shares);
        asset.safeTransfer(receiver, assetsOut);
        emit Redeem(msg.sender, receiver, assetsOut, shares);
    }
}
