// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.29;

import { IReactive } from "../lib/reactive-lib-omni/src/interfaces/IReactive.sol";
import { AbstractReactive } from "../lib/reactive-lib-omni/src/base/AbstractReactive.sol";

/// @title Xfers — 监控 Sepolia 上 ERC-20 Transfer 的最小 reactive 合约（共学营「第一次部署」任务）
/// @notice 订阅 Sepolia 所有 ERC-20 Transfer 事件，累计每个 token 的 turnover，
///         达到处理次数上限后自动退订。改编自官方示例：
///         https://github.com/Reactive-Network/reactive-smart-contract-demos/tree/omni/src/micro-demos/Xfers.sol
contract Xfers is AbstractReactive {
    event Turnover(address indexed token_, uint256 indexed volume_);

    struct Transfer {
        uint256 tokens;
    }

    uint256 private constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 private constant ERC20_TRANSFER_TOPIC_0 =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    address public immutable owner;
    uint256 public limit;
    uint256 public lastTxHash;
    uint256 public lastReactBlockNumber;
    mapping(address => uint256) public turnovers;

    constructor(uint256 limit_) payable {
        owner = msg.sender;
        limit = limit_;
        _sub();
    }

    function updateLimit(uint256 limit_) external payable {
        require(msg.sender == owner, "not owner");
        limit = limit_;
        if (limit_ == 0) {
            _unsub();
        } else {
            _coverDebt();
            _sub();
        }
    }

    function react(LogRecord calldata log_) external onlySystem {
        if (log_.opCode == 3) {
            lastTxHash = log_.txHash;
            lastReactBlockNumber = block.number;
            Transfer memory xfer = abi.decode(log_.data, (Transfer));
            turnovers[log_.contractAddress] += xfer.tokens;
            emit Turnover(log_.contractAddress, xfer.tokens);
            if (--limit == 0) {
                _unsub();
            }
        }
    }

    function _sub() internal {
        SYSTEM.subscribe(
            SEPOLIA_CHAIN_ID,
            address(0),
            ERC20_TRANSFER_TOPIC_0,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE
        );
    }

    function _unsub() internal {
        SYSTEM.unsubscribe(
            SEPOLIA_CHAIN_ID,
            address(0),
            ERC20_TRANSFER_TOPIC_0,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE
        );
    }
}
