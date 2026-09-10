// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PrivatumFactory} from "../src/PrivatumFactory.sol";

// Minimal forge-compatible script interface
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployScript {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (PrivatumFactory factory) {
        address entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789; // ERC-4337 EntryPoint v0.6

        vm.startBroadcast();
        factory = new PrivatumFactory(entryPoint);
        vm.stopBroadcast();

        // Robinhood Chain deployment target
        // Network: Robinhood Chain Mainnet (Chain ID: 4663)
        // EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
    }
}
