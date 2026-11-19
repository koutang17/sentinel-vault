// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "../lib/reactive-lib-omni/src/base/AbstractCallback.sol";
import "../lib/reactive-lib-omni/src/interfaces/IPayable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MockOracle.sol";

/// @title SentinelVault
/// @notice Holds a user's ERC-20 position and exits it automatically when the oracle price
/// crosses a stop-loss or take-profit threshold. The exit is triggered by a cross-chain
/// callback from a SentinelReactive contract on the Reactive Network; the vault re-verifies
/// the price on-chain before releasing any funds.
contract SentinelVault is AbstractCallback {
    using SafeERC20 for IERC20;

    MockOracle public immutable oracle;
    IERC20 public immutable asset;
    address public immutable owner;

    uint256 public stopLoss;
    uint256 public takeProfit;
    bool public armed;
    bool public closed;

    event Deposited(address indexed user, uint256 amount);
    event Armed(uint256 stopLoss, uint256 takeProfit);
    event Disarmed();
    event VaultClosed(address indexed owner, uint256 exitPrice, uint256 reportedPrice, string reason);
    event Rescued(address token, address to, uint256 amount);

    error NotOwner();
    error NotArmed();
    error ThresholdNotMet(uint256 price);
    error InvalidThresholds();
    error NothingToRescue();

    constructor(IPayable callbackProxy_, address callbackSender_, address oracle_, address asset_)
        AbstractCallback(callbackProxy_, callbackSender_)
        payable
    {
        oracle = MockOracle(oracle_);
        asset = IERC20(asset_);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Funds the vault with the position asset.
    function deposit(uint256 amount_) external onlyOwner {
        asset.safeTransferFrom(msg.sender, address(this), amount_);
        emit Deposited(msg.sender, amount_);
    }

    /// @notice Arm the exit order. Prices use the oracle's 8-decimal convention.
    function arm(uint256 stopLoss_, uint256 takeProfit_) external onlyOwner {
        if (stopLoss_ == 0 || takeProfit_ == 0 || stopLoss_ >= takeProfit_) revert InvalidThresholds();
        armed = true;
        closed = false;
        stopLoss = stopLoss_;
        takeProfit = takeProfit_;
        emit Armed(stopLoss_, takeProfit_);
    }

    /// @notice Cancel the exit order. Funds stay in the vault until withdrawn.
    function disarm() external onlyOwner {
        armed = false;
        emit Disarmed();
    }

    /// @notice Owner withdrawal (before arming, or after a manual disarm).
    function withdraw(uint256 amount_) external onlyOwner {
        asset.safeTransfer(msg.sender, amount_);
    }

    /// @notice Callback entry point. Called by the callback proxy with the reactive
    /// contract's address injected as the first argument.
    function execute(address reactive_, uint256 reportedPrice_)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        if (!armed) revert NotArmed();
        uint256 current = oracle.price();
        bool stop = current <= stopLoss;
        bool take = current >= takeProfit;
        if (!stop && !take) revert ThresholdNotMet(current);

        armed = false;
        closed = true;
        uint256 bal = asset.balanceOf(address(this));
        if (bal > 0) {
            asset.safeTransfer(owner, bal);
        }
        string memory reason = stop ? "STOP" : "TAKE_PROFIT";
        emit VaultClosed(owner, current, reportedPrice_, reason);
    }

    /// @notice Settle outstanding callback-fee debt from the vault's own balance.
    function coverDebt() external {
        _coverDebt();
    }

    /// @notice Emergency recovery of a token accidentally sent to the vault.
    function rescue(address token_, address to_, uint256 amount_) external onlyOwner {
        if (token_ == address(asset) && armed) revert InvalidThresholds();
        uint256 bal = IERC20(token_).balanceOf(address(this));
        if (bal < amount_ || amount_ == 0) revert NothingToRescue();
        IERC20(token_).safeTransfer(to_, amount_);
        emit Rescued(token_, to_, amount_);
    }
}
