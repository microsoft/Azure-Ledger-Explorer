import * as CBOR from "cbor-redux";

function typedArrayToBuffer(array: Uint8Array): ArrayBuffer | SharedArrayBuffer {
    return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset)
}

function cborBufferToAny(cbor: ArrayBuffer | SharedArrayBuffer): any {
    try {
        const decoded = CBOR.decode(cbor, null, { dictionary: "object" });
        if (decoded.tag === 18) {
            // Handle COSE message
            if (!Array.isArray(decoded.value) || decoded.value.length != 4) {
                throw new Error("Not a COSE_Sign1 message: not an array of length 4");
            }
            const phdr = decoded.value[0] instanceof Uint8Array ? cborArrayToAny(decoded.value[0]) : decoded.value[0];
            const uhdr = decoded.value[1] instanceof Uint8Array ? cborArrayToAny(decoded.value[1]) : decoded.value[1];
            const payload = arrayToTextOrHex(decoded.value[2]);
            const signature = arrayToHex(decoded.value[3]);
            return {
                protected: phdr,
                unprotected: uhdr,
                payload: payload,
                signature: signature
            };
        }
        return decoded;
    } catch (error) {
        console.error('Failed to decode CBOR:', error, cbor);
        return bufferToHex(cbor);
    }
}

export function cborArrayToAny(cbor: Uint8Array): any {
    return cborBufferToAny(typedArrayToBuffer(cbor));
}


export function cborBufferToText(cbor: ArrayBuffer | SharedArrayBuffer): string {
    const decoded = cborBufferToAny(cbor);
    if (typeof decoded === 'string') {
        return decoded;
    }
    return JSON.stringify(decoded);
}

export function cborArrayToText(cbor: Uint8Array): string {
    return cborBufferToText(typedArrayToBuffer(cbor));
}

function arrayToTextOrHex(input: Uint8Array): string {
    let text = '';
    // see if it is cbor
    try {
        const decoded = CBOR.decode(input.buffer, null, { dictionary: "object" });
        text = JSON.stringify(decoded);
    } catch (error) {
        text = new TextDecoder('utf-8', { fatal: false }).decode(input);
    }
    return text ? text : arrayToHex(input);
}``

function arrayToHex(input: Uint8Array): string {
    return Array.from(input).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bufferToHex(input: ArrayBuffer | SharedArrayBuffer): string {
    const view = new Uint8Array(input);
    return arrayToHex(view);
}