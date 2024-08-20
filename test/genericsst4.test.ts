
import { expect } from 'chai';
import { loadArtifact, excludeMembers } from './helper';
import { buildContractClass, } from '../src/contract';
import { Bytes } from '../src';


describe('GenericStruct  test', () => {

    describe('test genericsst4', () => {
        let c, result;

        const C = buildContractClass(loadArtifact('genericsst4.json'));
        before(() => {
            const l = [
                [
                    [{
                        a: {
                            x: [true],
                            y: [1n, 1n, 1n]
                        },
                        b: {
                            x: Bytes('0011'),
                            y: true
                        }
                    }, {
                        a: {
                            x: [true],
                            y: [2n, 2n, 2n]
                        },
                        b: {
                            x: Bytes('001111'),
                            y: true
                        }
                    }],
                    [{
                        a: {
                            x: [true],
                            y: [3n, 3n, 3n]
                        },
                        b: {
                            x: Bytes('001111ff'),
                            y: true
                        }
                    }, {
                        a: {
                            x: [true],
                            y: [4n, 4n, 4n]
                        },
                        b: {
                            x: Bytes('02201111ff'),
                            y: true
                        }
                    }]
                ],

                {
                    x: 11n,
                    y: {
                        x: 2n,
                        y: 3n
                    }
                }
            ];
            c = new C(l);
        });

        it('should unlock successfully', () => {

            result = c.unlock({
                x: [true],
                y: [1n, 1n, 1n]
            }, {
                x: Bytes(''),
                y: false
            }).verify();

            expect(result.success, result.error).to.be.true
        })




        it('should unlock fail', () => {
            result = c.unlock({
                x: [true],
                y: [1n, 1n, 2n]
            }, {
                x: Bytes(''),
                y: false
            }).verify();

            expect(result.success, result.error).to.be.false

        })


    });
});