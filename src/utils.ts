import * as bsv from '@scrypt-inc/bsv';
import * as crypto from 'crypto';

export { bsv };

import { ABIEntity, LibraryEntity } from '.';
import { AbstractContract, getValidatedHexString, Script, ScryptType, StructEntity, SupportedParamType } from './internal';
import { arrayTypeAndSizeStr, isGenericType, parseGenericType } from './typeCheck';

const BN = bsv.crypto.BN;
const Interp = bsv.Script.Interpreter;

export const DEFAULT_FLAGS =
  //Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CLEANSTACK | // no longer applies now p2sh is deprecated: cleanstack only applies to p2sh
  Interp.SCRIPT_ENABLE_MAGNETIC_OPCODES | Interp.SCRIPT_ENABLE_MONOLITH_OPCODES | // TODO: to be removed after upgrade to bsv 2.0
  Interp.SCRIPT_VERIFY_STRICTENC |
  Interp.SCRIPT_ENABLE_SIGHASH_FORKID | Interp.SCRIPT_VERIFY_LOW_S | Interp.SCRIPT_VERIFY_NULLFAIL |
  Interp.SCRIPT_VERIFY_DERSIG |
  Interp.SCRIPT_VERIFY_MINIMALDATA | Interp.SCRIPT_VERIFY_NULLDUMMY |
  Interp.SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS |
  Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY | Interp.SCRIPT_VERIFY_CLEANSTACK;

export const DEFAULT_SIGHASH_TYPE =
  bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;


/**
 * decimal or hex int to little-endian signed magnitude
 */
export function int2Asm(str: string): string {

  if (/^(-?\d+)$/.test(str) || /^0x([0-9a-fA-F]+)$/.test(str)) {

    const number = str.startsWith('0x') ? new BN(str.substring(2), 16) : new BN(str, 10);

    if (number.eqn(-1)) { return 'OP_1NEGATE'; }

    if (number.gten(0) && number.lten(16)) { return 'OP_' + number.toString(); }

    const m = number.toSM({ endian: 'little' });
    return m.toString('hex');

  } else {
    throw new Error(`invalid str '${str}' to convert to int`);
  }
}



/**
 * convert asm string to number or bigint
 */
export function asm2int(str: string): number | string {

  switch (str) {
    case 'OP_1NEGATE':
      return -1;
    case '0':
    case 'OP_0':
    case 'OP_1':
    case 'OP_2':
    case 'OP_3':
    case 'OP_4':
    case 'OP_5':
    case 'OP_6':
    case 'OP_7':
    case 'OP_8':
    case 'OP_9':
    case 'OP_10':
    case 'OP_11':
    case 'OP_12':
    case 'OP_13':
    case 'OP_14':
    case 'OP_15':
    case 'OP_16':
      return parseInt(str.replace('OP_', ''));
    default: {
      const value = getValidatedHexString(str);
      const bn = BN.fromHex(value, {
        endian: 'little'
      });

      if (bn.toNumber() < Number.MAX_SAFE_INTEGER && bn.toNumber() > Number.MIN_SAFE_INTEGER) {
        return bn.toNumber();
      } else {
        return bn.toString();
      }
    }
  }
}





export function uint82hex(val: number): string {
  let hex = val.toString(16);
  if (hex.length % 2 === 1) {
    hex = '0' + hex;
  }
  return hex;
}



export function toHex(x: { toString(format: 'hex'): string }): string {
  return x.toString('hex');
}

export function utf82Hex(val: string): string {
  const encoder = new TextEncoder();
  const uint8array = encoder.encode(val);
  return toHex(Buffer.from(uint8array));
}







export function bytes2Literal(bytearray: Buffer, type: string): string {

  switch (type) {
    case 'bool':
      return BN.fromBuffer(bytearray, { endian: 'little' }).gt(0) ? 'true' : 'false';

    case 'int':
    case 'PrivKey':
      return BN.fromSM(bytearray, { endian: 'little' }).toString();

    case 'bytes':
      return `b'${bytesToHexString(bytearray)}'`;

    default:
      return `b'${bytesToHexString(bytearray)}'`;
  }

}

export function bytesToHexString(bytearray: Buffer): string {
  return bytearray.reduce(function (o, c) { return o += ('0' + (c & 0xFF).toString(16)).slice(-2); }, '');
}

