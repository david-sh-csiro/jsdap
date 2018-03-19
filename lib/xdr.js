// Lots of code from http://jsfromhell.com/classes/binary-parser
//    Jonas Raoni Soares Silva
//    http://jsfromhell.com/classes/binary-parser [v1.0]

"use strict"

const END_OF_SEQUENCE = '\xa5\x00\x00\x00';
const START_OF_SEQUENCE = '\x5a\x00\x00\x00';

export class dapUnpacker {
    constructor(xdrdata, daplet) {
        this._buf = xdrdata;
        this.daplet = daplet;
        this._pos = 0;
    }

    getValue() {
        let i = this._pos;
        let type = this.daplet.type.toLowerCase();

        if (type == 'structure' || type == 'dataset') {
            let out = [], tmp;
            daplet = this.daplet;
            for (child in daplet) {
                if (daplet[child].type) {
                    this.daplet = daplet[child];
                    tmp = this.getValue();
                    out.push(tmp);
                }
            }
            this.daplet = daplet;
            return out;

        } else if (type == 'grid') {
            let out = [], tmp;
            daplet = this.daplet;

            this.daplet = daplet.array;
            tmp = this.getValue();
            out.push(tmp);

            for (map in daplet.maps) {
                this.daplet = daplet.maps[map];
                tmp = this.getValue();
                out.push(tmp);
            }

            this.daplet = daplet;
            return out;

        } else if (type == 'sequence') {
            let mark = this._unpack_uint32();
            let out = [], struct, tmp;
            daplet = this.daplet;
            while (mark != 2768240640) {
                struct = [];
                for (child in daplet) {
                    if (daplet[child].type) {
                        this.daplet = daplet[child];
                        tmp = this.getValue();
                        struct.push(tmp);
                    }
                }
                out.push(struct);
                mark = this._unpack_uint32();
            }
            this.daplet = daplet;
            return out;
            // This is a request for a base type letiable inside a
            // sequence.
        } else if (this._buf.slice(i, i + 4) == START_OF_SEQUENCE) {
            let mark = this._unpack_uint32();
            let out = [], tmp;
            while (mark != 2768240640) {
                tmp = this.getValue();
                out.push(tmp);
                mark = this._unpack_uint32();
            }
            return out;
        }

        let n = 1;
        if (this.daplet.shape.length) {
            n = this._unpack_uint32();
            if (type != 'url' && type != 'string') {
                this._unpack_uint32();
            }
        }

        // Bytes?
        let out;
        if (type == 'byte') {
            out = this._unpack_bytes(n);
            // String?
        } else if (type == 'url' || type == 'string') {
            out = this._unpack_string(n);
        } else {
            out = [];
            let func;
            switch (type) {
                case 'float32':
                    func = '_unpack_float32';
                    break;
                case 'float64':
                    func = '_unpack_float64';
                    break;
                case 'int'    :
                    func = '_unpack_int32';
                    break;
                case 'uint'   :
                    func = '_unpack_uint32';
                    break;
                case 'int16'  :
                    func = '_unpack_int16';
                    break;
                case 'uint16' :
                    func = '_unpack_uint16';
                    break;
                case 'int32'  :
                    func = '_unpack_int32';
                    break;
                case 'uint32' :
                    func = '_unpack_uint32';
                    break;
            }
            for (let i = 0; i < n; i++) {
                out.push(this[func]());
            }
        }

        if (this.daplet.shape) {
            out = reshape(out, this.daplet.shape);
        } else {
            out = out[0];
        }

        return out;
    };

