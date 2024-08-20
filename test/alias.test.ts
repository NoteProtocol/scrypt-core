import { getContractFilePath, loadArtifact, newTx } from './helper';
import { assert, expect } from 'chai';
import { buildContractClass, buildTypeResolver } from '../src/contract';
import { Bytes, Int, PubKey, PubKeyHash, Sig, SymbolType } from '../src/scryptTypes';
import { signTx, bsv } from '../src/utils';
import { toHex } from '../src';




describe('Alias type check', () => {
  const AliasContract = buildContractClass(loadArtifact('alias.json'));


  let man = {
    name: "68656c6c6f20776f726c6421",
    age: 33n,
    token: 101n
  };

  const alias = new AliasContract({
    name: Bytes("68656c6c6f20776f726c6421"),
    age: 1n,
    token: 101n
  });

  it('should succeeding when using MaleAAA', () => {

    let result = alias.unlock({
      name: Bytes("68656c6c6f20776f726c6421"),
      age: Int(33),
      token: 101n
    }).verify()
    assert.isTrue(result.success, result.error);

  })

  it('should succeeding when using bytes', () => {

    let result = alias.unlock({
      name: Bytes("68656c6c6f20776f726c6421"),
      age: Int(33),
      token: Int(101)
    }).verify()
    assert.isTrue(result.success, result.error);

  })

  it('should succeeding when using Male', () => {

    let result = alias.unlock({
      name: "68656c6c6f20776f726c6421",
      age: 33n,
      token: 101n
    }).verify()
    assert.isTrue(result.success, result.error);

  })


  it('should succeeding when using Person', () => {

    let result = alias.unlock({
      name: "68656c6c6f20776f726c6421",
      age: 33n,
      token: 101n
    }).verify()
    assert.isTrue(result.success, result.error);
  })

  it('should succeeding when using Female', () => {
    let result = alias.unlock({
      name: "68656c6c6f20776f726c6421",
      age: 33n,
      token: 101n
    }).verify()
    assert.isTrue(result.success, result.error);
  })


  it('should throw when using Block', () => {
    expect(() => {
      alias.unlock({
        height: 1n,
        time: 333n,
        coinbase: Bytes("68656c6c6f20776f726c6421")
      })
    }).to.throw('The type of bob is wrong, expected Person but missing member [age]');
  })

  it('should throw when using wrong type', () => {
    expect(() => {
      alias.unlock([3n, 3n])
    }).to.throw('The type of bob is wrong, expected Person but got a array');

    expect(() => {
      alias.unlock(3n)
    }).to.throw('The type of bob is wrong, expected Person but got a bigint');
  })

  it('should succeeding when using Female', () => {
    let result = alias.unlock({
      name: Bytes("68656c6c6f20776f726c6421"),
      age: Int(33),
      token: Int(101)
    }).verify()
    assert.isTrue(result.success, result.error);
  })



  it('should succeeding when using number', () => {
    let result = alias.setToken([10n, 3n, 3n]).verify()
    assert.isTrue(result.success, result.error);
  })

  it('should succeeding when using all int alias', () => {
    let result = alias.setToken([10n, 3n, 3n]).verify()
    assert.isTrue(result.success, result.error);
  })


  it('should succeeding when parameter is array struct have member with alias', () => {
    let result = alias.isPerson([{
      name: Bytes("68656c6c6f20776f726c6421"),
      age: Int(1),
      token: Int(101)
    }]).verify()
    assert.isTrue(result.success, result.error);
  })



  describe('test pubKeyHash', () => {


    it('should succeeding when unlock by pubKeyHash ', () => {

      const privateKey = bsv.PrivateKey.fromRandom(bsv.Networks.testnet);
      const publicKey = privateKey.publicKey;
      const pubKeyHash = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer());

      const inputSatoshis = 100000;
      const tx = newTx(inputSatoshis);

      const jsonArtifact = loadArtifact('p2pkh.json');
      const DemoP2PKH = buildContractClass(jsonArtifact);
      const p2pkh = new DemoP2PKH(PubKeyHash(toHex(pubKeyHash)));

      p2pkh.txContext = {
        tx,
        inputIndex: 0,
        inputSatoshis: inputSatoshis
      }

      const sig = Sig(signTx(tx, privateKey, p2pkh.lockingScript, inputSatoshis));
      const pubkey = PubKey(toHex(publicKey));

      let result = p2pkh.unlock(sig, pubkey).verify({ inputSatoshis, tx })

      expect(result.success).to.be.true;


    })

  })


  describe('test resolver_generic', () => {
    const C = buildContractClass(loadArtifact('genericsst_alias.json'));

    it('should succeeding when resolver type', () => {

      expect(C.resolver("ST0")).deep.equal({
        finalType: 'ST0',
        generic: true,
        info: {
          genericTypes: ["T"],
          name: "ST0",
          params: [
            {
              name: "x",
              type: "int"
            },
            {
              name: "y",
              type: "T"
            }
          ]
        },
        symbolType: SymbolType.Struct
      })

      expect(C.resolver("ST2")).deep.equal({
        finalType: 'ST2',
        generic: false,
        info: {
          genericTypes: [],
          name: "ST2",
          params: [
            {
              name: "x",
              type: "int"
            }
          ]
        },
        symbolType: SymbolType.Struct
      })


      expect(C.resolver("ST1<ST2[2]>")).deep.equal({
        "info": {
          "name": "ST1",
          "params": [
            {
              "name": "x",
              "type": "T"
            }
          ],
          "genericTypes": [
            "T"
          ]
        },
        "generic": true,
        "finalType": "ST1<ST2[2]>",
        "symbolType": "Struct"
      })

      expect(C.resolver("ST1<ST0<int>>")).deep.equal({
        "info": {
          "name": "ST1",
          "params": [
            {
              "name": "x",
              "type": "T"
            }
          ],
          "genericTypes": [
            "T"
          ]
        },
        "generic": true,
        "finalType": "ST1<ST0<int>>",
        "symbolType": "Struct"
      })


      expect(C.resolver("ST1<ST0<int[3]>[3][1]>")).deep.equal({
        "info": {
          "name": "ST1",
          "params": [
            {
              "name": "x",
              "type": "T"
            }
          ],
          "genericTypes": [
            "T"
          ]
        },
        "generic": true,
        "finalType": "ST1<ST0<int[3]>[3][1]>",
        "symbolType": "Struct"
      })

      expect(C.resolver("ST0A")).deep.equal({
        "info": {
          "name": "ST0",
          "params": [
            {
              "name": "x",
              "type": "int"
            },
            {
              "name": "y",
              "type": "T"
            }
          ],
          "genericTypes": [
            "T"
          ]
        },
        "generic": true,
        "finalType": "ST0<int>",
        "symbolType": "Struct"
      })

      expect(C.resolver("ST0AA")).deep.equal({
        "info": {
          "name": "ST0",
          "params": [
            {
              "name": "x",
              "type": "int"
            },
            {
              "name": "y",
              "type": "T"
            }
          ],
          "genericTypes": [
            "T"
          ]
        },
        "generic": true,
        "finalType": "ST0<ST0<int>>",
        "symbolType": "Struct"
      })


      expect(C.resolver("INTA")).deep.equal({
        finalType: 'int[3]',
        generic: false,
        info: undefined,
        symbolType: SymbolType.ScryptType
      })


      expect(C.resolver("ST1A")).deep.equal({
        "info": {
          "name": "ST1",
          "params": [
            {
              "name": "x",
              "type": "T"
            }
          ],
          "genericTypes": [
            "T"
          ]
        },
        "generic": true,
        "finalType": "ST1<int[3]>",
        "symbolType": "Struct"
      })

      expect(C.resolver("ST3A")).deep.equal({
        "info": {
          "name": "ST3",
          "params": [
            {
              "name": "x",
              "type": "T"
            },
            {
              "name": "y",
              "type": "K"
            }
          ],
          "genericTypes": [
            "T",
            "K"
          ]
        },
        "generic": true,
        "finalType": "ST3<ST1<int[3]>,ST0<ST0<int>>>",
        "symbolType": "Struct"
      })

    })

  })


})
