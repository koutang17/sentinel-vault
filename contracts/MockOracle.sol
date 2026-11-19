// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @notice Controllable price feed for demos. Mirrors Chainlink's 8-decimal convention.
/// In production mode the reactive contract would subscribe to a Chainlink AggregatorV3
/// `AnswerUpdated` event instead; the interface we care about (an indexed price topic)
/// is the same shape.
contract MockOracle {
    uint256 public price; // 8 decimals
    address public immutable owner;

    event PriceUpdated(uint256 indexed price, uint256 indexed timestamp);

    error NotOwner();

    constructor(uint256 initialPrice_) {
        owner = msg.sender;
        price = initialPrice_;
        emit PriceUpdated(initialPrice_, block.timestamp);
    }

    function setPrice(uint256 newPrice_) external {
        if (msg.sender != owner) revert NotOwner();
        require(newPrice_ != 0, "zero price");
        price = newPrice_;
        emit PriceUpdated(newPrice_, block.timestamp);
    }
}
