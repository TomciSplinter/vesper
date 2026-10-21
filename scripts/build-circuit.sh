#!/usr/bin/env bash
# Compiles the Vesper transaction circuit and produces a DEVELOPMENT proving key.
#
# WARNING: the powers-of-tau and phase-2 contributions below use local randomness
# from a single machine. Anyone who knows that randomness can forge proofs and
# drain the pool. This key is for local tests and testnet ONLY. Mainnet needs a
# multi-party phase-2 ceremony on top of a public phase-1 (e.g. the Hermez/PSE ptau).
set -euo pipefail

CIRCUIT=transaction2
BUILD=build
PTAU_POWER=15   # 2^15 = 32,768 constraints; the circuit is ~13k at depth 20

command -v circom >/dev/null || { echo "circom not found: install it from https://docs.circom.io/getting-started/installation/"; exit 1; }
SNARKJS="npx snarkjs"

mkdir -p "$BUILD"

echo "==> Compiling circuit"
circom "circuits/${CIRCUIT}.circom" --r1cs --wasm --sym -o "$BUILD" -l node_modules
$SNARKJS r1cs info "$BUILD/${CIRCUIT}.r1cs"

if [ ! -f "$BUILD/pot${PTAU_POWER}_final.ptau" ]; then
  echo "==> DEV powers of tau (insecure, single contributor)"
  $SNARKJS powersoftau new bn128 "$PTAU_POWER" "$BUILD/pot_0000.ptau"
  $SNARKJS powersoftau contribute "$BUILD/pot_0000.ptau" "$BUILD/pot_0001.ptau" --name="dev" -e="$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  $SNARKJS powersoftau prepare phase2 "$BUILD/pot_0001.ptau" "$BUILD/pot${PTAU_POWER}_final.ptau"
fi

echo "==> DEV phase-2 setup (insecure)"
$SNARKJS groth16 setup "$BUILD/${CIRCUIT}.r1cs" "$BUILD/pot${PTAU_POWER}_final.ptau" "$BUILD/${CIRCUIT}_0000.zkey"
$SNARKJS zkey contribute "$BUILD/${CIRCUIT}_0000.zkey" "$BUILD/${CIRCUIT}.zkey" --name="dev" -e="$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"
$SNARKJS zkey export verificationkey "$BUILD/${CIRCUIT}.zkey" "$BUILD/${CIRCUIT}_vkey.json"

echo "==> Exporting Solidity verifier"
$SNARKJS zkey export solidityverifier "$BUILD/${CIRCUIT}.zkey" contracts/Verifier.sol

echo "Done. Proving key: $BUILD/${CIRCUIT}.zkey  wasm: $BUILD/${CIRCUIT}_js/${CIRCUIT}.wasm"
