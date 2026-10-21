pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "./merkleproof.circom";
include "./keypair.circom";

/*
Vesper shielded transaction: spend nIns notes, create nOuts notes, all of one asset.

Note (UTXO) = { amount, pubkey, blinding, asset }
  commitment = Poseidon(amount, pubkey, blinding, asset)
  nullifier  = Poseidon(commitment, merklePath, Poseidon(privKey, commitment, merklePath))

One circuit covers deposit, private transfer and withdrawal:
  sum(inputs) + publicAmount == sum(outputs)
where publicAmount = extAmount - fee (mod p) is checked by the pool contract.

PUBLIC SIGNAL ORDER (must match VesperPool._verify): the order public signals are
DECLARED in this template, i.e.
  root, publicAmount, extDataHash, asset, inputNullifier[0..nIns), outputCommitment[0..nOuts)
Keep declarations in this order.
*/
template Transaction(levels, nIns, nOuts) {
    // ---- public ----
    signal input root;
    signal input publicAmount;
    signal input extDataHash;
    signal input asset;
    signal input inputNullifier[nIns];

    // ---- private: inputs ----
    signal input inAmount[nIns];
    signal input inPrivateKey[nIns];
    signal input inBlinding[nIns];
    signal input inPathIndices[nIns];
    signal input inPathElements[nIns][levels];

    // ---- public ----
    signal input outputCommitment[nOuts];

    // ---- private: outputs ----
    signal input outAmount[nOuts];
    signal input outPubkey[nOuts];
    signal input outBlinding[nOuts];

    component inKeypair[nIns];
    component inSignature[nIns];
    component inCommitmentHasher[nIns];
    component inNullifierHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];
    var sumIns = 0;

    for (var tx = 0; tx < nIns; tx++) {
        inKeypair[tx] = Keypair();
        inKeypair[tx].privateKey <== inPrivateKey[tx];

        inCommitmentHasher[tx] = Poseidon(4);
        inCommitmentHasher[tx].inputs[0] <== inAmount[tx];
        inCommitmentHasher[tx].inputs[1] <== inKeypair[tx].publicKey;
        inCommitmentHasher[tx].inputs[2] <== inBlinding[tx];
        inCommitmentHasher[tx].inputs[3] <== asset;

        inSignature[tx] = Signature();
        inSignature[tx].privateKey <== inPrivateKey[tx];
        inSignature[tx].commitment <== inCommitmentHasher[tx].out;
        inSignature[tx].merklePath <== inPathIndices[tx];

        inNullifierHasher[tx] = Poseidon(3);
        inNullifierHasher[tx].inputs[0] <== inCommitmentHasher[tx].out;
        inNullifierHasher[tx].inputs[1] <== inPathIndices[tx];
        inNullifierHasher[tx].inputs[2] <== inSignature[tx].out;
        inNullifierHasher[tx].out === inputNullifier[tx];

        inTree[tx] = MerkleProof(levels);
        inTree[tx].leaf <== inCommitmentHasher[tx].out;
        inTree[tx].pathIndices <== inPathIndices[tx];
        for (var i = 0; i < levels; i++) {
            inTree[tx].pathElements[i] <== inPathElements[tx][i];
        }

        // Zero-amount (dummy) inputs don't need to be in the tree.
        inCheckRoot[tx] = ForceEqualIfEnabled();
        inCheckRoot[tx].in[0] <== root;
        inCheckRoot[tx].in[1] <== inTree[tx].root;
        inCheckRoot[tx].enabled <== inAmount[tx];

        // Input amounts were range-checked when they were created as outputs.
        sumIns += inAmount[tx];
    }

    component outCommitmentHasher[nOuts];
    component outAmountCheck[nOuts];
    var sumOuts = 0;

    for (var tx = 0; tx < nOuts; tx++) {
        outCommitmentHasher[tx] = Poseidon(4);
        outCommitmentHasher[tx].inputs[0] <== outAmount[tx];
        outCommitmentHasher[tx].inputs[1] <== outPubkey[tx];
        outCommitmentHasher[tx].inputs[2] <== outBlinding[tx];
        outCommitmentHasher[tx].inputs[3] <== asset;
        outCommitmentHasher[tx].out === outputCommitment[tx];

        // Prevent field overflow: every new note is < 2^248.
        outAmountCheck[tx] = Num2Bits(248);
        outAmountCheck[tx].in <== outAmount[tx];

        sumOuts += outAmount[tx];
    }

    // The same note can't be spent twice in one transaction.
    component sameNullifiers[nIns * (nIns - 1) / 2];
    var index = 0;
    for (var i = 0; i < nIns - 1; i++) {
        for (var j = i + 1; j < nIns; j++) {
            sameNullifiers[index] = IsEqual();
            sameNullifiers[index].in[0] <== inputNullifier[i];
            sameNullifiers[index].in[1] <== inputNullifier[j];
            sameNullifiers[index].out === 0;
            index++;
        }
    }

    // Value conservation.
    sumIns + publicAmount === sumOuts;

    // Bind extDataHash into the proof (recipient, relayer, fee, encrypted notes)
    // so a front-runner can't swap them. Squaring forces it into a constraint.
    signal extDataSquare <== extDataHash * extDataHash;
}
