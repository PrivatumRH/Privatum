// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PrivatumAccount
 * @notice ERC-4337 Compatible 2-of-3 Threshold Smart Account on Robinhood Chain
 * @dev Settles frontier assets USDG and ETH. Requires any 2 of 3 shards to authorize execution.
 */
contract PrivatumAccount {
    // Standard ERC-4337 UserOperation struct
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    // 3 Shard Owners
    address public shardA; // Client device shard
    address public shardB; // Co-signer server shard
    address public shardC; // Recovery / Rescue shard

    uint256 public constant THRESHOLD = 2;
    uint256 public constant CHAIN_ID = 4663; // Robinhood Chain Mainnet

    address public immutable entryPoint;

    event Executed(address indexed target, uint256 value, bytes data);
    event BatchExecuted(uint256 operationsCount);
    event Received(address indexed sender, uint256 amount);
    event ShardRotated(address indexed oldShard, address indexed newShard, uint8 shardIndex);

    error OnlyEntryPoint();
    error InvalidSignerCount();
    error InvalidSignatureLength();
    error SignatureVerificationFailed();
    error ExecutionFailed();

    modifier onlyAuthorized() {
        if (msg.sender != entryPoint && msg.sender != address(this)) revert OnlyEntryPoint();
        _;
    }

    constructor(address _entryPoint, address _shardA, address _shardB, address _shardC) {
        if (_shardA == address(0) || _shardB == address(0) || _shardC == address(0)) {
            revert InvalidSignerCount();
        }
        entryPoint = _entryPoint;
        shardA = _shardA;
        shardB = _shardB;
        shardC = _shardC;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /**
     * @notice Standard ERC-4337 EntryPoint verification hook
     * @param userOp The packed user operation
     * @param userOpHash Hash of the user operation
     * @param missingAccountFunds Gas prefund amount needed by EntryPoint
     * @return validationData 0 if valid, 1 if signature verification fails
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();

        validationData = validateUserOpSignature(userOpHash, userOp.signature);

        if (missingAccountFunds > 0) {
            (bool success,) = payable(entryPoint).call{value: missingAccountFunds}("");
            (success); // EntryPoint asserts proper prefund received
        }
    }

    /**
     * @notice Validates an ERC-4337 UserOperation against the 2-of-3 threshold signature
     * @param userOpHash Hash of the user operation
     * @param signature 130-byte signature payload consisting of two 65-byte ECDSA signatures (sig1 || sig2)
     * @return validationData 0 if valid, 1 if invalid
     */
    function validateUserOpSignature(
        bytes32 userOpHash,
        bytes calldata signature
    ) public view returns (uint256 validationData) {
        if (signature.length != 130) {
            return 1; // Validation failed
        }

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );

        address signer1 = recoverSigner(ethSignedMessageHash, signature[0:65]);
        address signer2 = recoverSigner(ethSignedMessageHash, signature[65:130]);

        if (signer1 == signer2 || signer1 == address(0) || signer2 == address(0)) {
            return 1; // Must be 2 distinct valid shards
        }

        uint256 validSignatures = 0;
        if (isOwner(signer1)) validSignatures++;
        if (isOwner(signer2)) validSignatures++;

        if (validSignatures >= THRESHOLD) {
            return 0; // Success
        }

        return 1;
    }

    /**
     * @notice Check if an address is one of the 3 shards
     */
    function isOwner(address account) public view returns (bool) {
        return account == shardA || account == shardB || account == shardC;
    }

    /**
     * @notice Rotate Shard A after emergency recovery (requires 2-of-3 threshold authorization via EntryPoint)
     */
    function rotateShardA(address newShardA) external onlyAuthorized {
        if (newShardA == address(0)) revert InvalidSignerCount();
        require(newShardA != shardB && newShardA != shardC, "Duplicate shard address");
        address oldShard = shardA;
        shardA = newShardA;
        emit ShardRotated(oldShard, newShardA, 1);
    }

    /**
     * @notice Rotate Shard C recovery key (requires 2-of-3 threshold authorization via EntryPoint)
     */
    function rotateShardC(address newShardC) external onlyAuthorized {
        if (newShardC == address(0)) revert InvalidSignerCount();
        require(newShardC != shardA && newShardC != shardB, "Duplicate shard address");
        address oldShard = shardC;
        shardC = newShardC;
        emit ShardRotated(oldShard, newShardC, 3);
    }

    /**
     * @notice Execute a single call from the account
     */
    function execute(address target, uint256 value, bytes calldata data) external onlyAuthorized {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit Executed(target, value, data);
    }

    /**
     * @notice Execute batch calls from the account
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyAuthorized {
        require(
            targets.length == values.length && values.length == datas.length,
            "Mismatched array lengths"
        );

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call{value: values[i]}(datas[i]);
            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }
        emit BatchExecuted(targets.length);
    }

    function recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        return ecrecover(hash, v, r, s);
    }
}
