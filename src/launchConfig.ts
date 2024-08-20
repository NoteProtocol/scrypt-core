import {
   SupportedParamType,  getValidatedHexString,
  arrayTypeAndSize, ScryptType, Bytes, TypeResolver, Argument, subArrayType, subscript, SymbolType, StructEntity, LibraryEntity, deduceGenericStruct, deduceGenericLibrary
} from './internal';
import { isArrayType, } from './utils';



export function toJSON(arg: Argument, resolver: TypeResolver): unknown {

  const typeInfo = resolver(arg.type);

  if (isArrayType(typeInfo.finalType)) {
    const v = arg.value as SupportedParamType[];
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const [_, arraySizes] = arrayTypeAndSize(typeInfo.finalType);
    const subType = subArrayType(typeInfo.finalType);

    return v.map((val, i) => toJSON({
      name: `${arg.name}${subscript(i, arraySizes)}`,
      type: subType,
      value: val
    }, resolver));
  } else if (typeInfo.symbolType === SymbolType.Library) {

    const l = [];

    const entity = deduceGenericLibrary(arg, typeInfo.info as LibraryEntity, resolver);

    if (entity instanceof Error) {
      throw entity;
    }

    entity.params.forEach((p, i) => {
      l.push(
        toJSON({
          name: p.name,
          type: p.type,
          value: arg.value[i]
        }, resolver)
      );
    });

    return l;
  } else if (typeInfo.symbolType === SymbolType.Struct) {

    const copy = {};

    const entity = deduceGenericStruct(arg, typeInfo.info as StructEntity, resolver);

    if (entity instanceof Error) {
      throw entity;
    }


    entity.params.forEach(p => {

      Object.assign(copy, {
        [p.name]: toJSON({
          name: p.name,
          type: p.type,
          value: arg.value[p.name]
        }, resolver)
      });
    });

    return copy;
  } else if (typeInfo.symbolType === SymbolType.ScryptType) {

    switch (typeInfo.finalType) {
      case ScryptType.BOOL:
        return arg.value;
      case ScryptType.INT: {
        if (BigInt(arg.value as any) >= BigInt(Number.MIN_SAFE_INTEGER) && BigInt(arg.value as any) <= BigInt(Number.MAX_SAFE_INTEGER)) {
          return Number(arg.value);
        } else {
          return arg.value.toString();
        }
      }
      case ScryptType.BYTES: {
        return `b'${arg.value.toString()}'`;
      }
      case ScryptType.PRIVKEY: {
        return `PrivKey(${arg.value.toString()})`;
      }
      case ScryptType.SIG:
      case ScryptType.RIPEMD160:
      case ScryptType.SHA1:
      case ScryptType.SHA256:
      case ScryptType.SIGHASHPREIMAGE:
      case ScryptType.OPCODETYPE:
      case ScryptType.SIGHASHTYPE:
      case ScryptType.PUBKEY: {
        return `${typeInfo.finalType}(b'${arg.value.toString()}')`;
      }

    }
  }
}

export function stringToBytes(str: string): Bytes {
  const encoder = new TextEncoder();
  const uint8array = encoder.encode(str);
  return getValidatedHexString(Buffer.from(uint8array).toString('hex'));
}

export function parseLiteral(l: string, supportInt = false): [SupportedParamType /*asm*/, ScryptType] {


  // bool
  if (l === 'false') {
    return [false, ScryptType.BOOL];
  }
  if (l === 'true') {
    return [true, ScryptType.BOOL];
  }

  if (supportInt) {
    // hex int
    let m = /^(0x[0-9a-fA-F]+)$/.exec(l);
    if (m) {
      return [BigInt(m[1]), ScryptType.INT];
    }

    // decimal int
    m = /^(-?\d+)$/.exec(l);
    if (m) {
      return [BigInt(m[1]), ScryptType.INT];
    }
  } else {
    const m = /^([\da-fA-F]*)$/.exec(l);
    if (m) {
      return [Bytes(l), ScryptType.BYTES];
    }
  }



  // bytes
  // note: special handling of empty bytes b''
  let m = /^b'([\da-fA-F]*)'$/.exec(l);
  if (m) {
    return [Bytes(m[1]), ScryptType.BYTES];
  }



  // String
  m = /^"([\s\S]*)"$/.exec(l);
  if (m) {
    return [stringToBytes(m[1]), ScryptType.BYTES];
  }


  // PrivKey
  // 1) decimal int
  m = /^PrivKey\((-?\d+)\)$/.exec(l);
  if (m) {
    return [BigInt(m[1]), ScryptType.PRIVKEY];
  }
  // 2) hex int
  m = /^PrivKey\((0x[0-9a-fA-F]+)\)$/.exec(l);
  if (m) {
    return [BigInt(m[1]), ScryptType.PRIVKEY];
  }

  // PubKey
  m = /^PubKey\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.PUBKEY];
  }

  // Sig
  m = /^Sig\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.SIG];
  }

  // Ripemd160
  m = /^Ripemd160\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.RIPEMD160];
  }

  // Sha1
  m = /^Sha1\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.SHA1];
  }

  // Sha256
  m = /^Sha256\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.SHA256];
  }

  // SigHashType
  m = /^SigHashType\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.SIGHASHTYPE];
  }

  // SigHashPreimage
  m = /^SigHashPreimage\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.SIGHASHPREIMAGE];
  }

  // OpCodeType
  m = /^OpCodeType\(b'([\da-fA-F]+)'\)$/.exec(l);
  if (m) {
    const value = getValidatedHexString(m[1]);
    return [Bytes(value), ScryptType.OPCODETYPE];
  }


  throw new Error(`<${l}> cannot be cast to ASM format, only sCrypt native types supported`);

}