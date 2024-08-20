
import { getContractFilePath, loadArtifact, newTx } from './helper';
import { assert, expect } from 'chai';
import { buildContractClass } from '../src/contract';
import { Bytes, SigHashPreimage, Ripemd160 } from '../src/scryptTypes';
import { bsv, getPreimage } from '../src/utils';
import { num2bin, toHex } from '../src';

// number of bytes to denote some numeric value
const DataLen = 1
const emptyPublicKey = '000000000000000000000000000000000000000000000000000000000000000000';
const inputIndex = 0;
const inputSatoshis = 100000;
const Signature = bsv.crypto.Signature
// Note: ANYONECANPAY
const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID



// Token price is 1000 satoshis each
// NOTE: a price that is too low could run afoul of dust policy
const SATS_PER_TOKEN = 1000n


const privateKeys = [1, 1, 1, 1, 1].map(k => bsv.PrivateKey.fromRandom())
const publicKeys = new Array(privateKeys.length)
const pkhs = new Array(privateKeys.length)

for (let k = 0; k < privateKeys.length; k++) {
  publicKeys[k] = bsv.PublicKey.fromPrivateKey(privateKeys[k])
  pkhs[k] = bsv.crypto.Hash.sha256ripemd160(publicKeys[k].toBuffer())
}


describe('Test advancedTokenSale.test', () => {
  let saler, preimage, result

  before(() => {
    const AdvancedTokenSale = buildContractClass(loadArtifact('advancedTokenSale.json'))
    saler = new AdvancedTokenSale(SATS_PER_TOKEN);

    // append state as passive data
    saler.setDataPart(emptyPublicKey + "00");

  });

  function testBuy(numBought, pkh, publicKey) {
    const tx = newTx(inputSatoshis);
    const newState = [saler.dataPart.toASM(), toHex(publicKey) + num2bin(numBought, DataLen)].join(' ');

    const newLockingScript = [saler.codePart.toASM(), newState].join(' ')

    const changeAmount = inputSatoshis - numBought * Number(SATS_PER_TOKEN)
    const outputAmount = inputSatoshis + numBought * Number(SATS_PER_TOKEN)

    // counter output
    tx.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: outputAmount
    }))

    // change output
    tx.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.buildPublicKeyHashOut(publicKey.toAddress()),
      satoshis: changeAmount
    }))

    preimage = getPreimage(tx, saler.lockingScript, inputSatoshis, 0, sighashType)


    const context = { tx, inputIndex, inputSatoshis }
    result = saler.buy(SigHashPreimage(preimage), Ripemd160(toHex(pkh)), BigInt(changeAmount), Bytes(toHex(publicKey)), BigInt(numBought)).verify(context)
    expect(result.success, result.error).to.be.true;
    return newState;
  }



  it('should succeed when pushing right preimage & amount', () => {
    // any contract that includes checkSig() must be verified in a given context

    let newState = testBuy(1, pkhs[0], publicKeys[0]);

    saler.setDataPart(newState);
    newState = testBuy(3, pkhs[1], publicKeys[1])
    saler.setDataPart(newState);
    newState = testBuy(10, pkhs[2], publicKeys[2])

    saler.setDataPart(newState);
    newState = testBuy(2, pkhs[3], publicKeys[3])
  });

});
