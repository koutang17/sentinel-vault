// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.29;

import { IReactive } from "../lib/reactive-lib-omni/src/interfaces/IReactive.sol";
import { AbstractReactive } from "../lib/reactive-lib-omni/src/base/AbstractReactive.sol";

/// @title DynamicSub — 运行时动态订阅 / 退订的最小示例（共学营「场景小实验」选 B）
/// @notice 构造函数不订阅；owner 调 start() 在运行时新增订阅（只监控 Sepolia 上指定 token 的 Transfer），
///         每收到一次 react 计数 +1，达到 maxTriggers 后自动 unsubscribe，owner 也可随时 stop() 手动退订。
contract DynamicSub is AbstractReactive {
    event Triggered(uint256 indexed n, uint256 sourceTx);
    event Subscribed();
    event Unsubscribed(string reason);

    uint256 private constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 private constant ERC20_TRANSFER_TOPIC_0 =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    address public immutable owner;
    address public immutable token;
    uint256 public immutable maxTriggers;
    uint256 public count;
    bool public active;

    constructor(address token_, uint256 max_) payable {
        owner = msg.sender;
        token = token_;
        maxTriggers = max_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @notice 运行时新增订阅（演示「动态订阅」的增加）。
    function start() external payable onlyOwner {
        require(!active, "already active");
        _coverDebt();
        SYSTEM.subscribe(
            SEPOLIA_CHAIN_ID,
            token,
            ERC20_TRANSFER_TOPIC_0,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE
        );
        active = true;
        emit Subscribed();
    }

    /// @notice 运行时取消订阅（演示「动态订阅」的取消）。
    function stop() external onlyOwner {
        if (active) {
            _unsub();
            active = false;
            emit Unsubscribed("manual");
        }
    }

    function react(LogRecord calldata log_) external onlySystem {
        if (!active) return;
        count += 1;
        emit Triggered(count, log_.txHash);
        if (count >= maxTriggers) {
            _unsub();
            active = false;
            emit Unsubscribed("limit");
        }
    }

    function _unsub() internal {
        SYSTEM.unsubscribe(
            SEPOLIA_CHAIN_ID,
            token,
            ERC20_TRANSFER_TOPIC_0,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE
        );
    }
}
