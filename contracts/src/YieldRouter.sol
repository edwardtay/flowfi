// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title YieldRouter
/// @notice Entry point for LI.FI destination calls. Routes funds to yield vaults.
contract YieldRouter {
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;
    PoolSwapTest public immutable swapRouter;

    // Mapping of token -> default vault (can be overridden per-call)
    mapping(address => address) public defaultVaults;

    address public owner;

    error Unauthorized();
    error InvalidAmount();
    error TransferFailed();

    event DepositRouted(
        address indexed recipient,
        address indexed token,
        address indexed vault,
        uint256 amount
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(IPoolManager _poolManager, PoolSwapTest _swapRouter) {
        poolManager = _poolManager;
        swapRouter = _swapRouter;
        owner = msg.sender;
    }

    /// @notice Set default vault for a token
    function setDefaultVault(address token, address vault) external onlyOwner {
        defaultVaults[token] = vault;
    }

    /// @notice Main entry point - called by LI.FI after bridging
    /// @param recipient The final recipient (ENS-resolved address)
    /// @param vault The ERC-4626 vault to deposit into (from ENS text record)
    /// @param token The token being deposited (USDC)
    /// @param amount The amount to deposit
    function depositToYield(
        address recipient,
        address vault,
        address token,
        uint256 amount
    ) external {
        if (amount == 0) revert InvalidAmount();

        // Pull tokens from caller (LI.FI executor)
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Use provided vault or fall back to default
        address targetVault = vault != address(0) ? vault : defaultVaults[token];

        if (targetVault != address(0)) {
            // Deposit to ERC-4626 vault
            IERC20(token).approve(targetVault, amount);
            IERC4626(targetVault).deposit(amount, recipient);
        } else {
            // No vault configured - send directly to recipient
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit DepositRouted(recipient, token, targetVault, amount);
    }

    /// @notice Alternative entry with swap through V4 pool first
    /// @dev Used when incoming token needs to be swapped before vault deposit
    function swapAndDeposit(
        address recipient,
        address vault,
        PoolKey calldata poolKey,
        SwapParams calldata swapParams
    ) external {
        // hookData encodes recipient + vault for YieldHook
        bytes memory hookData = abi.encode(recipient, vault);

        // Execute swap - YieldHook.afterSwap handles the deposit
        swapRouter.swap(poolKey, swapParams, PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        }), hookData);
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