    _unpack_byte() {
        let bytes = 1;
        let signed = false;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    _unpack_uint16() {
        let bytes = 4;
        let signed = false;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    _unpack_uint32() {
        let bytes = 4;
        let signed = false;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    _unpack_int16() {
        let bytes = 4;
        let signed = true;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    _unpack_int32() {
        let bytes = 4;
        let signed = true;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    _unpack_float32() {
        let precision = 23;
        let exponent = 8;
        let bytes = 4;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeFloat(data, precision, exponent);
    };

    _unpack_float64() {
        let precision = 52;
        let exponent = 11;
        let bytes = 8;

        let i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeFloat(data, precision, exponent);
    };

    _unpack_bytes(count) {
        let i = this._pos;
        let out = [];
        for (let c = 0; c < count; c++) {
            out.push(this._unpack_byte());
        }
        let padding = (4 - (count % 4)) % 4;
        this._pos = i + count + padding;

        return out;
    };

    _unpack_string(count) {
        let out = [];
        let n, i, j;
        for (let c = 0; c < count; c++) {
            n = this._unpack_uint32();
            i = this._pos;
            data = this._buf.slice(i, i + n);

            padding = (4 - (n % 4)) % 4;
            this._pos = i + n + padding;

            // convert back to string
            let str = '';
            for (let i = 0; i < n; i++) {
                str += String.fromCharCode(data[i]);
            }
            out.push(str);
        }

        return out;
    };
}

export function getBuffer(data) {
    let b = new Array(data.length);
    for (let i = 0; i < data.length; i++) {
        b[i] = data.charCodeAt(i) & 0xff;
    }
    return b;
}

function reshape(array, shape) {
    if (!shape.length) return array[0];
    let out = [];
    let size, start, stop;
    for (let i = 0; i < shape[0]; i++) {
        size = array.length / shape[0];
        start = i * size;
        stop = start + size;
        out.push(reshape(array.slice(start, stop), shape.slice(1)));
    }
    return out;
}

function shl(a, b) {
    for (++b; --b; a = ((a %= 0x7fffffff + 1) & 0x40000000) == 0x40000000 ? a * 2 : (a - 0x40000000) * 2 + 0x7fffffff + 1) ;
    return a;
}


function readBits(buffer, start, length) {
    if (start < 0 || length <= 0) return 0;

    for (let offsetLeft, offsetRight = start % 8, curByte = buffer.length - (start >> 3) - 1,
             lastByte = buffer.length + (-(start + length) >> 3), diff = curByte - lastByte,
             sum = ((buffer[curByte] >> offsetRight) & ((1 << (diff ? 8 - offsetRight : length)) - 1))
                 + (diff && (offsetLeft = (start + length) % 8) ? (buffer[lastByte++] & ((1 << offsetLeft) - 1))
                     << (diff-- << 3) - offsetRight : 0); diff; sum += shl(buffer[lastByte++], (diff-- << 3) - offsetRight)) ;
    return sum;
}


function decodeInt(data, bytes, signed) {
    let x = readBits(data, 0, bytes * 8);
    let max = Math.pow(2, bytes * 8);
    let integer;
    if (signed && x >= (max / 2)) {
        integer = x - max;
    } else {
        integer = x;
    }
    return integer;
}


function decodeFloat(buffer, precisionBits, exponentBits) {
    let buffer = data;

    let bias = Math.pow(2, exponentBits - 1) - 1;
    let signal = readBits(buffer, precisionBits + exponentBits, 1);
    let exponent = readBits(buffer, precisionBits, exponentBits);
    let significand = 0;
    let divisor = 2;
    let curByte = buffer.length + (-precisionBits >> 3) - 1;
    let byteValue, startBit, mask;

    do
        for (byteValue = buffer[++curByte], startBit = precisionBits % 8 || 8, mask = 1 << startBit;
             mask >>= 1; (byteValue & mask) && (significand += 1 / divisor), divisor *= 2) ;
    while (precisionBits -= startBit);

    return exponent == (bias << 1) + 1 ? significand ? NaN : signal ? -Infinity : +Infinity
        : (1 + signal * -2) * (exponent || significand ? !exponent ? Math.pow(2, -bias + 1) * significand
        : Math.pow(2, exponent - bias) * (1 + significand) : 0);
}
