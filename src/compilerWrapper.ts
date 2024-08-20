import {
   Artifact, resolveConstValue, TypeResolver
} from './internal';

export enum BuildType {
  Debug = 'debug',
  Release = 'release'
}

export interface RelatedInformation {
  filePath: string;
  position: [{
    line: number;
    column: number;
  }, {
    line: number;
    column: number;
  }?];
  message: string;
}


export interface CompileErrorBase {
  type: string;
  filePath: string;
  position: [{
    line: number;
    column: number;
  }, {
    line: number;
    column: number;
  }?];
  message: string;
  relatedInformation: RelatedInformation[]
}



export enum DebugModeTag {
  FuncStart = 'F0',
  FuncEnd = 'F1',
  LoopStart = 'L0'
}

export interface DebugInfo {
  tag: DebugModeTag;
  contract: string;
  func: string;
  context: string;
}

export interface Pos {
  file: string;
  line: number;
  endLine: number;
  column: number;
  endColumn: number;
}

export interface OpCode {
  opcode: string;
  stack?: string[];
  topVars?: string[];
  pos?: Pos;
  debugInfo?: DebugInfo;
}

export interface AutoTypedVar {
  name: string;
  pos: Pos;
  type: string;
}

export interface ABI {
  contract: string, abi: Array<ABIEntity>
}

export enum ABIEntityType {
  FUNCTION = 'function',
  CONSTRUCTOR = 'constructor'
}
export type ParamEntity = {
  name: string;
  type: string;
}
export interface ABIEntity {
  type: string;
  name?: string;
  params: Array<ParamEntity>;
  index?: number;
}

export interface StructEntity {
  name: string;
  params: Array<ParamEntity>;
  genericTypes: Array<string>;
}
export interface LibraryEntity extends StructEntity {
  properties: Array<ParamEntity>;
}
export interface AliasEntity {
  name: string;
  type: string;
}

export type ContractEntity = LibraryEntity

export interface StaticEntity {
  name: string;
  type: string;
  const: boolean;
  value?: any;
}

export function getConstructorDeclaration(mainContract): ABIEntity {
  // explict constructor
  if (mainContract['constructor']) {
    return {
      type: ABIEntityType.CONSTRUCTOR,
      params: mainContract['constructor']['params'].map(p => { return { name: p['name'], type: p['type'] }; }),
    };
  } else {
    // implicit constructor
    if (mainContract['properties']) {
      return {
        type: ABIEntityType.CONSTRUCTOR,
        params: mainContract['properties'].map(p => { return { name: p['name'].replace('this.', ''), type: p['type'] }; }),
      };
    }
  }
}

export function getStateProps(astRoot): Array<ParamEntity> {
  const mainContract = astRoot['contracts'][astRoot['contracts'].length - 1];
  if (mainContract && mainContract['properties']) {
    return mainContract['properties'].filter(p => p.state).map(p => { return { name: p['name'].replace('this.', ''), type: p['type'] }; });
  }
  return [];
}


function getPublicFunctionDeclaration(mainContract): ABIEntity[] {
  let pubIndex = 0;
  const interfaces: ABIEntity[] =
    mainContract['functions']
      .filter(f => f['visibility'] === 'Public')
      .map(f => {
        const entity: ABIEntity = {
          type: ABIEntityType.FUNCTION,
          name: f['name'],
          index: f['nodeType'] === 'Constructor' ? undefined : pubIndex++,
          params: f['params'].map(p => { return { name: p['name'], type: p['type'] }; }),
        };
        return entity;
      });
  return interfaces;
}

export function getFullFilePath(relativePath: string, baseDir: string, curFileName: string): string {
  
  if (relativePath.endsWith('stdin')) {
    return baseDir + curFileName;
    // return join(baseDir, curFileName); // replace 'stdin' with real current compiling file name.
  }

  if (relativePath === 'std') {
    return 'std'; // 
  }
  return baseDir + relativePath;

  // return join(baseDir, relativePath);
}

export function getContractName(astRoot: unknown): string {
  const mainContract = astRoot['contracts'][astRoot['contracts'].length - 1];
  if (!mainContract) {
    return '';
  }
  return mainContract['name'] || '';
}



export function shortGenericType(genericType: string): string {
  const m = genericType.match(/__SCRYPT_(\w+)__/);
  if (m) {
    return m[1];
  }
  return genericType;
}

/**
 * 
 * @param astRoot AST root node after main contract compilation
 * @param typeResolver a Type Resolver
 * @returns All function ABIs defined by the main contract, including constructors
 */
