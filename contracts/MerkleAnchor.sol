// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MerkleAnchor {
    event RootAnchored(bytes32 root, address indexed sender, uint256 timestamp);

    mapping(bytes32 => uint256) public anchoredAt;

    function anchor(bytes32 root) external {
        require(root != bytes32(0), "Root cannot be zero");
        require(anchoredAt[root] == 0, "Root already anchored");
        anchoredAt[root] = block.timestamp;
        emit RootAnchored(root, msg.sender, block.timestamp);
    }

    function isAnchored(bytes32 root) external view returns (bool) {
        return anchoredAt[root] != 0;
    }

    function getAnchorTime(bytes32 root) external view returns (uint256) {
        return anchoredAt[root];
    }
}
