// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @notice Test double for the Reactive system contract (0x8888...8888). Records
/// subscribe() and requestCallback() calls so unit tests can assert on them.
contract MockSystem {
    event SubscribeCall(uint256 chainId, address contract_, uint256 t0, uint256 t1, uint256 t2, uint256 t3);
    event CallbackReq(uint8 version, bytes config);

    function subscribe(uint256 a, address b, uint256 c, uint256 d, uint256 e, uint256 f) external {
        emit SubscribeCall(a, b, c, d, e, f);
    }

    function unsubscribe(uint256, address, uint256, uint256, uint256, uint256) external {}

    function requestCallback(uint8 version, bytes calldata config) external {
        emit CallbackReq(version, config);
    }

    function requestCallbackV_1_0(uint256 chainId, address recipient, uint64 gasLimit, bytes calldata payload) external {}

    receive() external payable {}
}