export function hexStringToBytes(hex: string): number[] {

  getValidatedHexString(hex);

  return hex.split('')
    .reduce(function (o, c, i) {
      if (i % 2 === 0) {
        o.push(c);
      } else {
        o[o.length - 1] += c;
      }
      return o;
    }, new Array<string>())
    .map(b => parseInt(b, 16));
}


export function signTx(
  tx: bsv.Transaction,
  privateKey: bsv.PrivateKey,
  lockingScript: Script,
  inputAmount: number,
  inputIndex = 0,
  sighashType = DEFAULT_SIGHASH_TYPE,
  flags = DEFAULT_FLAGS,
  hashCache?: bsv.HashCache
): string {

  if (!tx) {
    throw new Error('param tx can not be empty');
  }

  if (!privateKey) {
    throw new Error('param privateKey can not be empty');
  }

  if (!lockingScript) {
    throw new Error('param lockingScript can not be empty');
  }

  if (!inputAmount) {
    throw new Error('param inputAmount can not be empty');
  }

  if (typeof lockingScript === 'string') {
    throw new Error('Breaking change: LockingScript in ASM format is no longer supported, please use the lockingScript object directly');
  }

  return toHex(bsv.Transaction.Sighash.sign(
    tx, privateKey, sighashType, inputIndex,
    lockingScript, new bsv.crypto.BN(inputAmount), flags, hashCache
  ).toTxFormat());
}



export function getPreimage(tx: bsv.Transaction, lockingScript: Script, inputAmount: number, inputIndex = 0, sighashType = DEFAULT_SIGHASH_TYPE, flags = DEFAULT_FLAGS): string {
  const preimageBuf = bsv.Transaction.Sighash.sighashPreimage(tx, sighashType, inputIndex, lockingScript, new bsv.crypto.BN(inputAmount), flags);
  return toHex(preimageBuf);
}

const MSB_THRESHOLD = 0x7e;


export function hashIsPositiveNumber(sighash: Buffer): boolean {
  const highByte = sighash.readUInt8(31);
  return highByte < MSB_THRESHOLD;
}


export function getLowSPreimage(tx: bsv.Transaction, lockingScript: Script, inputAmount: number, inputIndex = 0, sighashType = DEFAULT_SIGHASH_TYPE, flags = DEFAULT_FLAGS): string {

  for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
    const preimage = getPreimage(tx, lockingScript, inputAmount, inputIndex, sighashType, flags);
    const sighash = bsv.crypto.Hash.sha256sha256(Buffer.from(preimage, 'hex'));
    const msb = sighash.readUInt8();
    if (msb < MSB_THRESHOLD && hashIsPositiveNumber(sighash)) {
      return preimage;
    }
    tx.inputs[inputIndex].sequenceNumber--;
  }
}



export function findStructByName(name: string, s: StructEntity[]): StructEntity | undefined {
  return s.find(s => {
    return s.name == name;
  });
}



// test Token[3], int[3], st.b.c[3]
export function isArrayType(type: string): boolean {
  return /^(.+)(\[[\w.]+\])+$/.test(type);
}



export function getNameByType(type: string): string {

  if (isArrayType(type)) {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const [elemType, _] = arrayTypeAndSizeStr(type);
    return getNameByType(elemType);
  }

  if (isGenericType(type)) {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const [tn, _] = parseGenericType(type);
    return getNameByType(tn);
  }

  return type;
}



export function findStructByType(type: string, s: StructEntity[]): StructEntity | undefined {
  const name = getNameByType(type);
  if (name) {
    return findStructByName(name, s);
  }
  return undefined;
}



export function toGenericType(name: string, genericTypes: Array<string>): string {
  return `${name}<${genericTypes.join(',')}>`;
}



export function subscript(index: number, arraySizes: Array<number>): string {

  if (arraySizes.length == 1) {
    return `[${index}]`;
  } else {
    const subArraySizes = arraySizes.slice(1);
    const offset = subArraySizes.reduce(function (acc, val) { return acc * val; }, 1);
    return `[${Math.floor(index / offset)}]${subscript(index % offset, subArraySizes)}`;
  }
}


export function isEmpty(obj: any): boolean {
  return Object.keys(obj).length === 0;
}





export function newCall(Cls: typeof AbstractContract, args: Array<SupportedParamType>): AbstractContract {
  return new (Function.prototype.bind.apply(Cls, [null].concat(args)));
}




