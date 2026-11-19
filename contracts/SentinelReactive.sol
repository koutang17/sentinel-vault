// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "../lib/reactive-lib-omni/src/interfaces/ISystemContract.sol";
import "../lib/reactive-lib-omni/src/base/AbstractReactive.sol";

/// @title SentinelReactive
/// @notice Watches the MockOracle price on the origin chain (Base Sepolia) and, when the
/// price crosses the stop-loss or take-profit threshold, requests a callback to the
/// SentinelVault on the destination chain.
contract SentinelReactive is AbstractReactive {
    uint64 private constant GAS_LIMIT = 500_000;

    uint256 private immutable _originChainId;
    address private immutable _oracle;
    uint256 private immutable _topic0;
    uint256 private immutable _destChainId;

    address public owner;
    address public vault;
    bool public vaultSet;

    uint256 public stopLoss;
    uint256 public takeProfit;
    bool public triggered;

    event VaultSet(address vault);
    event ThresholdsUpdated(uint256 stopLoss, uint256 takeProfit);
    event Triggered(uint256 price, string reason);

    constructor(
        uint256 originChainId_,
        address oracle_,
        uint256 topic0_,
        uint256 destChainId_,
        uint256 stopLoss_,
        uint256 takeProfit_
    ) payable {
        owner = msg.sender;
        _originChainId = originChainId_;
        _oracle = oracle_;
        _topic0 = topic0_;
        _destChainId = destChainId_;
        stopLoss = stopLoss_;
        takeProfit = takeProfit_;
        SYSTEM.subscribe(originChainId_, oracle_, topic0_, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @notice Deploy order breaks the address cycle here: the vault needs this contract's
    /// address at construction, so the vault address is bound afterwards.
    function setVault(address vault_) external onlyOwner {
        require(!vaultSet, "vault already set");
        require(vault_ != address(0), "zero vault");
        vault = vault_;
        vaultSet = true;
        triggered = false;
        emit VaultSet(vault_);
    }

    /// @notice Re-arm with new thresholds.
    function updateThresholds(uint256 sl_, uint256 tp_) external onlyOwner {
        require(sl_ < tp_, "sl >= tp");
        stopLoss = sl_;
        takeProfit = tp_;
        triggered = false;
        emit ThresholdsUpdated(sl_, tp_);
    }

    function react(LogRecord calldata log_) external override onlySystem {
        // Only our oracle's PriceUpdated event on the origin chain.
        if (log_.topic0 != _topic0 || log_.contractAddress != _oracle) return;
        // PriceUpdated(uint256 indexed price, uint256 indexed timestamp) -> LOG3.
        if (log_.opCode < 3) return;
        if (triggered || !vaultSet) return;

        uint256 price = log_.topic1;
        if (price == 0) return;
        if (price > stopLoss && price < takeProfit) return; // inside the band: hold

        triggered = true;
        string memory reason = price <= stopLoss ? "STOP" : "TAKE_PROFIT";
        emit Triggered(price, reason);

        // First argument of the payload is the slot the proxy overwrites with this
        // contract's address; the vault uses it as the callback sender proof.
        bytes memory payload = abi.encodeWithSignature("execute(address,uint256)", address(0), price);
        ISystemContract.CallbackConfiguration_V_1_0 memory cfg = ISystemContract
            .CallbackConfiguration_V_1_0({
            chainId: _destChainId,
            recipient: vault,
            gasLimit: GAS_LIMIT,
            payload: payload
        });
        SYSTEM.requestCallback(ISystemContract.CallbackVersion.V_1_0, abi.encode(cfg));
    }
}
