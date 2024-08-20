import { assert, expect } from 'chai';
import { loadArtifact } from './helper';
import { buildContractClass, AbstractContract } from '../src/contract';


describe('Contract artifact old version test', () => {

  it('should throw when missing version', () => {
    const jsonArtifact = loadArtifact('p2pkh_missing_version.json');
    expect(() => { buildContractClass(jsonArtifact); }).to.throw('Missing field `version` in artifact');
  });

  it('should throw when version lower', () => {

    expect(() => { buildContractClass(loadArtifact('version_1.json')); }).to.throw('Contract artifact version deprecated, The minimum version number currently supported is 8');

    expect(() => { buildContractClass(loadArtifact('version_2.json')); }).to.throw('Contract artifact version deprecated, The minimum version number currently supported is 8');

  });

  it('test basic type in p2pkh.json', () => {
    const jsonArtifact = loadArtifact('p2pkh.json');
    const Contract = buildContractClass(jsonArtifact)
    expect(typeof Contract === typeof AbstractContract).to.be.true;
  });

})