export function resolveConstValue(node: any): string | undefined {

  let value: string | undefined = undefined;
  if (node.expr.nodeType === 'IntLiteral') {
    value = node.expr.value.toString(10);
  } else if (node.expr.nodeType === 'BoolLiteral') {
    value = node.expr.value;
  } if (node.expr.nodeType === 'BytesLiteral') {
    value = `b'${node.expr.value.map(a => uint82hex(a)).join('')}'`;
  } if (node.expr.nodeType === 'FunctionCall') {
    if ([ScryptType.PUBKEY, ScryptType.RIPEMD160, ScryptType.SIG, ScryptType.SIGHASHTYPE, ScryptType.OPCODETYPE, ScryptType.SIGHASHPREIMAGE, ScryptType.SHA1, ScryptType.SHA256].includes(node.expr.name)) {
      value = `b'${node.expr.params[0].value.map(a => uint82hex(a)).join('')}'`;
    } else if (node.expr.name === ScryptType.PRIVKEY) {
      value = node.expr.params[0].value.toString(10);
    }
  }
  return value;
}


export function ansiRegex({ onlyFirst = false } = {}) {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
}


export function stripAnsi(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
  }

  return string.replace(ansiRegex(), '');
}





function escapeRegExp(stringToGoIntoTheRegex: string) {
  return stringToGoIntoTheRegex.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}



export function buildContractCode(hexTemplateArgs: Map<string, string>, hexTemplateInlineASM: Map<string, string>, hexTemplate: string): bsv.Script {


  let lsHex = hexTemplate;

  for (const entry of hexTemplateArgs.entries()) {
    const name = entry[0];
    const value = entry[1];
    lsHex = lsHex.replace(name, value);
  }


  for (const entry of hexTemplateInlineASM.entries()) {
    const name = entry[0];
    const value = entry[1];
    lsHex = lsHex.replace(new RegExp(`${escapeRegExp(name)}`, 'g'), value);
  }

  return bsv.Script.fromHex(lsHex);

}





/**
 * Parse out which public function is called through unlocking script
 * @param contract 
 * @param hex hex of unlocking script
 * @returns return ABIEntity of the public function which is call by the unlocking script
 */
export function parseAbiFromUnlockingScript(contract: AbstractContract, hex: string): ABIEntity {

  const abis = Object.getPrototypeOf(contract).constructor.abi as ABIEntity[];

  const pubFunAbis = abis.filter(entity => entity.type === 'function');
  const pubFunCount = pubFunAbis.length;

  if (pubFunCount === 1) {
    return pubFunAbis[0];
  }

  const script = bsv.Script.fromHex(hex);

  const usASM = script.toASM() as string;

  const pubFuncIndexASM = usASM.substr(usASM.lastIndexOf(' ') + 1);

  const pubFuncIndex = asm2int(pubFuncIndexASM);


  const entity = abis.find(entity => entity.index === pubFuncIndex);

  if (!entity) {
    throw new Error(`the raw unlocking script cannot match the contract ${contract.contractName}`);
  }

  return entity;
}


export function librarySign(genericEntity: LibraryEntity): string {
  return `[${genericEntity.params.map(p => p.type).join(',')}]`;
}

export function structSign(structEntity: StructEntity): string {
  return `${JSON.stringify(structEntity.params.reduce((p, v) => Object.assign(p, {
    [v.name]: v.type
  }), {}), null, 4)}`;
}





export function md5(s: string): string {

  const md5 = crypto.createHash('md5');

  return md5.update(s).digest('hex');
}


export function checkNOPScript(nopScript: bsv.Script) {

  bsv.Script.Interpreter.MAX_SCRIPT_ELEMENT_SIZE = Number.MAX_SAFE_INTEGER;
  bsv.Script.Interpreter.MAXIMUM_ELEMENT_SIZE = Number.MAX_SAFE_INTEGER;

  const bsi = new bsv.Script.Interpreter();
  const tx = new bsv.Transaction().from({
    txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    outputIndex: 0,
    script: '',   // placeholder
    satoshis: 1
  });

  const result = bsi.verify(new bsv.Script(""), nopScript, tx, 0, DEFAULT_FLAGS, new bsv.crypto.BN(1));

  if (result || bsi.errstr !== "SCRIPT_ERR_EVAL_FALSE_NO_RESULT") {
    throw new Error("NopScript should be a script that does not affect the Bitcoin virtual machine stack.");
  }

}
