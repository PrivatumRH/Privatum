// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PrivatumAccount} from "../src/PrivatumAccount.sol";
import {PrivatumFactory} from "../src/PrivatumFactory.sol";

interface Vm {
    function prank(address) external;
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function addr(uint256) external returns (address);
}

// Minimal forge-compatible test base interface
abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool condition) internal pure {
        require(condition, "Assertion failed: expected true");
    }

    function assertFalse(bool condition) internal pure {
        require(!condition, "Assertion failed: expected false");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "Assertion failed: uint256 mismatch");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "Assertion failed: address mismatch");
    }
}

contract PrivatumAccountTest is TestBase {
    PrivatumAccount public account;
    PrivatumFactory public factory;

    address public entryPoint = address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);
    address public shardA = address(0x1111111111111111111111111111111111111111);
    address public shardB = address(0x2222222222222222222222222222222222222222);
    address public shardC = address(0x3333333333333333333333333333333333333333);

    function setUp() public {
        factory = new PrivatumFactory(entryPoint);
        account = new PrivatumAccount(entryPoint, shardA, shardB, shardC);
    }

    function test_Initialization() public view {
        assertEq(account.shardA(), shardA);
        assertEq(account.shardB(), shardB);
        assertEq(account.shardC(), shardC);
        assertEq(account.THRESHOLD(), 2);
        assertEq(account.entryPoint(), entryPoint);
        assertEq(account.CHAIN_ID(), 4663);
    }

    function test_OwnerCheck() public view {
        assertTrue(account.isOwner(shardA));
        assertTrue(account.isOwner(shardB));
        assertTrue(account.isOwner(shardC));
        assertFalse(account.isOwner(address(0x4444)));
    }

    function test_FactoryPrediction() public {
        bytes32 salt = bytes32(uint256(1));
        address predicted = factory.getAddress(shardA, shardB, shardC, salt);
        PrivatumAccount created = factory.createAccount(shardA, shardB, shardC, salt);
        assertEq(address(created), predicted);
    }

    function test_InvalidSignatureLengthRejects() public view {
        bytes32 hash = keccak256("test_user_op");
        bytes memory shortSig = new bytes(65);
        uint256 validation = account.validateUserOpSignature(hash, shortSig);
        assertEq(validation, 1);
    }

    function test_ShardRotation() public {
        address newShardA = address(0x9999999999999999999999999999999999999999);
        
        // Impersonate entryPoint
        vm.prank(entryPoint);
        account.rotateShardA(newShardA);

        assertEq(account.shardA(), newShardA);
        assertTrue(account.isOwner(newShardA));
        assertFalse(account.isOwner(shardA));
    }

    function test_ShardRotationUnauthorizedRejects() public {
        address newShardA = address(0x9999999999999999999999999999999999999999);
        
        // Random unauthorized caller must revert
        vm.prank(address(0x1234));
        try account.rotateShardA(newShardA) {
            assertTrue(false); // Should have reverted
        } catch {
            assertTrue(true);
        }
    }

    function test_ValidTwoOfThreeSignature() public {
        uint256 keyA = 0x1111111111111111111111111111111111111111111111111111111111111111;
        uint256 keyB = 0x2222222222222222222222222222222222222222222222222222222222222222;
        address realShardA = vm.addr(keyA);
        address realShardB = vm.addr(keyB);
        PrivatumAccount testAcc = new PrivatumAccount(entryPoint, realShardA, realShardB, shardC);

        bytes32 userOpHash = keccak256("test_user_operation_hash");
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );

        (uint8 vA, bytes32 rA, bytes32 sA) = vm.sign(keyA, ethSignedMessageHash);
        (uint8 vB, bytes32 rB, bytes32 sB) = vm.sign(keyB, ethSignedMessageHash);

        bytes memory sigA = abi.encodePacked(rA, sA, vA);
        bytes memory sigB = abi.encodePacked(rB, sB, vB);
        bytes memory combined = abi.encodePacked(sigA, sigB);

        uint256 val = testAcc.validateUserOpSignature(userOpHash, combined);
        assertEq(val, 0); // 0 means validation success
    }

    function test_WrongSignerRejected() public {
        uint256 keyA = 0x1111111111111111111111111111111111111111111111111111111111111111;
        uint256 keyEvil = 0x6666666666666666666666666666666666666666666666666666666666666666;
        address realShardA = vm.addr(keyA);
        PrivatumAccount testAcc = new PrivatumAccount(entryPoint, realShardA, shardB, shardC);

        bytes32 userOpHash = keccak256("test_user_operation_hash");
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );

        (uint8 vA, bytes32 rA, bytes32 sA) = vm.sign(keyA, ethSignedMessageHash);
        (uint8 vEvil, bytes32 rEvil, bytes32 sEvil) = vm.sign(keyEvil, ethSignedMessageHash);

        bytes memory sigA = abi.encodePacked(rA, sA, vA);
        bytes memory sigEvil = abi.encodePacked(rEvil, sEvil, vEvil);
        bytes memory combined = abi.encodePacked(sigA, sigEvil);

        uint256 val = testAcc.validateUserOpSignature(userOpHash, combined);
        assertEq(val, 1); // 1 means signature verification failed
    }
}