export function getABIDeclaration(astRoot: unknown, typeResolver: TypeResolver): ABI {
  const mainContract = astRoot['contracts'][astRoot['contracts'].length - 1];
  if (!mainContract) {
    return {
      contract: '',
      abi: []
    };
  }

  const interfaces: ABIEntity[] = getPublicFunctionDeclaration(mainContract);
  const constructorABI = getConstructorDeclaration(mainContract);

  interfaces.push(constructorABI);

  interfaces.forEach(abi => {
    abi.params = abi.params.map(param => {
      return Object.assign(param, {
        type: typeResolver(param.type).finalType
      });
    });
  });

  return {
    contract: getContractName(astRoot),
    abi: interfaces
  };
}

/**
 * 
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined structures of the main contract and dependent contracts
 */
export function getStructDeclaration(astRoot: unknown, dependencyAsts: unknown): Array<StructEntity> {


  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach(key => {
    allAst.push(dependencyAsts[key]);
  });

  return allAst.map(ast => {
    return (ast['structs'] || []).map(s => ({
      name: s['name'],
      params: s['fields'].map(p => { return { name: p['name'], type: p['type'] }; }),
      genericTypes: s.genericTypes || [],
    }));
  }).flat(1);
}



/**
 * 
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined Library of the main contract and dependent contracts
 */
export function getLibraryDeclaration(astRoot: unknown, dependencyAsts: unknown): Array<LibraryEntity> {

  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach(key => {
    if (key !== 'std') {
      allAst.push(dependencyAsts[key]);
    }
  });

  return allAst.map(ast => {
    return (ast['contracts'] || []).filter(c => c.nodeType == 'Library').map(c => {
      if (c['constructor']) {
        return {
          name: c.name,
          params: c['constructor']['params'].map(p => { return { name: `ctor.${p['name']}`, type: p['type'] }; }),
          properties: c['properties'].map(p => { return { name: p['name'], type: p['type'] }; }),
          genericTypes: c.genericTypes || [],
        };
      } else {
        // implicit constructor
        if (c['properties']) {
          return {
            name: c.name,
            params: c['properties'].map(p => { return { name: p['name'], type: p['type'] }; }),
            properties: c['properties'].map(p => { return { name: p['name'], type: p['type'] }; }),
            genericTypes: c.genericTypes || [],
          };
        }
      }
    });
  }).flat(1);
}


export function getContractDeclaration(astRoot: unknown, dependencyAsts: unknown): Array<ContractEntity> {

  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach(key => {
    if (key !== 'std') {
      allAst.push(dependencyAsts[key]);
    }
  });

  return allAst.map(ast => {
    return (ast['contracts'] || []).filter(c => c.nodeType == 'Contract').map(c => {
      if (c['constructor']) {
        return {
          name: c.name,
          params: c['constructor']['params'].map(p => { return { name: `ctor.${p['name']}`, type: p['type'] }; }),
          properties: c['properties'].map(p => { return { name: p['name'], type: p['type'] }; }),
          genericTypes: c.genericTypes || []
        };
      } else {
        // implicit constructor
        if (c['properties']) {
          return {
            name: c.name,
            params: c['properties'].map(p => { return { name: p['name'], type: p['type'] }; }),
            properties: c['properties'].map(p => { return { name: p['name'], type: p['type'] }; }),
            genericTypes: c.genericTypes || [],
          };
        }
      }
    });
  }).flat(1);
}


/**
 * 
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined type aliaes of the main contract and dependent contracts
 */
export function getAliasDeclaration(astRoot: unknown, dependencyAsts: unknown): Array<AliasEntity> {

  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach(key => {
    allAst.push(dependencyAsts[key]);
  });

  return allAst.map(ast => {
    return (ast['alias'] || []).map(s => ({
      name: s['alias'],
      type: s['type'],
    }));
  }).flat(1);
}



/**
 * 
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined static const int literal of the main contract and dependent contracts
 */
export function getStaticDeclaration(astRoot: unknown, dependencyAsts: unknown): Array<StaticEntity> {

  const allAst = [astRoot];
  Object.keys(dependencyAsts).forEach(key => {
    allAst.push(dependencyAsts[key]);
  });

  return allAst.map((ast) => {
    return (ast['contracts'] || []).map(contract => {
      return (contract.statics || []).map(node => {
        return {
          const: node.const,
          name: `${contract.name}.${node.name}`,
          type: node.type,
          value: resolveConstValue(node)
        };
      });
    });
  }).flat(Infinity).flat(1);
}