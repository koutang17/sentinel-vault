// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MonitorToken — 部署在 Sepolia 的测试代币，用于触发 Xfers 监控的 Transfer 事件。
contract MonitorToken is ERC20 {
    constructor() ERC20("MonitorToken", "MON") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
